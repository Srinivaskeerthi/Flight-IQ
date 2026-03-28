/**
 * charts/TextView.jsx
 *
 * Renders a pure text/interpretation response from the backend.
 * Used when:
 *   - The backend returns a scalar result (single number / string)
 *   - The response only contains an interpretation and no tabular data
 *   - The user explicitly selects the "text" type
 */

import React from 'react';
import styles from './TextView.module.css';

export default function TextView({ data, interpretation, question }) {
  const isScalar = data !== null && data !== undefined && !Array.isArray(data);
  const hasInterp = typeof interpretation === 'string' && interpretation.trim().length > 0;

  return (
    <div className={styles.wrapper}>
      {/* Scalar highlight */}
      {isScalar && (
        <div className={styles.scalarCard}>
          <span className={styles.scalarLabel}>RESULT</span>
          <span className={styles.scalarValue}>{formatScalar(data)}</span>
        </div>
      )}

      {/* Interpretation prose */}
      {hasInterp && (
        <div className={styles.interpretation}>
          <div className={styles.interpHeader}>
            <GlyphIcon />
            <span className={styles.interpLabel}>Analysis</span>
          </div>
          <p className={styles.interpText}>{interpretation}</p>
        </div>
      )}

      {/* Fallback */}
      {!isScalar && !hasInterp && (
        <div className={styles.fallback}>
          <span className={styles.fallbackIcon}>◈</span>
          <span className={styles.fallbackText}>No text result available</span>
        </div>
      )}
    </div>
  );
}

function formatScalar(val) {
  if (typeof val === 'number') {
    return val % 1 === 0
      ? val.toLocaleString()
      : val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(val);
}

function GlyphIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
