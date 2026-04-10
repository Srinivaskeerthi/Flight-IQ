"""
main.py
FastAPI entry point for FlightIQ backend.
Fetches data from PostgreSQL, generates SQL via LLM, executes, and interprets.
"""

from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os
import re
import logging
from typing import Optional, Any

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import engine
from llm_agent import LLMConfig, generate_sql_query, interpret_result

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════

app = FastAPI(title="FlightIQ API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm_config = LLMConfig(api_key=os.getenv("OPENAI_API_KEY", ""))


# ═══════════════════════════════════════════════════════════════
# KNOWN COLUMN ALIASES — fix common LLM mistakes
# ═══════════════════════════════════════════════════════════════

SQL_FIXES = {
    "airline_nm":          "airline_name",
    "airline_name_name":   "airline_name",
    "fare_amount":         "fare",
    "loyalty_points":      "loyalty_pts",
    "flight_number":       "flght_no",
    "flight_no":           "flght_no",
    "passenger_name":      "passngr_nm",
    "passenger":           "passngr_nm",
    "bookings":            "flights",      # table name fix
    "booking_count":       "COUNT(*)",
}


def apply_sql_fixes(sql: str) -> str:
    """Apply known column/table name corrections to SQL.
    Only replaces outside of string literals to avoid breaking values.
    """
    for wrong, correct in SQL_FIXES.items():
        # Only replace as whole words, not inside quotes
        sql = re.sub(
            rf"(?<!['\"])\b{wrong}\b(?!['\"])",
            correct,
            sql,
            flags=re.IGNORECASE
        )
    return sql


# ═══════════════════════════════════════════════════════════════
# CHART TYPE DETECTION
# ═══════════════════════════════════════════════════════════════

def detect_chart_type(question: str, columns: list, row_count: int) -> str:
    q = question.lower()

    # Time series → line
    if any(w in q for w in ["trend", "monthly", "over time", "by month", "by year", "daily", "weekly"]):
        return "line"

    # Status / distribution with few categories → pie
    if any(w in q for w in ["distribution", "share", "proportion", "percentage", "breakdown", "split"]):
        if row_count <= 10:
            return "pie"

    # Status count (confirmed/pending/cancelled) → pie
    if any(w in q for w in ["confirmed", "pending", "cancelled", "status"]):
        return "pie"

    # Class breakdown → pie
    if any(w in q for w in ["class", "economy", "business", "first class"]):
        if row_count <= 5:
            return "pie"

    # Many rows or many columns → table
    if row_count > 20 or len(columns) > 4:
        return "table"

    # 2-column result → bar
    if len(columns) <= 3:
        return "bar"

    return "table"

def reshape_for_chart(df: pd.DataFrame, question: str) -> pd.DataFrame:
    """
    If result is 1 row with multiple numeric columns,
    reshape to multiple rows with 2 columns (label, value).
    This fixes pie/bar charts for status count queries.
    """
    if len(df) == 1 and len(df.columns) > 2:
        # Check if all columns except possibly first are numeric
        numeric_cols = df.select_dtypes(include='number').columns.tolist()
        if len(numeric_cols) >= 2:
            # Melt from wide to long format
            melted = df.melt(var_name='category', value_name='count')
            return melted
    return df
# ═══════════════════════════════════════════════════════════════
# SERIALISATION
# ═══════════════════════════════════════════════════════════════

def make_serialisable(obj: Any) -> Any:
    """Convert pandas/numpy types to JSON-safe Python types."""
    import numpy as np
    import pandas as pd

    if isinstance(obj, (np.integer,)):       return int(obj)
    if isinstance(obj, (np.floating,)):      return float(obj)
    if isinstance(obj, (np.bool_,)):         return bool(obj)
    if isinstance(obj, (np.ndarray,)):       return obj.tolist()
    if isinstance(obj, pd.Timestamp):        return obj.isoformat()
    if isinstance(obj, pd.Period):           return str(obj)
    if isinstance(obj, float) and (obj != obj): return None  # NaN check
    if obj is pd.NA:                         return None
    if isinstance(obj, dict):  return {k: make_serialisable(v) for k, v in obj.items()}
    if isinstance(obj, list):  return [make_serialisable(i) for i in obj]
    return obj


# ═══════════════════════════════════════════════════════════════
# REQUEST / RESPONSE
# ═══════════════════════════════════════════════════════════════

class QueryRequest(BaseModel):
    question:       str
    interpret:      bool = True
    openai_api_key: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/schema")
def schema():
    """Return actual DB schema for debugging."""
    try:
        df = pd.read_sql("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name IN ('flights', 'airlines')
            ORDER BY table_name, ordinal_position
        """, engine)
        return {"columns": df.to_dict(orient="records")}
    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════════════
# MAIN QUERY ENDPOINT
# ═══════════════════════════════════════════════════════════════

@app.post("/query")
async def query_endpoint(body: QueryRequest):
    """
    Flow:
      1. Generate SQL from question via LLM
      2. Apply known column fixes
      3. Execute SQL against PostgreSQL
      4. If SQL fails → retry with simplified prompt
      5. Interpret results via LLM
      6. Return { text, data, columns, chart, generated_code }
    """
    cfg = llm_config

    # Allow per-request API key override
    if body.openai_api_key:
        cfg = LLMConfig(api_key=body.openai_api_key)

    if not cfg.api_key:
        return {
            "text": "API key not configured. Please set OPENAI_API_KEY.",
            "data": [], "columns": [], "chart": "table",
        }

    question = body.question.strip()
    logger.info("Question: %s", question)

    sql = None

    # ── ATTEMPT 1: Generate and execute SQL ─────────────────────
    try:
        sql = await generate_sql_query(question, cfg)
        sql = apply_sql_fixes(sql)
        logger.info("SQL attempt 1:\n%s", sql)

        df = pd.read_sql(sql, engine)
        # Reshape wide single-row results to long format for charts
        df = reshape_for_chart(df, question)

    except Exception as e1:
        logger.warning("SQL attempt 1 failed: %s", str(e1))

        # ── ATTEMPT 2: Retry with error context ─────────────────
        try:
            retry_question = (
                f"{question}\n\n"
                f"PREVIOUS ERROR: {str(e1)}\n"
                "Fix the SQL. Use ONLY columns that exist in the flights and airlines tables. "
                "flights has: airline_id, flght_no, departure_dt, arrival_dt, dep_time, arrivl_time, "
                "booking_cd, passngr_nm, seat_no, class, fare, extras, loyalty_pts, status, "
                "gate, terminal, baggage_claim, duration_hrs, layovers, layover_lo. "
                "airlines has: airline_id, airline_name."
            )

            sql = await generate_sql_query(retry_question, cfg)
            sql = apply_sql_fixes(sql)
            logger.info("SQL attempt 2:\n%s", sql)

            df = pd.read_sql(sql, engine)

        except Exception as e2:
            logger.error("SQL attempt 2 failed: %s", str(e2))

            # ── ATTEMPT 3: Fallback simple query ────────────────
            try:
                fallback_question = (
                    f"Answer this question using ONLY these columns — "
                    f"flights: fare, class, status, terminal, extras, loyalty_pts, duration_hrs, layovers, departure_dt. "
                    f"airlines: airline_name. JOIN on airline_id. "
                    f"Question: {question}"
                )

                sql = await generate_sql_query(fallback_question, cfg)
                sql = apply_sql_fixes(sql)
                logger.info("SQL attempt 3:\n%s", sql)

                df = pd.read_sql(sql, engine)

            except Exception as e3:
                logger.error("All SQL attempts failed: %s", str(e3))

                # Give a text-only answer
                text = await interpret_result(question, [], cfg)
                return {
                    "text": text,
                    "data": [],
                    "columns": [],
                    "chart": "table",
                    "generated_code": sql or "-- Could not generate valid SQL",
                }

    # ── Process successful result ────────────────────────────────
    records = make_serialisable(df.to_dict(orient="records"))
    columns = list(df.columns)
    row_count = len(records)

    logger.info("Result: %d rows, %d cols", row_count, len(columns))

    # Empty result
    if row_count == 0:
        text = await interpret_result(question, [], cfg)
        return {
            "text": text,
            "data": [],
            "columns": [],
            "chart": "table",
            "generated_code": sql,
        }

    # Interpret result
    text = await interpret_result(question, records, cfg)

    # Detect chart type
    chart = detect_chart_type(question, columns, row_count)

    return {
        "text":           text,
        "data":           records,
        "columns":        columns,
        "chart":          chart,
        "generated_code": sql,
        "row_count":      row_count,
    }