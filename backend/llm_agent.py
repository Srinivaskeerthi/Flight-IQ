"""
llm_agent.py
Translates a natural-language question into pandas code using an LLM,
then optionally interprets the result back into a human-readable answer.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Optional

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OPENAI_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"
DEFAULT_TEMPERATURE = 0.0
DEFAULT_MAX_TOKENS = 1024

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

CODE_GEN_SYSTEM_PROMPT = """\
You are an expert data analyst. You have access to a pandas DataFrame called `df`.

{schema}

Your job is to convert the user's natural-language question into a valid
Python / pandas code snippet that runs against `df`.

Rules:
1. Always assign the final result to a variable called `result`.
2. `result` must be a DataFrame, Series, or a scalar (int / float / str / list).
3. Import nothing — `pd` (pandas) and `np` (numpy) are already available.
4. Do NOT include markdown fences (``` / ```python) in your output.
5. Do NOT include explanations — output executable Python code only.
6. Keep the code concise and readable.
7. For date comparisons use the already-parsed datetime columns: departure_dt, arrival_dt.
8. The DataFrame also has an 'airline_name' column (joined from the airline lookup table).

Example output:
result = df.groupby('airline_name')['fare'].mean().reset_index().rename(columns={{'fare': 'avg_fare'}})
"""

INTERPRETATION_SYSTEM_PROMPT = """\
You are a helpful data analyst assistant.
The user asked a question about flight booking data.
You were given the result of a pandas query.
Summarise the result in a clear, concise, human-readable answer.
Be specific — include numbers, airline names, or key statistics where relevant.
"""


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class LLMConfig(BaseModel):
    api_key: str = os.getenv("OPENAI_API_KEY")
    model: str = DEFAULT_MODEL
    temperature: float = DEFAULT_TEMPERATURE
    max_tokens: int = DEFAULT_MAX_TOKENS
    base_url: str = OPENAI_CHAT_URL


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

async def generate_pandas_code(
    question: str,
    schema_description: str,
    config: LLMConfig,
) -> str:
    """
    Ask the LLM to convert *question* into a pandas code snippet.

    Parameters
    ----------
    question : str
        The user's natural-language question.
    schema_description : str
        A textual description of the DataFrame schema (from data_loader).
    config : LLMConfig
        LLM connection settings.

    Returns
    -------
    str
        A Python code string ready to be exec()'d.
    """
    system_prompt = CODE_GEN_SYSTEM_PROMPT.format(schema=schema_description)

    payload = {
        "model": config.model,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            config.base_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
        )
        logger.error("RESPONSE STATUS: %s", response.status_code)
        logger.error("RESPONSE BODY: %s", response.text)
        response.raise_for_status()

    data = response.json()
    code = data["choices"][0]["message"]["content"].strip()

    # Strip any accidental markdown fences the model may have included
    code = _strip_markdown_fences(code)

    logger.info("LLM generated code:\n%s", code)
    return code


async def interpret_result(
    question: str,
    query_result: dict,
    config: LLMConfig,
) -> str:
    """
    Ask the LLM to produce a plain-English summary of *query_result*.

    Parameters
    ----------
    question : str
        The original user question.
    query_result : dict
        The structured result returned by analysis.execute_query().
    config : LLMConfig

    Returns
    -------
    str
        Human-readable interpretation of the result.
    """
    result_snippet = str(query_result.get("data", ""))[:2000]  # guard token limit

    user_content = (
        f"Question: {question}\n\n"
        f"Query result (first 2000 chars):\n{result_snippet}"
    )

    payload = {
        "model": config.model,
        "temperature": 0.3,
        "max_tokens": 512,
        "messages": [
            {"role": "system", "content": INTERPRETATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    }

    async with httpx.AsyncClient(timeout=180) as client:
        response = await client.post(
            config.base_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()

    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_markdown_fences(text: str) -> str:
    """Remove ```python ... ``` or ``` ... ``` wrappers if present."""
    pattern = r"^```(?:python)?\s*\n?(.*?)\n?```$"
    match = re.match(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text