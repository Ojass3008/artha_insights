// Vercel cron — runs every Sunday at 07:00 UTC (12:30 PM IST).
// Automatically finds the most recent unpublished brief and sends it to all
// subscribers. Idempotent: if a brief has already been sent (tracked in
// sent_briefs table), it skips and exits cleanly.
//
// FROM address: reads BRIEF_FROM_EMAIL env var so you can use your own domain
// once it is verified in Resend. Falls back to onboarding@resend.dev for dev.
//
// Dry-run: pass ?dry=true (+ secret) to see what would be sent without
// actually sending or recording. Useful for previewing before Sunday.

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { BRIEFS } from '../../src/content/briefs.js'

const FROM =
  process.env.BRIEF_FROM_EMAIL || 'Artha Insights <onboarding@resend.dev>'
const REPLY_TO = process.env.BRIEF_REPLY_TO || 'ojaxsingh308@gmail.com'

export default async function handler(req, res) {
  try {
    // ---- Auth (mirrors the existing cron pattern) ----
    const expectedSecret = (process.env.CRON_SECRET || '').trim()
    const querySecret = (req.query.secret || '').trim()
    const cleanHeader = (req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '')
      .trim()
    const isVercelCron = (req.headers['user-agent'] || '').includes('vercel-cron')

    const authorized =
      isVercelCron ||
      (expectedSecret && cleanHeader === expectedSecret) ||
      (expectedSecret && querySecret === expectedSecret)

    if (!authorized) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const isDryRun = req.query.dry === 'true'

    // ---- Env checks ----
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const RESEND_API_KEY = process.env.RESEND_API_KEY

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Supabase env vars missing' })
    }
    if (!RESEND_API_KEY && !isDryRun) {
      return res.status(500).json({ error: 'RESEND_API_KEY missing' })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // ---- Find the brief to send ----
    // Sort briefs newest-first. Pick the most recent one whose date is on or
    // before today AND has not already been sent (not in sent_briefs).
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const candidates = BRIEFS
      .filter((b) => b.date <= today)
      .sort((a, b) => (a.date > b.date ? -1 : 1))

    if (candidates.length === 0) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'No briefs dated on or before today' })
    }

    // Check which ones have been sent already.
    const { data: sentRows } = await supabase
      .from('sent_briefs')
      .select('slug')
      .in('slug', candidates.map((b) => b.slug))

    const sentSlugs = new Set((sentRows || []).map((r) => r.slug))
    const brief = candidates.find((b) => !sentSlugs.has(b.slug))

    if (!brief) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'All recent briefs have already been sent',
        sent: Array.from(sentSlugs),
      })
    }

    // ---- Get subscribers ----
    const { data: subscribers, error: dbErr } = await supabase
      .from('signups')
      .select('email, name')
      .eq('source', 'subscribe')

    if (dbErr) {
      return res.status(500).json({ error: 'DB read failed', detail: dbErr.message })
    }

    const recipientCount = (subscribers || []).length

    if (isDryRun) {
      return res.status(200).json({
        ok: true,
        dry_run: true,
        would_send: {
          slug: brief.slug,
          title: brief.title,
          date: brief.date,
          from: FROM,
          reply_to: REPLY_TO,
          recipient_count: recipientCount,
          recipients: (subscribers || []).map((s) => s.email),
        },
      })
    }

    if (recipientCount === 0) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'No subscribers with source=subscribe',
        brief: brief.slug,
      })
    }

    // ---- Send emails ----
    const resend = new Resend(RESEND_API_KEY)
    const subject = `Artha Insights · ${brief.title}`
    const html = renderBriefHtml(brief)
    const text = renderBriefText(brief)

    let sent = 0
    const failures = []

    for (const row of subscribers) {
      try {
        await resend.emails.send({
          from: FROM,
          to: row.email,
          replyTo: REPLY_TO,
          subject,
          html,
          text,
        })
        sent++
      } catch (e) {
        failures.push({ email: row.email, error: String(e) })
      }
    }

    // ---- Record the send (prevents double-sending next week) ----
    await supabase.from('sent_briefs').insert({
      slug: brief.slug,
      title: brief.title,
      recipient_count: sent,
      test_only: false,
    })

    return res.status(200).json({
      ok: true,
      slug: brief.slug,
      title: brief.title,
      sent,
      total: recipientCount,
      failures,
      from: FROM,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Unhandled exception', detail: String(e) })
  }
}

// ---- Email rendering (matches the existing send-brief style exactly) ----

function renderBriefHtml(brief) {
  const dateLabel = formatDate(brief.date)
  const blocks = brief.body
    .map((b) => {
      switch (b.type) {
        case 'h2':
          return `<h2 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;color:#0E0E0E;margin:32px 0 12px;letter-spacing:-0.01em;">${esc(b.text)}</h2>`
        case 'h3':
          return `<h3 style="font-family:Georgia,serif;font-size:18px;font-weight:500;color:#0E0E0E;margin:24px 0 8px;">${esc(b.text)}</h3>`
        case 'quote':
          return `<blockquote style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.5;color:#0E0E0E;border-left:2px solid #6E1F1F;padding:6px 0 6px 18px;margin:24px 0;">${esc(b.text)}</blockquote>`
        case 'hr':
          return `<div style="text-align:center;margin:32px 0;color:#6E1F1F;letter-spacing:0.6em;font-size:10px;">◆ ◆ ◆</div>`
        default:
          return `<p style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.7;color:#1F1D1B;margin:0 0 18px;">${esc(b.text)}</p>`
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
      ${esc(brief.title)}
    </h1>
    <p style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.5;color:#3A3735;text-align:center;margin:0 0 32px;">
      ${esc(brief.dek)}
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
  const lines = [
    `Artha Insights — ${formatDate(brief.date)}`,
    '',
    brief.title.toUpperCase(),
    brief.dek,
    '',
    '◆ ◆ ◆',
    '',
  ]
  for (const b of brief.body) {
    if (b.type === 'h2' || b.type === 'h3') lines.push(b.text.toUpperCase(), '')
    else if (b.type === 'quote') lines.push(`"${b.text}"`, '')
    else if (b.type === 'hr') lines.push('◆ ◆ ◆', '')
    else lines.push(b.text, '')
  }
  lines.push('—', 'Editorial only · Not investment advice')
  return lines.join('\n')
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}
