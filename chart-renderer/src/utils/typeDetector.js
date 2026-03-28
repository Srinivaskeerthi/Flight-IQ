/**
 * utils/typeDetector.js
 *
 * Analyses a normalised backend response and returns the most appropriate
 * chart type: 'text' | 'bar' | 'line' | 'pie' | 'table'
 *
 * Detection priority:
 *   1. Scalar / no tabular data         → text
 *   2. Time-series hints in question    → line
 *   3. Proportion hints in question     → pie
 *   4. Short categorical result (≤20 r) → bar
 *   5. Long / multi-col result          → table
 */

const TIME_KEYWORDS = [
  'trend', 'over time', 'monthly', 'daily', 'weekly', 'annual',
  'yearly', 'by month', 'by day', 'by week', 'by year', 'timeline',
  'per month', 'per day', 'growth', 'evolution', 'series',
];

const PIE_KEYWORDS = [
  'distribution', 'share', 'proportion', 'percent', 'percentage',
  'breakdown', 'composition', 'split', 'ratio', 'fraction',
];

/**
 * @param {object} normalised  – output of normaliseResponse()
 * @returns {string}           – one of 'text' | 'bar' | 'line' | 'pie' | 'table'
 */
export function detectResponseType(normalised) {
  if (!normalised) return 'text';

  const { data, columns, question = '', interpretation } = normalised;

  // 1. No array data → text
  if (!Array.isArray(data) || data.length === 0) return 'text';

  const q     = (question || '').toLowerCase();
  const nCols = (columns ?? Object.keys(data[0] ?? {})).length;
  const nRows = data.length;

  // 2. Time-series
  if (TIME_KEYWORDS.some(kw => q.includes(kw))) return 'line';

  // 3. Proportion / pie
  if (PIE_KEYWORDS.some(kw => q.includes(kw)) && nRows <= 15) return 'pie';

  // 4. Short categorical → bar
  if (nRows <= 20 && nCols <= 3) return 'bar';

  // 5. Multi-column or long → table
  if (nCols > 4 || nRows > 50) return 'table';

  // Default to bar for medium-sized 2-col results
  return 'bar';
}