/**
 * useQueryChat.js
 * Custom hook that manages the full chat + query lifecycle:
 *   - message history
 *   - sending questions to POST /query via Axios
 *   - chart-type selection
 *   - loading / error state
 */

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';

const axiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

export const CHART_TYPES = ['bar', 'line', 'pie', 'table'];

/**
 * Attempt to infer a sensible chart type from the user question and
 * the shape of the returned data.
 */
function inferChartType(question = '', data = []) {
  const q = question.toLowerCase();

  if (q.includes('trend') || q.includes('over time') || q.includes('monthly') || q.includes('daily'))
    return 'line';
  if (q.includes('distribution') || q.includes('share') || q.includes('proportion') || q.includes('percent'))
    return 'pie';
  if (Array.isArray(data) && data.length > 0) {
    const keys = Object.keys(data[0] || {});
    if (keys.length >= 2) return 'bar';
  }
  return 'table';
}

export function useQueryChat() {
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [chartType, setChartType]   = useState('bar');
  const [apiKey, setApiKey]         = useState('');
  const abortRef                    = useRef(null);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), ...msg }]);
  }, []);

  const sendQuestion = useCallback(async (question) => {
    if (!question.trim() || isLoading) return;

    const userMsg = { role: 'user', text: question };
    addMessage(userMsg);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = {
        question,
        interpret: true,
        ...(apiKey ? { openai_api_key: apiKey } : {}),
      };

      const { data } = await axiosInstance.post('/query', payload, {
        signal: controller.signal,
      });

      const detectedChart = inferChartType(question, data.data);
      setChartType(detectedChart);

      addMessage({
        role: 'assistant',
        text:        data.interpretation || 'Here are the results.',
        queryResult: data,
        chartType:   detectedChart,
      });
    } catch (err) {
      if (axios.isCancel(err)) return;
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'An unknown error occurred.';
      addMessage({ role: 'error', text: `Error: ${detail}` });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [isLoading, apiKey, addMessage]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    input, setInput,
    isLoading,
    chartType, setChartType,
    apiKey, setApiKey,
    sendQuestion,
    cancelRequest,
    clearChat,
  };
}