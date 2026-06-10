// Plain-English definitions surfaced as hover tooltips throughout the
// Allocator. The goal: a beginner can learn every concept inline without
// leaving the page, while a pro can ignore them. Keep each under ~2 sentences.

export const GLOSSARY = {
  regime:
    'The overall "weather" of the market right now — calm and rising (risk-on), choppy (neutral), falling (risk-off), or a sharp crash (crisis). The system reads it from trend, volatility, and drawdown.',
  confidence:
    'How much the system trusts its own learned view versus playing it safe. 0% means it ignores its predictions and holds the safe baseline; 100% means it fully acts on them.',
  anchor:
    'The safe default portfolio (risk parity) the system falls back to when it is unsure. Spreading risk evenly across assets, it rarely does anything dramatic — which is exactly the point.',
  risk_parity:
    'A portfolio where each asset contributes an equal amount of RISK (not equal money). Calm assets get more capital, wild ones get less, so no single bet dominates.',
  reliability:
    'A 0–1 score for how much to trust a strategy, based on how strong, consistent, and well-tested its track record is in the current regime. Low score = the system barely acts on it.',
  lcb_sharpe:
    'A pessimistic estimate of a strategy\u2019s risk-adjusted return. We deliberately use the WORST plausible value, not the best — so a strategy that just got lucky on thin data does not get rewarded.',
  momentum:
    'Buy what has been going up. A trend-following strategy that leans into assets with strong recent performance.',
  mean_reversion:
    'Buy what has fallen and sell what has spiked, betting prices snap back toward their average. The opposite of momentum.',
  sentiment:
    'A tilt driven by the mood of the news flow. Positive headlines nudge weight toward an asset; negative ones pull it back.',
  drawdown:
    'How far the portfolio has fallen from its most recent peak. A −10% drawdown means it is down a tenth from its high-water mark.',
  volatility:
    'How much an asset\u2019s price jumps around. Higher volatility = bigger swings = more risk per dollar invested.',
  regret_minimization:
    'The system\u2019s core philosophy: instead of trying to be the single best, it guarantees it will never trail the best strategy by much. It optimizes to avoid being very wrong, not to be very right.',
}

export function glossaryText(key) {
  return GLOSSARY[key] || ''
}
