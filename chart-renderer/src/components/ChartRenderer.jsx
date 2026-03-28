/**
 * ChartRenderer.jsx
 *
 * Top-level component that receives a backend JSON response and renders
 * the correct visualisation. Supports five response types:
 *   text | bar | pie | line | table
 *
 * Props
 * ─────
 *   response   {object}  – raw JSON from POST /query
 *   defaultType {string} – override auto-detected type ('bar'|'pie'|'line'|'table'|'text')
 *   height     {number}  – chart height in px (default 360)
 *   className  {string}  – extra CSS class for the wrapper
 */

import React, { useState, useCallback, useMemo } from 'react';
import BarChart   from './charts/BarChart';
import LineChart  from './charts/LineChart';
import PieChart   from './charts/PieChart';
import TableView  from './charts/TableView';
import TextView   from './charts/TextView';
import TypeSwitcher from './TypeSwitcher';
import ResponseMeta from './ResponseMeta';
import { detectResponseType } from '../utils/typeDetector';
import { normaliseResponse }  from '../utils/normaliser';
import styles from './ChartRenderer.module.css';

/* Map type → component */
const RENDERERS = {
  bar:   BarChart,
  line:  LineChart,
  pie:   PieChart,
  table: TableView,
  text:  TextView,
};

export default function ChartRenderer({
  response,
  defaultType = null,
  height      = 360,
  className   = '',
}) {
  const normalised = useMemo(() => normaliseResponse(response), [response]);
  const autoType   = useMemo(() => detectResponseType(normalised), [normalised]);

  const [activeType, setActiveType] = useState(defaultType || autoType);
  const [showCode,   setShowCode]   = useState(false);

  const handleTypeChange = useCallback((t) => setActiveType(t), []);

  if (!normalised) {
    return (
      <div className={`${styles.wrapper} ${styles.empty} ${className}`}>
        <span className={styles.emptyIcon}>⊘</span>
        <span className={styles.emptyText}>No response to render</span>
      </div>
    );
  }

  const Renderer = RENDERERS[activeType] || TextView;
  const hasData  = Array.isArray(normalised.data) && normalised.data.length > 0;

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={styles.header}>
        <TypeSwitcher
          active={activeType}
          hasData={hasData}
          onSelect={handleTypeChange}
        />

        <div className={styles.headerActions}>
          {normalised.generated_code && (
            <button
              className={`${styles.codeBtn} ${showCode ? styles.codeBtnActive : ''}`}
              onClick={() => setShowCode(v => !v)}
              aria-label="Toggle generated code"
            >
              <CodeIcon />
              <span>{showCode ? 'Hide' : 'SQL'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Generated code ─────────────────────────────────────── */}
      {showCode && normalised.generated_code && (
        <div className={styles.codePanel} role="region" aria-label="Generated pandas code">
          <div className={styles.codePanelHeader}>
            <span>Generated Query</span>
            <button
              className={styles.copyBtn}
              onClick={() => navigator.clipboard.writeText(normalised.generated_code)}
            >
              Copy
            </button>
          </div>
          <pre className={styles.codeBlock}>{normalised.generated_code}</pre>
        </div>
      )}

      {/* ── Chart / View area ──────────────────────────────────── */}
      <div className={styles.chartArea}>
        <Renderer
          data={normalised.data}
          columns={normalised.columns}
          question={normalised.question}
          interpretation={normalised.interpretation}
          height={height}
        />
      </div>

      {/* ── Footer meta ────────────────────────────────────────── */}
      <ResponseMeta normalised={normalised} />
    </div>
  );
}

function CodeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}
