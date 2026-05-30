/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Return the candidate string closest to `input` by Levenshtein distance,
 * case-insensitively, or `undefined` if nothing is close enough. The
 * threshold is `floor(max(input.length, candidate.length) / 3)` (minimum 1),
 * so very different strings don't produce confusing "did you mean..."
 * suggestions. Used for unknown-name diagnostics (config keys, given
 * surface names, etc.).
 */
export function closestMatch(
  input: string,
  candidates: string[]
): string | undefined {
  if (candidates.length === 0) return undefined;
  let best = candidates[0];
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = levenshtein(input.toLowerCase(), c.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  const maxDist = Math.max(
    1,
    Math.floor(Math.max(input.length, best.length) / 3)
  );
  return bestDist <= maxDist ? best : undefined;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({length: m + 1}, () =>
    Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}
