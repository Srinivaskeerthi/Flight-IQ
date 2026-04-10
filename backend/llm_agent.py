"""
llm_agent.py
LLM agent for generating SQL queries and interpreting results.
Uses Groq API (llama-3.3-70b-versatile).
"""

from __future__ import annotations

import os
import re
import httpx
from pydantic import BaseModel

OPENAI_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMConfig(BaseModel):
    api_key: str = os.getenv("OPENAI_API_KEY", "")
    model:   str = "llama-3.3-70b-versatile"
    base_url: str = OPENAI_CHAT_URL


# ═══════════════════════════════════════════════════════════════
# PROMPTS
# ═══════════════════════════════════════════════════════════════

SQL_GEN_PROMPT = """
You are a senior PostgreSQL expert working on a flight booking analytics system.

══════════════════════════════════════
DATABASE SCHEMA
══════════════════════════════════════

Table: flights
  - airline_id       INTEGER         (FK to airlines)
  - flght_no         TEXT            (flight number)
  - departure_dt     TIMESTAMP       (departure date and time)
  - arrival_dt       TIMESTAMP       (arrival date and time)
  - dep_time         TEXT            (departure time string)
  - arrivl_time      TEXT            (arrival time string)
  - booking_cd       TEXT            (booking code)
  - passngr_nm       TEXT            (passenger name)
  - seat_no          TEXT            (seat number)
  - class            TEXT            (Economy / Business / First)
  - fare             NUMERIC         (ticket price in USD)
  - extras           TEXT            (Meal / Extra Baggage / No Extras)
  - loyalty_pts      INTEGER         (loyalty points earned)
  - status           TEXT            (Confirmed / Pending / Cancelled)
  - gate             TEXT            (departure gate)
  - terminal         TEXT            (terminal: A, B, C, D)
  - baggage_claim    TEXT            (baggage claim area)
  - duration_hrs     NUMERIC         (flight duration in hours)
  - layovers         INTEGER         (number of layovers: 0, 1, 2)
  - layover_lo       TEXT            (layover location code)

Table: airlines
  - airline_id       INTEGER PRIMARY KEY
  - airline_name     TEXT            (full airline name)

JOIN: flights.airline_id = airlines.airline_id
══════════════════════════════════════
COMMON QUERY PATTERNS
══════════════════════════════════════

1. Revenue / Fare analysis:
   SELECT a.airline_name, SUM(f.fare) as total_revenue
   FROM flights f JOIN airlines a ON f.airline_id = a.airline_id
   GROUP BY a.airline_name ORDER BY total_revenue DESC

2. Booking counts:
   SELECT a.airline_name, COUNT(*) as total_bookings
   FROM flights f JOIN airlines a ON f.airline_id = a.airline_id
   GROUP BY a.airline_name ORDER BY total_bookings DESC

3. Cancellation rate:
   SELECT a.airline_name,
     ROUND(100.0 * SUM(CASE WHEN f.status = 'Cancelled' THEN 1 ELSE 0 END) / COUNT(*), 2) as cancel_rate
   FROM flights f JOIN airlines a ON f.airline_id = a.airline_id
   GROUP BY a.airline_name ORDER BY cancel_rate DESC

4. Average fare:
   SELECT a.airline_name, ROUND(AVG(f.fare), 2) as avg_fare
   FROM flights f JOIN airlines a ON f.airline_id = a.airline_id
   GROUP BY a.airline_name ORDER BY avg_fare DESC

5. Class distribution:
   SELECT f.class, COUNT(*) as count, ROUND(AVG(f.fare), 2) as avg_fare
   FROM flights f GROUP BY f.class ORDER BY count DESC

6. Monthly trend:
   SELECT TO_CHAR(f.departure_dt, 'YYYY-MM') as month, COUNT(*) as bookings
   FROM flights f GROUP BY month ORDER BY month

7. Terminal analysis:
   SELECT f.terminal, COUNT(*) as departures
   FROM flights f GROUP BY f.terminal ORDER BY departures DESC

8. Loyalty points:
   SELECT f.passngr_nm, SUM(f.loyalty_pts) as total_points
   FROM flights f GROUP BY f.passngr_nm ORDER BY total_points DESC LIMIT 10

9. Extras breakdown:
   SELECT f.extras, COUNT(*) as count, SUM(f.fare) as revenue
   FROM flights f GROUP BY f.extras ORDER BY revenue DESC

10. Duration analysis:
    SELECT a.airline_name, ROUND(AVG(f.duration_hrs), 2) as avg_duration
    FROM flights f JOIN airlines a ON f.airline_id = a.airline_id
    GROUP BY a.airline_name ORDER BY avg_duration DESC

══════════════════════════════════════
STRICT RULES
══════════════════════════════════════

✅ ALWAYS:
- Use exact column names from schema above
- JOIN airlines when airline_name is needed
- Use f. and a. aliases consistently
- Add ORDER BY for ranked results
- Add LIMIT for top-N queries
- Use ROUND() for decimal values

❌ NEVER:
- Use columns that don't exist in schema
- Use airline_nm (use airline_name)
- Use fare_amount (use fare)
- Use loyalty_points (use loyalty_pts)
- Use cancelled (use status = 'Cancelled')
- Use passngr_nm as a category
- Invent tables or columns

══════════════════════════════════════
STRICT OUTPUT RULES:
══════════════════════════════════════

- You MUST ALWAYS generate a SQL query
- NEVER return explanation or text
- NEVER say "I don't have data"
- NEVER refuse
- ALWAYS try to answer using available columns

FINAL RULE:

- Even if uncertain → generate best possible SQL
- DO NOT return text explanation

OUTPUT FORMAT:
- Return ONLY the SQL query
- No markdown fences
- No explanation
- Must start with SELECT
"""


INTERPRETATION_PROMPT = """
You are a senior flight data analyst explaining query results to a business user.

RULES:
1. Be SPECIFIC — include numbers, airline names, exact values
2. Highlight the most important insight (highest, lowest, trend)
3. Keep it SHORT — 2 to 3 sentences maximum
4. DO NOT repeat raw data row by row
5. DO NOT make up information not in the data
6. Write in professional business language

EXAMPLE:
Data: [{'airline_name': 'Emirates', 'avg_fare': 842.3}, {'airline_name': 'Delta', 'avg_fare': 612.1}]
Output: Emirates has the highest average fare at $842.30, which is 37% higher than Delta Air Lines at $612.10. This suggests Emirates operates predominantly premium routes.
"""


TEXT_ANSWER_PROMPT = """
You are a helpful flight data assistant.

The user asked a question but no data was found in the database.
Answer the question using general knowledge about airlines and flight data.
Keep the answer to 2-3 sentences.
Be honest if you don't know.
"""


# ═══════════════════════════════════════════════════════════════
# LLM CALL HELPER
# ═══════════════════════════════════════════════════════════════

async def _call_llm(messages: list, config: LLMConfig, timeout: int = 60) -> str:
    """Single reusable LLM call with error handling."""
    payload = {
        "model":    config.model,
        "messages": messages,
        "temperature": 0.0,
        "max_tokens": 1024,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            config.base_url,
            json=payload,
            headers={"Authorization": f"Bearer {config.api_key}"},
        )
        res.raise_for_status()

    return res.json()["choices"][0]["message"]["content"].strip()


# ═══════════════════════════════════════════════════════════════
# SQL GENERATION
# ═══════════════════════════════════════════════════════════════

async def generate_sql_query(question: str, config: LLMConfig) -> str:
    """Generate a PostgreSQL query for the given question."""
    content = await _call_llm(
        messages=[
            {"role": "system", "content": SQL_GEN_PROMPT},
            {"role": "user",   "content": question},
        ],
        config=config,
    )

    # Strip any accidental markdown fences
    sql = re.sub(r"```sql|```", "", content).strip()

    # Ensure it starts with SELECT
    if not sql.upper().lstrip().startswith("SELECT"):
        # Try to extract SELECT from response
        match = re.search(r"(SELECT\s.+)", sql, re.DOTALL | re.IGNORECASE)
        if match:
            sql = match.group(1).strip()
        else:
            raise ValueError(f"LLM did not return valid SQL: {sql[:200]}")

    return sql


# ═══════════════════════════════════════════════════════════════
# RESULT INTERPRETATION
# ═══════════════════════════════════════════════════════════════

async def interpret_result(question: str, data: list, config: LLMConfig) -> str:
    """Convert query results into a human-readable insight."""
    if not data:
        # No data — answer from general knowledge
        content = await _call_llm(
            messages=[
                {"role": "system", "content": TEXT_ANSWER_PROMPT},
                {"role": "user",   "content": question},
            ],
            config=config,
        )
        return content

    # Has data — interpret the results
    snippet = str(data[:15])[:2000]
    content = await _call_llm(
        messages=[
            {"role": "system", "content": INTERPRETATION_PROMPT},
            {"role": "user",   "content": f"Question: {question}\n\nData: {snippet}"},
        ],
        config=config,
    )
    return content