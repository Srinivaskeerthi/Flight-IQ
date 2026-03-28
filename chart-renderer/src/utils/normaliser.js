/**
 * utils/normaliser.js
 *
 * Normalises the raw JSON response from POST /query into a consistent shape
 * that all renderers can depend on.
 *
 * Input shapes handled:
 *   A) Standard /query response
 *      { question, generated_code, data, columns, row_count, interpretation }
 *
 *   B) Bare array
 *      [ { col: val, … }, … ]
 *
 *   C) Scalar wrapper
 *      { data: 42 } or { result: "some text" }
 *
 *   D) Error shape
 *      { detail: "…" } or { error: "…" }
 *
 * Output shape (always):
 * {
 *   question:        string | null
 *   generated_code:  string | null
 *   data:            object[] | null   (null for scalars)
 *   columns:         string[] | null
 *   row_count:       number | null
 *   interpretation:  string | null
 *   scalar:          any              (non-null for scalar results)
 *   error:           string | null
 * }
 */

export function normaliseResponse(raw) {
  if (raw === null || raw === undefined) return null;

  // Bare array
  if (Array.isArray(raw)) {
    const cols = raw.length ? Object.keys(raw[0]) : [];
    return base({
      data:      raw,
      columns:   cols,
      row_count: raw.length,
    });
  }

  if (typeof raw !== 'object') {
    // Primitive scalar passed directly
    return base({ scalar: raw });
  }

  // Error shape
  if (raw.detail || raw.error) {
    return base({ error: raw.detail ?? raw.error });
  }

  // Standard /query response
  const {
    question        = null,
    generated_code  = null,
    data            = null,
    columns         = null,
    row_count       = null,
    interpretation  = null,
  } = raw;

  // data may be array (tabular), scalar, or null
  if (Array.isArray(data)) {
    const derivedCols = columns ?? (data.length ? Object.keys(data[0]) : []);
    return base({
      question,
      generated_code,
      data,
      columns:    derivedCols,
      row_count:  row_count ?? data.length,
      interpretation,
    });
  }

  // Scalar data
  if (data !== null && data !== undefined) {
    return base({
      question,
      generated_code,
      scalar: data,
      interpretation,
    });
  }

  // Interpretation-only (text answer from LLM with no tabular result)
  return base({
    question,
    generated_code,
    interpretation: interpretation ?? (typeof raw.result === 'string' ? raw.result : null),
  });
}

// ── Helper ────────────────────────────────────────────────────────────────

function base(overrides = {}) {
  return {
    question:       null,
    generated_code: null,
    data:           null,
    columns:        null,
    row_count:      null,
    interpretation: null,
    scalar:         undefined,
    error:          null,
    ...overrides,
  };
}