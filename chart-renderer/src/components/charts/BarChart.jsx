/**
 * charts/BarChart.jsx
 *
 * Renders a horizontal bar chart using Highcharts.
 * Supports:
 *   - single-series (one numeric column)
 *   - multi-series (multiple numeric columns, one category column)
 *   - stacked mode (auto-enabled when > 2 series)
 */

import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { detectAxes, PALETTE, BASE_HC_THEME, fmtLabel, coerceNum } from '../../utils/hcTheme';
import styles from './Chart.module.css';

export default function BarChart({ data = [], columns = [], question = '', height = 360 }) {
  const options = useMemo(() => {
    if (!data.length) return null;

    const { catKey, valKeys } = detectAxes(data, columns);
    if (!catKey || !valKeys.length) return null;

    const categories = data.map(r => String(r[catKey] ?? ''));
    const isMulti    = valKeys.length > 1;
    const isStacked  = valKeys.length > 2;

    const series = valKeys.map((k, i) => ({
      name:  fmtLabel(k),
      type:  'bar',
      data:  data.map(r => coerceNum(r[k])),
      color: PALETTE[i % PALETTE.length],
      borderRadius: isMulti ? 2 : 5,
      dataLabels: {
        enabled:   !isMulti,
        style:     { color: '#e6edf3', fontSize: '11px', textOutline: 'none', fontWeight: '400' },
        formatter() { return this.y >= 1000 ? `${(this.y/1000).toFixed(1)}k` : this.y?.toFixed(1); },
      },
    }));

    return {
      ...BASE_HC_THEME,
      chart: {
        ...BASE_HC_THEME.chart,
        type:   'bar',
        height,
        animation: { duration: 600, easing: 'easeOutQuart' },
      },
      title:    { ...BASE_HC_THEME.title, text: null },
      xAxis: {
        categories,
        labels: {
          style:    { color: '#8b949e', fontSize: '12px', fontFamily: "'Share Tech Mono', monospace" },
          formatter() { return this.value.length > 20 ? this.value.slice(0,18)+'…' : this.value; },
        },
        lineColor:  '#1e2d3d',
        tickColor:  '#1e2d3d',
        gridLineColor: 'transparent',
      },
      yAxis: {
        title:      { text: isMulti ? null : fmtLabel(valKeys[0]), style: { color: '#484f58', fontSize: '11px' } },
        labels:     { style: { color: '#8b949e', fontSize: '11px' } },
        gridLineColor: '#1e2d3d',
        stackLabels: isStacked ? {
          enabled: true,
          style:   { color: '#e6edf3', fontWeight: '400', textOutline: 'none', fontSize: '11px' },
        } : { enabled: false },
      },
      plotOptions: {
        bar: {
          stacking:    isStacked ? 'normal' : undefined,
          groupPadding: 0.08,
          pointPadding: 0.04,
        },
      },
      legend: {
        ...BASE_HC_THEME.legend,
        enabled: isMulti,
      },
      series,
    };
  }, [data, columns, height]);

  if (!options) return <Empty />;

  return (
    <div className={styles.chartWrap}>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        containerProps={{ style: { width: '100%' } }}
      />
    </div>
  );
}

function Empty() {
  return <p className={styles.empty}>Cannot render bar chart — no numeric columns found.</p>;
}
