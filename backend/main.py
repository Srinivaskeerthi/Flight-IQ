"""
main.py
FastAPI application entry-point.

Start the server with:
    uvicorn main:app --reload
"""

from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os
print("=== API KEY ===", os.getenv("OPENAI_API_KEY", "NOT FOUND"))
print("=== MODEL ===", os.getenv("LLM_MODEL", "NOT FOUND"))

import logging
from contextlib import asynccontextmanager
from typing import Any, Optional


import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from analysis import QueryExecutionError, execute_query
from data_loader import get_schema_description, load_data
from llm_agent import LLMConfig, generate_pandas_code, interpret_result

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App state
# ---------------------------------------------------------------------------

class AppState:
    df: pd.DataFrame = None
    schema_description: str = ""
    llm_config: LLMConfig = None


state = AppState()


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data and configure the LLM client on startup."""
    bookings_path = os.getenv("BOOKINGS_CSV", "Flight_Bookings.csv")
    airlines_path = os.getenv("AIRLINES_CSV", "Airline_ID_to_Name.csv")

    logger.info("Loading data files …")
    state.df = load_data(bookings_path, airlines_path)
    state.schema_description = get_schema_description(state.df)

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning(
            "OPENAI_API_KEY is not set. The /query endpoint will fail "
            "unless a key is provided per-request."
        )

    state.llm_config = LLMConfig(
    api_key=api_key,
    model=os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"),
    base_url="https://api.groq.com/openai/v1/chat/completions",
    )

    logger.info("Startup complete. DataFrame shape: %s", state.df.shape)
    yield
    logger.info("Shutting down.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Flight Bookings Query API",
    description=(
        "POST a natural-language question to /query and receive structured "
        "flight data analysis powered by an LLM-generated pandas query."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        examples=["Which airline has the highest average fare?"],
        description="Natural-language question about the flight bookings data.",
    )
    interpret: bool = Field(
        default=True,
        description=(
            "If true, the LLM will also produce a plain-English "
            "interpretation of the query result."
        ),
    )
    openai_api_key: Optional[str] = Field(
        default=None,
        description=(
            "Override the server-level OPENAI_API_KEY for this request. "
            "Useful for development / testing."
        ),
    )


class QueryResponse(BaseModel):
    question: str
    generated_code: str
    data: Any
    columns: Optional[list[Any]] = None
    row_count: Optional[int] = None
    interpretation: Optional[str] = None
    
    model_config = {"arbitrary_types_allowed": True}

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
def root():
    """Health check / welcome endpoint."""
    return {
        "status": "ok",
        "rows_loaded": len(state.df) if state.df is not None else 0,
    }


@app.get("/schema", tags=["metadata"])
def get_schema():
    """Return the DataFrame column names and dtypes."""
    if state.df is None:
        raise HTTPException(status_code=503, detail="Data not loaded yet.")
    return {
        "columns": {col: str(dtype) for col, dtype in state.df.dtypes.items()},
        "row_count": len(state.df),
    }


@app.post("/query", response_model=QueryResponse, tags=["query"])
async def query_endpoint(body: QueryRequest):
    """
    Accept a natural-language question, generate a pandas query via an LLM,
    execute it against the flight bookings DataFrame, and return the result.
    """
    if state.df is None:
        raise HTTPException(status_code=503, detail="Data not loaded yet.")

    # Allow per-request API key override
    llm_cfg = state.llm_config
    if body.openai_api_key:
        llm_cfg = llm_cfg.model_copy(update={"api_key": body.openai_api_key})

    if not llm_cfg.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No OpenAI API key configured. Set the OPENAI_API_KEY "
                "environment variable or pass openai_api_key in the request body."
            ),
        )

    # 1. Generate pandas code
    try:
        code = await generate_pandas_code(
            question=body.question,
            schema_description=state.schema_description,
            config=llm_cfg,
        )
    except Exception as exc:
        logger.exception("LLM code generation failed")
        raise HTTPException(
            status_code=502,
            detail=f"LLM code generation failed: {exc}",
        ) from exc

    # 2. Execute the generated code
    try:
        query_result = execute_query(state.df, code)
    except QueryExecutionError as exc:
        logger.error("Query execution error: %s", exc)
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    # 3. (Optional) interpret the result
    interpretation: Optional[str] = None
    if body.interpret:
        try:
            interpretation = await interpret_result(
                question=body.question,
                query_result=query_result,
                config=llm_cfg,
            )
        except Exception as exc:
            logger.warning("Result interpretation failed (non-fatal): %s", exc)
            interpretation = None

    return QueryResponse(
        question=body.question,
        generated_code=query_result["executed_code"],
        data=query_result["data"],
        columns=query_result["columns"],
        row_count=query_result["row_count"],
        interpretation=interpretation,
    )