/**
 * utils/hcTheme.js
 *
 * Shared Highcharts base theme, colour palette, axis-detection heuristic,
 * and formatting helpers used by all chart renderers.
 */

// ── Colour palette (aviation-terminal) ────────────────────────────────────
export const PALETTE = [
  '#f5a623', // amber
  '#39d353', // green
  '#58a6ff', // blue
  '#ff6b6b', // red
  '#c084fc', // purple
  '#34d399', // teal
  '#fb923c', // orange
  '#e879f9', // pink
  '#22d3ee', // cyan
  '#a3e635', // lime
  '#fbbf24', // yellow
  '#818cf8', // indigo
];

// ── Base Highcharts theme ─────────────────────────────────────────────────
export const BASE_HC_THEME = {
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: "'DM Sans', sans-serif" },
    spacing: [12, 12, 12, 12],
  },
  title:  { text: null, style: { color: '#e6edf3', fontSize: '14px' } },
  subtitle: { style: { color: '#8b949e' } },
  legend: {
    enabled:        true,
    itemStyle:      { color: '#8b949e', fontWeight: '400', fontSize: '12px' },
    itemHoverStyle: { color: '#e6edf3' },
    backgroundColor: 'transparent',
  },
  tooltip: {
    backgroundColor: '#131a22',
    borderColor:     '#2a3f54',
    borderRadius:    8,
    shadow:          false,
    style:           { color: '#e6edf3', fontSize: '13px' },
    headerFormat:    '<span style="font-family:\'Share Tech Mono\',monospace;font-size:11px;color:#8b949e">{point.key}</span><br/>',
    pointFormat:     '<span style="color:{point.color}">●</span> {series.name}: <b>{point.y}</b><br/>',
  },
  credits:  { enabled: false },
  colors:   PALETTE,
  exporting: { enabled: false },
};

// ── Axis detection ────────────────────────────────────────────────────────

/**
 * Detect which column to use as the category axis and which columns
 * are numeric (value axes).
 *
 * Strategy:
 *   1. If an explicit columns list is provided, respect it.
 *   2. First column whose values are not all numbers → category axis.
 *   3. All remaining numeric columns → value axes (up to 5).
 *
 * @param {object[]} data
 * @param {string[]} columns
 * @returns {{ catKey: string|null, valKeys: string[] }}
 */
export function detectAxes(data, columns = []) {
  if (!data.length) return { catKey: null, valKeys: [] };

  const keys = columns.length ? columns : Object.keys(data[0]);

  // Determine numeric-ness per column (sample first 20 rows)
  const sample = data.slice(0, 20);
  const isNumeric = (key) =>
    sample.every(r => r[key] === null || r[key] === undefined || typeof r[key] === 'number');

  let catKey  = null;
  const valKeys = [];

  for (const key of keys) {
    if (!catKey && !isNumeric(key)) {
      catKey = key;
    } else if (isNumeric(key) && valKeys.length < 5) {
      valKeys.push(key);
    }
  }

  // Fallback: if every column is numeric, use the first as category
  if (!catKey && valKeys.length > 0) {
    catKey = valKeys.shift();
  }

  return { catKey, valKeys };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Convert column_name → Column Name */
export function fmtLabel(key = '') {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Safely coerce to number (returns null for non-numeric) */
export function coerceNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}