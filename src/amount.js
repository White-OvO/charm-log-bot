const MULTIPLIERS = { k: 1_000, m: 1_000_000 };

// Accepts "250000", "250,000", "250k", "1.5m". Returns a non-negative integer or null.
function parseAmount(input) {
  const cleaned = String(input).trim().replace(/,/g, '');
  const match = /^(\d+(?:\.\d+)?)\s*([km])?$/i.exec(cleaned);
  if (!match) return null;
  const multiplier = MULTIPLIERS[match[2]?.toLowerCase()] ?? 1;
  const value = Math.round(Number(match[1]) * multiplier);
  return Number.isSafeInteger(value) ? value : null;
}

module.exports = { parseAmount };
