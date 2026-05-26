// Briefs are written here as plain JS objects for v1.
// Each Brief has a slug (URL), title, dek, date, readTime, and body (array of blocks).
// Blocks: { type: 'p' | 'h2' | 'h3' | 'quote' | 'hr', text }

export const BRIEFS = [
  {
    slug: 'the-rotation-revisited',
    pillar: 'Brief',
    title: 'The Rotation, Revisited',
    dek: 'Two weeks on, the quiet trade has become the loud one. What the model says about the next leg.',
    date: '2026-06-01',
    readTime: '5 min read',
    body: [
      { type: 'p', text: 'Two weeks ago in this letter, the thesis was simple. Foreign institutional investors had quietly turned net buyers of Indian equities. The factor model was flagging liquidity-adjusted size as the dominant signal in midcaps. The trade was real, but the story had not arrived. That was the edge.' },
      { type: 'p', text: "The story has now arrived. The financial press caught up by mid last week. Twitter discovered it. The midcap names that were quietly being accumulated through April are now in everyone's screener. And, as the script demands, the index closed lower this week. NIFTY printed 23,913, down half a percent. Sensex followed. Volatility eased — VIX off another three percent — which is the tell that the move was less panic and more digestion." },
      { type: 'h2', text: 'What the model is showing now' },
      { type: 'p', text: 'The factor decomposition has shifted. Liquidity-adjusted size is no longer the dominant driver. It has been replaced by quality. In plain language: the easy beta in unloved small names has been bought, and the marginal buyer is now choosing companies with cleaner balance sheets and steadier cash flow. The market is becoming more selective inside the same upward bias.' },
      { type: 'p', text: 'This is exactly what the previous letter warned about. The quiet trade was already half over by the time the headlines arrived. If you were buying the basket on the basis of last fortnight\u2019s signal, you have probably had your move. The next leg is narrower, slower, and rewards picking rather than baskets.' },
      { type: 'quote', text: 'Every rotation goes through three phases \u2014 flow, narrative, exhaustion. We are now squarely in narrative. Exhaustion is what comes next, and it does not announce itself either.' },
      { type: 'h2', text: 'What it means' },
      { type: 'p', text: 'If you are running a SIP, this letter does not change your behaviour. It never does. That is the discipline of the SIP and exactly why it works.' },
      { type: 'p', text: 'If you are running an active book, the trade is to do less. Most of the obvious basket beta is gone. The temptation will be to chase the next wave of small-cap stories that are already trending on Twitter. Resist it. The model says the market is rewarding quality from here, not boldness.' },
      { type: 'p', text: 'If you are a founder watching this from the other side of the cap table, the read is the same one as last fortnight, just louder. The capital coming back is the patient kind. Build for those investors. The headline rounds will return eventually \u2014 they always do \u2014 but the ones that matter for the next decade are the disciplined ones being written now.' },
      { type: 'hr' },
      { type: 'p', text: 'Next Sunday: an early read on what the model expects out of Q1 FY27 earnings, and the three sectors where its signal is most divergent from consensus. Until then.' },
    ],
  },
  {
    slug: 'the-quiet-rotation',
    pillar: 'Brief',
    title: 'The Quiet Rotation',
    dek: 'Why FII flows are reversing without a headline, and what the model says about midcaps.',
    date: '2026-05-25',
    readTime: '6 min read',
    body: [
      { type: 'p', text: 'For three weeks, foreign institutional investors have been net buyers of Indian equities. The headlines barely noticed. The reversal was not loud. It came in tranches small enough to stay below the noise floor of TV news, but consistent enough that any factor model running on flow data started flagging it by mid-April.' },
      { type: 'h2', text: 'What the model sees' },
      { type: 'p', text: 'Running a simple factor decomposition on the NIFTY Midcap 150 over the past 60 trading days, the dominant signal is not momentum or quality. It is liquidity-adjusted size. Names that were unloved in March because they were too illiquid to absorb DII redemptions are now precisely the names quietly being accumulated.' },
      { type: 'p', text: 'That is what a rotation without a narrative looks like. The story will arrive eventually. Stories always do. By then the trade will be obvious to everyone, and the easy beta will be gone.' },
      { type: 'quote', text: 'When the rotation is in the data before it is in the press, the trade is already half over for the people who only read the press.' },
      { type: 'h2', text: 'What it means for the rest of us' },
      { type: 'p', text: 'If you are a salaried investor with a SIP into a midcap fund, this is not a signal to do anything. The trade you would make is already inside your fund manager\u2019s book \u2014 or it should be. If you are an active investor running your own bottom-up book, the read is this: the cheapest beta in the market right now is not where the screens are showing red. It is where the screens are showing nothing.' },
      { type: 'p', text: 'And if you are a founder watching this, the quieter takeaway is that capital is becoming patient again. Slowly. The aggressive 2021-style cheques are gone, but the better cheques \u2014 the ones that compound your business rather than your headline \u2014 are coming back into the conversation. Build for those.' },
      { type: 'hr' },
      { type: 'p', text: 'I will be tracking the same factor signal weekly from here on. If the rotation breaks down, you will read about it here before it shows up anywhere else. If it accelerates, the same. That is the deal.' },
    ],
  },
]

export function getBriefBySlug(slug) {
  return BRIEFS.find((b) => b.slug === slug)
}
