// Briefs are written here as plain JS objects for v1.
// Each Brief has a slug (URL), title, dek, date, readTime, and body (array of blocks).
// Blocks: { type: 'p' | 'h2' | 'h3' | 'quote' | 'hr', text }
// We'll migrate to MDX once the rhythm is established.

export const BRIEFS = [
  {
    slug: 'when-the-rotation-meets-the-rupee',
    pillar: 'Brief',
    title: 'When the rotation meets the rupee',
    dek: 'Two weeks after the quiet rotation began, the rupee is the new variable in the room.',
    date: '2026-06-01',
    readTime: '8 min read',
    body: [
      { type: 'p', text: "Two weeks ago in this Brief, I wrote that foreign flows had quietly turned positive on Indian midcaps — that the rotation was in the data before it was in the press. Since then, the rotation hasn't reversed. But it has acquired company. The rupee, sitting near 95.7 to the dollar this morning, has now drifted weaker for ten straight sessions. NIFTY is down half a percent on the week. India VIX, oddly, just collapsed three and a half percent in a single session." },
      { type: 'p', text: "On their own, none of these moves are large. Read together, they tell a more interesting story." },
      { type: 'h2', text: "What's actually happening" },
      { type: 'p', text: "The rotation I described two weeks ago was foreign institutional buying creeping back into liquidity-adjusted midcaps — names that had been unloved precisely because they were illiquid enough to hurt during DII redemptions. That trade is still working. The factor signal is still there. The capital is still patient." },
      { type: 'p', text: "What's new is the rupee. A weakening rupee changes the maths for the foreign investor in ways most retail commentary skips over. Every percent the rupee loses against the dollar is a percent of return the FII has to claw back from the underlying stock just to break even in dollar terms. Ten sessions of drift adds up. At some point it stops being a quiet tailwind and becomes a soft headwind on the same trade that's working in INR." },
      { type: 'p', text: "The fact that VIX dropped while equities also drifted down is the tell. Markets aren't pricing in a violent move. They're pricing in slow, deliberate selling — the kind a foreign desk does when they trim positions methodically rather than bail." },
      { type: 'h2', text: "What the model sees, two weeks later" },
      { type: 'p', text: "The same factor decomposition I ran two weeks ago — momentum, quality, liquidity-adjusted size — now shows liquidity-adjusted size losing some of its dominant edge. Not crashing. Just sharing the spotlight. Quality has crept up. That's a meaningfully different signal." },
      { type: 'p', text: "When liquidity-adjusted size is the dominant factor, the trade is: buy the unloved illiquid name before everyone else figures it out. When quality starts gaining, the trade shifts: buy companies with clean balance sheets and visible cash generation, even if they're more crowded. The market is starting to ask harder questions of the names it was happy to accumulate quietly four weeks ago." },
      { type: 'quote', text: 'A weak currency makes patient capital impatient. Slowly, then all at once.' },
      { type: 'h2', text: "What it means for the rest of us" },
      { type: 'p', text: "If you're a salaried investor with a SIP into a midcap fund, the same answer holds: do nothing. Your fund manager has already adjusted, or will, and you reading this Brief on a Sunday morning is not how alpha is captured." },
      { type: 'p', text: "If you're an active investor, the watch-this-week list is short. Three names: the rupee, FII flow data, and quality factor names that have been compounding without much fanfare. If the rupee stabilises around 95-96, the rotation continues. If it cracks 97, the rotation breaks and we have a different conversation in this Brief next week." },
      { type: 'p', text: "If you're a founder or operator raising right now, the takeaway is more uncomfortable. Foreign LPs writing dollar cheques are doing the same maths the FIIs are. Patient capital from abroad is becoming meaningfully more expensive in real terms even when the headline cheque size stays the same. Cleaner cap tables and tighter operating discipline aren't a nice-to-have anymore. They're the price of the meeting." },
      { type: 'hr' },
      { type: 'p', text: "I'll keep tracking the same signal weekly. The rotation that started quietly is now negotiating with the currency. Whichever wins decides what midcaps look like by July." },
    ],
  },
  {
    slug: 'the-quiet-rotation',
    pillar: 'Brief',
    title: 'The Quiet Rotation',
    dek: 'Why FII flows are reversing without a headline, and what the model says about midcaps.',
    date: '2026-05-25',
    readTime: '7 min read',
    body: [
      { type: 'p', text: "For three weeks, foreign institutional investors have been net buyers of Indian equities. The headlines barely noticed. The reversal was not loud. It came in tranches small enough to stay below the noise floor of TV news, but consistent enough that any factor model running on flow data started flagging it by mid-April." },
      { type: 'p', text: "On the street, conversations with three early-stage founders and one mid-market PE associate this past week told a parallel story: deal pipelines are warming, but on different terms. Cleaner cap tables. Smaller rounds. Operators who want investors who actually understand the business, not just the deck. That is not the language of euphoria. It is the language of selectivity." },
      { type: 'h2', text: 'What the model sees' },
      { type: 'p', text: "Running a simple factor decomposition on the NIFTY Midcap 150 over the past 60 trading days, the dominant signal is not momentum or quality. It is liquidity-adjusted size. Names that were unloved in March because they were too illiquid to absorb DII redemptions are now precisely the names quietly being accumulated." },
      { type: 'p', text: "That is what a rotation without a narrative looks like. The story will arrive eventually. Stories always do. By then the trade will be obvious to everyone, and the easy beta will be gone." },
      { type: 'quote', text: 'When the rotation is in the data before it is in the press, the trade is already half over for the people who only read the press.' },
      { type: 'h2', text: 'What it means for the rest of us' },
      { type: 'p', text: "If you are a salaried investor with a SIP into a midcap fund, this is not a signal to do anything. The trade you would make is already inside your fund manager's book — or it should be. If you are an active investor running your own bottom-up book, the read is this: the cheapest beta in the market right now is not where the screens are showing red. It is where the screens are showing nothing." },
      { type: 'p', text: "And if you are a founder watching this, the quieter takeaway is that capital is becoming patient again. Slowly. The aggressive 2021-style cheques are gone, but the better cheques — the ones that compound your business rather than your headline — are coming back into the conversation. Build for those." },
      { type: 'hr' },
      { type: 'p', text: "I will be tracking the same factor signal weekly from here on. If the rotation breaks down, you will read about it here before it shows up anywhere else. If it accelerates, the same. That is the deal." },
    ],
  },
]

export function getBriefBySlug(slug) {
  return BRIEFS.find((b) => b.slug === slug)
}
