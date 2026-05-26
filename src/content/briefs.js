// Briefs are written here as plain JS objects for v1.
// Each Brief has a slug (URL), title, dek, date, readTime, and body (array of blocks).
// Blocks: { type: 'p' | 'h2' | 'h3' | 'quote' | 'hr', text }
// We'll migrate to MDX once the rhythm is established.

export const BRIEFS = [
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
