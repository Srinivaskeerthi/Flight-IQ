/**
 * charts/LineChart.jsx
 *
 * Renders a line chart using Highcharts.
 * Supports:
 *   - single series
 *   - multi-series (one category col, multiple numeric cols)
 *   - area fill toggling (auto-enabled for single series)
 *   - smooth spline curves
 */

import React, { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { detectAxes, PALETTE, BASE_HC_THEME, fmtLabel, coerceNum } from '../../utils/hcTheme';
import styles from './Chart.module.css';

export default function LineChart({ data = [], columns = [], question = '', height = 360 }) {
  const [spline, setSpline] = useState(true);
  const [area,   setArea  ] = useState(false);

  const options = useMemo(() => {
    if (!data.length) return null;

    const { catKey, valKeys } = detectAxes(data, columns);
    if (!catKey || !valKeys.length) return null;

    const isMulti   = valKeys.length > 1;
    const chartType = area ? (spline ? 'areaspline' : 'area') : (spline ? 'spline' : 'line');

    const series = valKeys.map((k, i) => ({
      name:      fmtLabel(k),
      type:      chartType,
      data:      data.map(r => coerceNum(r[k])),
      color:     PALETTE[i % PALETTE.length],
      lineWidth: 2.5,
      marker:    { enabled: data.length <= 40, radius: 4, symbol: 'circle' },
      fillOpacity: 0.12,
      ...(area && i === 0 ? {
        fillColor: {
          linearGradient: { x1:0, y1:0, x2:0, y2:1 },
          stops: [
            [0, Highcharts.color(PALETTE[i]).setOpacity(0.25).get()],
            [1, Highcharts.color(PALETTE[i]).setOpacity(0).get()],
          ],
        },
      } : {}),
    }));

    const categories = data.map(r => String(r[catKey] ?? ''));

    return {
      ...BASE_HC_THEME,
      chart: {
        ...BASE_HC_THEME.chart,
        type:   chartType,
        height,
        animation: { duration: 700, easing: 'easeOutQuart' },
      },
      title: { text: null },
      xAxis: {
        categories,
        labels: {
          style:    { color: '#8b949e', fontSize: '11px', fontFamily: "'Share Tech Mono', monospace" },
          rotation: data.length > 12 ? -35 : 0,
          formatter() {
            const v = String(this.value);
            return data.length > 20 && v.length > 8 ? v.slice(0, 7) + '…' : v;
          },
        },
        lineColor:  '#1e2d3d',
        tickColor:  '#1e2d3d',
        gridLineColor: 'transparent',
      },
      yAxis: {
        title:  { text: isMulti ? null : fmtLabel(valKeys[0]), style: { color: '#484f58' } },
        labels: { style: { color: '#8b949e', fontSize: '11px' } },
        gridLineColor: '#1e2d3d',
      },
      plotOptions: {
        series: { connectNulls: true },
      },
      legend: { ...BASE_HC_THEME.legend, enabled: isMulti },
      series,
    };
  }, [data, columns, height, spline, area]);

  if (!options) return <Empty />;

  return (
    <div className={styles.chartWrap}>
      {/* Mini controls */}
      <div className={styles.lineControls}>
        <Toggle label="Smooth" active={spline} onToggle={() => setSpline(v => !v)} />
        <Toggle label="Area"   active={area}   onToggle={() => setArea(v => !v)}   />
      </div>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        containerProps={{ style: { width: '100%' } }}
      />
    </div>
  );
}

function Toggle({ label, active, onToggle }) {
  return (
    <button
      className={`${styles.toggleBtn} ${active ? styles.toggleActive : ''}`}
      onClick={onToggle}
    >
      {label}
    </button>
  );
}

function Empty() {
  return <p className={styles.empty}>Cannot render line chart — no numeric columns found.</p>;
}
