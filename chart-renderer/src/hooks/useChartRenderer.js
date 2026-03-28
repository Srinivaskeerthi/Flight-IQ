/**
 * hooks/useChartRenderer.js
 *
 * Optional convenience hook that wraps ChartRenderer state management.
 * Use this if you want to control the active chart type and code-panel
 * visibility from a parent component rather than letting ChartRenderer
 * manage it internally.
 *
 * Usage:
 *   const { type, setType, showCode, toggleCode } = useChartRenderer(response);
 */

import { useState, useMemo } from 'react';
import { normaliseResponse } from '../utils/normaliser';
import { detectResponseType } from '../utils/typeDetector';

export function useChartRenderer(response, defaultType = null) {
  const normalised = useMemo(() => normaliseResponse(response), [response]);
  const autoType   = useMemo(() => detectResponseType(normalised), [normalised]);

  const [type,     setType    ] = useState(defaultType ?? autoType);
  const [showCode, setShowCode] = useState(false);

  const toggleCode = () => setShowCode(v => !v);

  return {
    normalised,
    type,
    setType,
    showCode,
    toggleCode,
    autoType,
  };
}