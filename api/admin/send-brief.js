// Sends a Brief out to all subscribers in the Supabase signups table.
//
// How it works:
//   POST /api/admin/send-brief?secret=<CRON_SECRET>
//   Body: { "slug": "the-rotation-revisited" }
//
// We pull the brief from src/content/briefs.js (server-imported here),
// pull the recipient list from Supabase (only rows with source != 'orientation'),
// and send one email per recipient via Resend.
//
// Email render is intentionally minimal — text-first, paper background,
// editorial serif via web-safe fallbacks.

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

import { BRIEFS } from '../../src/content/briefs.js'

const FROM = 'Artha Insights <onboarding@resend.dev>'
const REPLY_TO = 'ojaxsingh308@gmail.com'

export default async function handler(req, res) {
  try {
    // ---- Auth ----
    const expectedSecret = (process.env.CRON_SECRET || '').trim()
    const querySecret = (req.query.secret || '').trim()
    const cleanHeader = (req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '')
      .trim()

    const authorized =
      (expectedSecret && cleanHeader === expectedSecret) ||
      (expectedSecret && querySecret === expectedSecret)

    if (!authorized) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // ---- Method check ----
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Use POST or GET' })
    }

    const slug = req.query.slug || req.body?.slug
    if (!slug) {
      return res.status(400).json({ error: 'Missing slug' })
    }

    const brief = BRIEFS.find((b) => b.slug === slug)
    if (!brief) {
      return res.status(404).json({
        error: 'Brief not found',
        availableSlugs: BRIEFS.map((b) => b.slug),
      })
    }

    // ---- Recipients ----
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const RESEND_API_KEY = process.env.RESEND_API_KEY

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Supabase env vars missing' })
    }
    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY missing' })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // Pull only real subscribers — exclude orientation-only rows
    const { data: rows, error: dbErr } = await supabase
      .from('signups')
      .select('email, name')
      .eq('source', 'subscribe')

    if (dbErr) {
      return res.status(500).json({ error: 'DB read failed', detail: dbErr.message })
    }

    if (!rows || rows.length === 0) {
      // If `to` query param is provided, allow a single-test send
      const testTo = (req.query.to || '').trim()
      if (testTo) {
        const resend = new Resend(RESEND_API_KEY)
        const subject = `[TEST] Artha Insights · ${brief.title}`
        const html = renderBriefHtml(brief)
        const text = renderBriefText(brief)
        try {
          const r = await resend.emails.send({
            from: FROM,
            to: testTo,
            replyTo: REPLY_TO,
            subject,
            html,
            text,
          })
          return res.status(200).json({ ok: true, mode: 'test', to: testTo, result: r })
        } catch (e) {
          return res.status(500).json({ error: 'Test send failed', detail: String(e) })
        }
      }

      return res.status(200).json({
        ok: true,
        sent: 0,
        note: 'No subscribers to send to. Pass &to=email@example.com to send a test.',
      })
    }

    // ---- Send ----
    const resend = new Resend(RESEND_API_KEY)
    const subject = `Artha Insights · ${brief.title}`
    const html = renderBriefHtml(brief)
    const text = renderBriefText(brief)

    let sent = 0
    const failures = []

    // Send sequentially to stay under Resend's free tier rate limits.
    // For larger volumes we'd batch via resend.batch.send().
    for (const row of rows) {
      try {
        await resend.emails.send({
          from: FROM,
          to: row.email,
          replyTo: REPLY_TO,
          subject,
          html,
          text,
        })
        sent += 1
      } catch (e) {
        failures.push({ email: row.email, error: String(e) })
      }
    }

    return res.status(200).json({
      ok: true,
      sent,
      total: rows.length,
      failures,
    })
  } catch (e) {
    return res.status(500).json({
      error: 'Unhandled exception',
      detail: String(e),
    })
  }
}

// ---- Email rendering ----

function renderBriefHtml(brief) {
  const dateLabel = formatDate(brief.date)
  const blocks = brief.body
    .map((b) => {
      switch (b.type) {
        case 'h2':
          return `<h2 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;color:#0E0E0E;margin:32px 0 12px;letter-spacing:-0.01em;">${escape(b.text)}</h2>`
        case 'h3':
          return `<h3 style="font-family:Georgia,serif;font-size:18px;font-weight:500;color:#0E0E0E;margin:24px 0 8px;">${escape(b.text)}</h3>`
        case 'quote':
          return `<blockquote style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.5;color:#0E0E0E;border-left:2px solid #6E1F1F;padding:6px 0 6px 18px;margin:24px 0;">${escape(b.text)}</blockquote>`
        case 'hr':
          return `<div style="text-align:center;margin:32px 0;color:#6E1F1F;letter-spacing:0.6em;font-size:10px;">◆ ◆ ◆</div>`
        default:
          return `<p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.7;color:#1F1D1B;margin:0 0 18px;">${escape(b.text)}</p>`
      }
    })
    .join('')

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F5F1E8;">
  <div style="max-width:580px;margin:0 auto;padding:48px 24px;background:#F5F1E8;">

    <div style="text-align:center;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:#6E1F1F;margin-bottom:24px;">
      Artha Insights · ${dateLabel}
    </div>

    <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:36px;line-height:1.1;letter-spacing:-0.02em;color:#0E0E0E;text-align:center;margin:0 0 20px;">
      ${escape(brief.title)}
    </h1>

    <p style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.5;color:#3A3735;text-align:center;margin:0 0 32px;">
      ${escape(brief.dek)}
    </p>

    <div style="height:1px;width:80px;background:rgba(14,14,14,0.18);margin:0 auto 32px;"></div>

    ${blocks}

    <div style="margin-top:48px;padding-top:24px;border-top:1px solid rgba(14,14,14,0.10);text-align:center;">
      <p style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:#6E6962;margin:0 0 4px;">
        Artha Insights · Built in Gurugram
      </p>
      <p style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:#9C9690;margin:0;">
        Editorial only · Not investment advice
      </p>
    </div>

  </div>
</body>
</html>`
}

function renderBriefText(brief) {
  const dateLabel = formatDate(brief.date)
  const lines = [
    `Artha Insights — ${dateLabel}`,
    '',
    brief.title.toUpperCase(),
    brief.dek,
    '',
    '◆ ◆ ◆',
    '',
  ]
  for (const b of brief.body) {
    if (b.type === 'h2' || b.type === 'h3') {
      lines.push(b.text.toUpperCase(), '')
    } else if (b.type === 'quote') {
      lines.push(`"${b.text}"`, '')
    } else if (b.type === 'hr') {
      lines.push('◆ ◆ ◆', '')
    } else {
      lines.push(b.text, '')
    }
  }
  lines.push('—', 'Editorial only · Not investment advice')
  return lines.join('\n')
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
