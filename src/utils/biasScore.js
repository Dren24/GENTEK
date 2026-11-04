// ── biasBreakdown — splits the overall bias score between male- and
// female-biased detections in proportion to how many of each were found, so
// Male % + Female % + Gender-Neutral % is always exactly 100. The overall
// score and classification are unchanged; these are shares of that score, not
// probabilities or confidences. Mirrors bias_breakdown() in backend/analyzer.py.
export function biasBreakdown(score, male, female) {
  const total = male + female
  if (!total || !score) return { malePct: 0, femalePct: 0, neutralPct: 100 }
  const malePct = Math.floor((score * male) / total + 0.5)
  return { malePct, femalePct: score - malePct, neutralPct: 100 - score }
}
