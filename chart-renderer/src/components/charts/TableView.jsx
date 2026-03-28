/**
 * charts/TableView.jsx
 *
 * Full-featured sortable, filterable, paginated data table.
 * Features:
 *   - Click-column-header to sort (asc/desc)
 *   - Global filter input
 *   - Configurable page size (10 / 25 / 50)
 *   - Numeric right-alignment + formatting
 *   - CSV export
 */

import React, { useMemo, useState, useCallback } from 'react';
import styles from './TableView.module.css';

const PAGE_SIZES = [10, 25, 50];

export default function TableView({ data = [], columns = [] }) {
  const [sortKey,   setSortKey  ] = useState(null);
  const [sortDir,   setSortDir  ] = useState('asc');
  const [filter,    setFilter   ] = useState('');
  const [page,      setPage     ] = useState(0);
  const [pageSize,  setPageSize ] = useState(10);

  const cols = useMemo(
    () => (columns.length ? columns : Object.keys(data[0] ?? {})),
    [data, columns]
  );

  // Detect numeric columns for right-alignment
  const numericCols = useMemo(() => {
    const set = new Set();
    cols.forEach(c => {
      if (data.slice(0, 20).every(r => r[c] === null || r[c] === undefined || typeof r[c] === 'number'))
        set.add(c);
    });
    return set;
  }, [data, cols]);

  // Filter
  const filtered = useMemo(() => {
    if (!filter.trim()) return data;
    const q = filter.toLowerCase();
    return data.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [data, filter]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      let cmp;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageRows   = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = useCallback((key) => {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else { setSortDir('asc'); }
      return key;
    });
    setPage(0);
  }, []);

  const handleFilter = useCallback((e) => {
    setFilter(e.target.value);
    setPage(0);
  }, []);

  const handleExport = useCallback(() => {
    const header = cols.join(',');
    const rows   = data.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n');
    const blob   = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url; a.download = 'query_result.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [data, cols]);

  const fmtVal = (v, col) => {
    if (v === null || v === undefined) return <span className={styles.null}>—</span>;
    if (numericCols.has(col) && typeof v === 'number')
      return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(v);
  };

  if (!data.length) return <p className={styles.empty}>No data to display.</p>;

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterWrap}>
          <FilterIcon />
          <input
            className={styles.filterInput}
            placeholder="Filter rows…"
            value={filter}
            onChange={handleFilter}
          />
          {filter && (
            <button className={styles.clearFilter} onClick={() => setFilter('')}>✕</button>
          )}
        </div>
        <div className={styles.toolbarRight}>
          <span className={styles.countBadge}>
            {filtered.length.toLocaleString()} / {data.length.toLocaleString()} rows
          </span>
          <button className={styles.exportBtn} onClick={handleExport}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.indexTh}`}>#</th>
              {cols.map(col => (
                <th
                  key={col}
                  className={`${styles.th} ${sortKey === col ? styles.thSorted : ''} ${numericCols.has(col) ? styles.thNum : ''}`}
                  onClick={() => handleSort(col)}
                >
                  <span className={styles.thContent}>
                    <span className={styles.thLabel}>{col.replace(/_/g, ' ')}</span>
                    <span className={styles.sortIcon}>
                      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri} className={styles.tr}>
                <td className={`${styles.td} ${styles.indexTd}`}>
                  {page * pageSize + ri + 1}
                </td>
                {cols.map(col => (
                  <td
                    key={col}
                    className={`${styles.td} ${numericCols.has(col) ? styles.tdNum : ''}`}
                  >
                    {fmtVal(row[col], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className={styles.pagination}>
        <div className={styles.pageSizeWrap}>
          <span className={styles.pageSizeLabel}>Rows:</span>
          {PAGE_SIZES.map(s => (
            <button
              key={s}
              className={`${styles.pageSizeBtn} ${pageSize === s ? styles.pageSizeActive : ''}`}
              onClick={() => { setPageSize(s); setPage(0); }}
            >
              {s}
            </button>
          ))}
        </div>

        <div className={styles.pageNav}>
          <button disabled={page === 0} onClick={() => setPage(0)}>«</button>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className={styles.pageInfo}>
            {page + 1} <span className={styles.pageSep}>/</span> {totalPages}
          </span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
        </div>
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  );
}
