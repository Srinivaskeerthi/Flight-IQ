/**
 * TypeSwitcher.jsx
 * Tab-strip for switching between chart types.
 * Only shows chart options (bar/line/pie) when `hasData` is true.
 */

import React from 'react';
import styles from './TypeSwitcher.module.css';

const TYPES = [
  { id: 'text',  label: 'Text',  icon: '◈' },
  { id: 'bar',   label: 'Bar',   icon: '▬' },
  { id: 'line',  label: 'Line',  icon: '〰' },
  { id: 'pie',   label: 'Pie',   icon: '◉' },
  { id: 'table', label: 'Table', icon: '⊞' },
];

export default function TypeSwitcher({ active, hasData, onSelect }) {
  const visible = hasData ? TYPES : TYPES.filter(t => t.id === 'text');

  return (
    <nav className={styles.switcher} role="tablist" aria-label="Chart type">
      {visible.map(({ id, label, icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          className={`${styles.tab} ${active === id ? styles.active : ''}`}
          onClick={() => onSelect(id)}
        >
          <span className={styles.icon}>{icon}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
