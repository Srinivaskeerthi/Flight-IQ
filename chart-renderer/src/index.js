/**
 * index.js
 * Public API of the chart-renderer package.
 *
 * Import examples:
 *   import ChartRenderer            from 'chart-renderer';
 *   import { BarChart, PieChart }   from 'chart-renderer';
 *   import { useChartRenderer }     from 'chart-renderer';
 *   import { normaliseResponse }    from 'chart-renderer';
 *   import { detectResponseType }   from 'chart-renderer';
 */

// Main orchestrator
export { default }          from './components/ChartRenderer';
export { default as ChartRenderer } from './components/ChartRenderer';

// Individual chart renderers (use these if you want to skip the orchestrator)
export { default as BarChart }   from './components/charts/BarChart';
export { default as LineChart }  from './components/charts/LineChart';
export { default as PieChart }   from './components/charts/PieChart';
export { default as TableView }  from './components/charts/TableView';
export { default as TextView }   from './components/charts/TextView';

// Sub-components
export { default as TypeSwitcher }  from './components/TypeSwitcher';
export { default as ResponseMeta }  from './components/ResponseMeta';

// Hooks
export { useChartRenderer } from './hooks/useChartRenderer';

// Utilities
export { normaliseResponse }  from './utils/normaliser';
export { detectResponseType } from './utils/typeDetector';
export { detectAxes, PALETTE, BASE_HC_THEME, fmtLabel, coerceNum } from './utils/hcTheme';