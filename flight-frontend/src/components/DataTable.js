import React, { useMemo, useState, useCallback } from 'react';
import './DataTable.css';

const PAGE_SIZES = [10, 25, 50];

export default function DataTable({ data = [], columns = [] }) {
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState('asc');
  const [filter, setFilter]     = useState('');
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Normalise data: plain list → [{value: item}]
  const normData = useMemo(() => {
    if (!data.length) return [];
    if (typeof data[0] !== 'object' || data[0] === null) {
      return data.map(v => ({ value: v }));
    }
    return data;
  }, [data]);

  const cols = useMemo(() => {
    if (columns && columns.length) return columns.map(String);
    if (normData.length) return Object.keys(normData[0]).map(String);
    return [];
  }, [normData, columns]);

  const numericCols = useMemo(() => {
    const s = new Set();
    cols.forEach(c => {
      if (normData.slice(0,20).every(r => r[c] === null || r[c] === undefined || typeof r[c] === 'number'))
        s.add(c);
    });
    return s;
  }, [normData, cols]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return normData;
    const q = filter.toLowerCase();
    return normData.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [normData, filter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const pageRows   = sorted.slice(page * pageSize, (page+1) * pageSize);

  const handleSort = useCallback((key) => {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else setSortDir('asc');
      return key;
    });
    setPage(0);
  }, []);

  const handleExport = useCallback(() => {
    const h = cols.join(',');
    const r = normData.map(row => cols.map(c => JSON.stringify(row[c] ?? '')).join(',')).join('\n');
    const blob = new Blob([h+'\n'+r], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'data.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [normData, cols]);

  const fmt = (v, col) => {
    if (v === null || v === undefined) return <span className="dt-null">—</span>;
    if (numericCols.has(col) && typeof v === 'number')
      return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(v);
  };

  if (!normData.length) return <p className="dt-empty">No data.</p>;

  return (
    <div className="dt">
      <div className="dt-bar">
        <div className="dt-filter-wrap">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3d6b5e" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <input className="dt-filter" placeholder="Filter…" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} />
          {filter && <button className="dt-clr" onClick={() => setFilter('')}>✕</button>}
        </div>
        <div className="dt-right">
          <span className="dt-cnt">{filtered.length.toLocaleString()} / {normData.length.toLocaleString()}</span>
          <button className="dt-exp" onClick={handleExport}>↓ CSV</button>
        </div>
      </div>

      <div className="dt-scroll">
        <table className="dt-table">
          <thead className="dt-thead">
            <tr>
              <th className="dt-th dt-th-idx">#</th>
              {cols.map(col => (
                <th key={col}
                  className={`dt-th ${sortKey === col ? 'sorted' : ''} ${numericCols.has(col) ? 'dt-th-num' : ''}`}
                  onClick={() => handleSort(col)}>
                  {String(col).replace(/_/g,' ')}
                  <span className="dt-sort">{sortKey===col ? (sortDir==='asc'?'↑':'↓') : ' ⇅'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri} className="dt-tr">
                <td className="dt-td dt-td-idx">{page*pageSize+ri+1}</td>
                {cols.map(col => (
                  <td key={col} className={`dt-td ${numericCols.has(col) ? 'dt-td-num' : ''}`}>
                    {fmt(row[col], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="dt-page">
          <div className="dt-sizes">
            <span className="dt-sz-lbl">Rows:</span>
            {PAGE_SIZES.map(s => (
              <button key={s} className={`dt-sz ${pageSize===s?'on':''}`}
                onClick={() => { setPageSize(s); setPage(0); }}>{s}</button>
            ))}
          </div>
          <div className="dt-nav">
            <button className="dt-nb" disabled={page===0} onClick={() => setPage(0)}>«</button>
            <button className="dt-nb" disabled={page===0} onClick={() => setPage(p=>p-1)}>‹</button>
            <span className="dt-pi">{page+1} / {totalPages}</span>
            <button className="dt-nb" disabled={page>=totalPages-1} onClick={() => setPage(p=>p+1)}>›</button>
            <button className="dt-nb" disabled={page>=totalPages-1} onClick={() => setPage(totalPages-1)}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}