"""
analysis.py
Executes pandas query strings produced by the LLM against the merged
DataFrame and converts results to JSON-serialisable structures.
"""

import pandas as pd
import numpy as np
import logging
from typing import Any

logger = logging.getLogger(__name__)


class QueryExecutionError(Exception):
    """Raised when a generated query fails to execute."""


def _make_serialisable(obj: Any) -> Any:
    if isinstance(obj, (np.integer,)):        return int(obj)
    if isinstance(obj, (np.floating,)):       return float(obj)
    if isinstance(obj, (np.bool_,)):          return bool(obj)
    if isinstance(obj, (np.ndarray,)):        return obj.tolist()
    if isinstance(obj, pd.Timestamp):         return obj.isoformat()
    if isinstance(obj, pd.Period):            return str(obj)
    if isinstance(obj, float) and np.isnan(obj): return None
    if obj is pd.NA:                          return None
    if isinstance(obj, dict):  return {k: _make_serialisable(v) for k, v in obj.items()}
    if isinstance(obj, list):  return [_make_serialisable(i) for i in obj]
    return obj


def execute_query(df: pd.DataFrame, code: str) -> dict:
    """
    Execute a pandas expression / code block against *df* inside a
    restricted local namespace and return a JSON-friendly result dict.

    The LLM is expected to produce code that assigns its final result to a
    variable called ``result``.  If the generated code does not set
    ``result``, we try to evaluate the last expression directly.

    Parameters
    ----------
    df : pd.DataFrame
        The merged flight bookings DataFrame.
    code : str
        Python / pandas code string produced by the LLM.

    Returns
    -------
    dict
        {
            "data": <list | scalar | dict>,
            "columns": <list[str] | None>,
            "row_count": <int | None>,
            "executed_code": <str>
        }

    Raises
    ------
    QueryExecutionError
        If the code raises an exception during execution.
    """
    logger.info("Executing generated code:\n%s", code)

    local_ns: dict[str, Any] = {"df": df, "pd": pd, "np": np}

    try:
        exec(code, {"__builtins__": __builtins__}, local_ns)  # noqa: S102
    except Exception as exc:
        raise QueryExecutionError(
            f"Query execution failed: {exc}\n\nGenerated code:\n{code}"
        ) from exc

    raw_result = local_ns.get("result")

    # If the code didn't produce a 'result' variable, try the last line as an
    # expression (best-effort fallback).
    if raw_result is None:
        last_line = code.strip().splitlines()[-1].strip()
        try:
            raw_result = eval(last_line, {"__builtins__": __builtins__}, local_ns)  # noqa: S307
        except Exception:
            raw_result = None

    return _format_result(raw_result, code)


def _format_result(raw_result: Any, code: str) -> dict:
    """Convert a raw pandas / Python value into a response dict."""
    if isinstance(raw_result, pd.DataFrame):
        data = raw_result.to_dict(orient="records")
        return {
            "data": _make_serialisable(data),
            "columns": list(raw_result.columns),
            "row_count": len(raw_result),
            "executed_code": code,
        }

    if isinstance(raw_result, pd.Series):
        data = raw_result.reset_index().to_dict(orient="records")
        return {
            "data": _make_serialisable(data),
            "columns": list(raw_result.reset_index().columns),
            "row_count": len(raw_result),
            "executed_code": code,
        }
    
     # Convert plain list to list of dicts
    if isinstance(raw_result, list):
        data = [{"value": _make_serialisable(v)} for v in raw_result]
        return {
            "data": data,
            "columns": ["value"],
            "row_count": len(data),
            "executed_code": code,
        }

    # Scalar or other primitive
    return {
        "data": _make_serialisable(raw_result),
        "columns": None,
        "row_count": None,
        "executed_code": code,
    }