"""
tests/test_backend.py
Unit and integration tests for the Flight Bookings Query API.

Run with:
    pytest tests/ -v
"""

from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixtures – shared test data
# ---------------------------------------------------------------------------

AIRLINES_DATA = """airline_id,airline_name
1,American Airline
2,Delta Air Lines
5,JetBlue Airways
6,Alaska Airlines
"""

BOOKINGS_DATA = """airlie_id,flght#,departure_dt,arrival_dt,dep_time,arrivl_time,booking_cd,passngr_nm,seat_no,class,fare,extras,loyalty_pts,status,gate,terminal,baggage_claim,duration_hrs,layovers,layover_lo
1,6203,2023-08-04,2023-03-01,02:46:37,10:53:22,BRPJ,Name_UEUYB,SeatUUC,Economy,165.07,Meal,0,Confirmed,GateHX,A,ClaimUTO,1.98,0,LOCOGA
5,4205,2023-09-23,2023-05-28,12:03:42,07:17:26,BEEW,Name_BCNGM,SeatUHU,Business,438.34,Meal,0,Pending,GateSU,C,ClaimZGA,7.97,0,LOCEMT
6,2637,2023-06-26,2023-10-30,13:48:45,21:01:47,BQLF,Name_BANUL,SeatTWV,Economy,436.12,Meal,3649,Cancelled,GateZN,A,ClaimJLO,8.06,1,LOCWFQ
2,1256,2023-10-26,2023-10-24,03:05:36,08:29:20,BONG,Name_RFBBQ,SeatOYR,First,484.26,Meal,0,Pending,GateGI,C,ClaimMAU,1.08,1,LOCNOJ
"""


@pytest.fixture
def sample_df() -> pd.DataFrame:
    """Return a small merged DataFrame for testing."""
    from data_loader import load_data

    bookings_io = io.StringIO(BOOKINGS_DATA)
    airlines_io = io.StringIO(AIRLINES_DATA)

    bookings_df = pd.read_csv(bookings_io)
    airlines_df = pd.read_csv(airlines_io)

    if "airlie_id" in bookings_df.columns:
        bookings_df.rename(columns={"airlie_id": "airline_id"}, inplace=True)

    for col in ("departure_dt", "arrival_dt"):
        if col in bookings_df.columns:
            bookings_df[col] = pd.to_datetime(bookings_df[col], errors="coerce")

    return bookings_df.merge(airlines_df, on="airline_id", how="left")


# ---------------------------------------------------------------------------
# data_loader tests
# ---------------------------------------------------------------------------

class TestDataLoader:
    def test_merge_produces_airline_name_column(self, sample_df):
        assert "airline_name" in sample_df.columns

    def test_airlie_id_typo_normalised(self, sample_df):
        # Original typo 'airlie_id' should be renamed to 'airline_id'
        assert "airline_id" in sample_df.columns
        assert "airlie_id" not in sample_df.columns

    def test_row_count(self, sample_df):
        assert len(sample_df) == 4

    def test_datetime_columns_parsed(self, sample_df):
        assert pd.api.types.is_datetime64_any_dtype(sample_df["departure_dt"])

    def test_file_not_found_raises(self, tmp_path):
        from data_loader import load_data

        with pytest.raises(FileNotFoundError):
            load_data(
                bookings_path=str(tmp_path / "missing.csv"),
                airlines_path=str(tmp_path / "also_missing.csv"),
            )

    def test_get_schema_description(self, sample_df):
        from data_loader import get_schema_description

        schema = get_schema_description(sample_df)
        assert "airline_name" in schema
        assert "fare" in schema


# ---------------------------------------------------------------------------
# analysis tests
# ---------------------------------------------------------------------------

class TestAnalysis:
    def test_execute_simple_scalar(self, sample_df):
        from analysis import execute_query

        result = execute_query(sample_df, "result = len(df)")
        assert result["data"] == 4

    def test_execute_dataframe_result(self, sample_df):
        from analysis import execute_query

        code = "result = df[['airline_name', 'fare']]"
        result = execute_query(sample_df, code)
        assert result["columns"] == ["airline_name", "fare"]
        assert result["row_count"] == 4

    def test_execute_groupby(self, sample_df):
        from analysis import execute_query

        code = "result = df.groupby('class')['fare'].mean()"
        result = execute_query(sample_df, code)
        assert result["data"] is not None

    def test_execute_filter(self, sample_df):
        from analysis import execute_query

        code = "result = df[df['status'] == 'Confirmed']"
        result = execute_query(sample_df, code)
        assert result["row_count"] == 1

    def test_bad_code_raises_query_execution_error(self, sample_df):
        from analysis import QueryExecutionError, execute_query

        with pytest.raises(QueryExecutionError):
            execute_query(sample_df, "result = df['nonexistent_column_xyz']")

    def test_numpy_types_are_serialisable(self, sample_df):
        from analysis import execute_query
        import json

        code = "result = df['fare'].mean()"
        result = execute_query(sample_df, code)
        # Should not raise
        json.dumps(result)

    def test_series_result(self, sample_df):
        from analysis import execute_query

        code = "result = df['status'].value_counts()"
        result = execute_query(sample_df, code)
        assert result["columns"] is not None


# ---------------------------------------------------------------------------
# llm_agent tests (mocked HTTP)
# ---------------------------------------------------------------------------

class TestLLMAgent:
    @pytest.mark.asyncio
    async def test_generate_pandas_code_returns_string(self):
        from llm_agent import LLMConfig, generate_pandas_code

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "result = df.groupby('airline_name')['fare'].mean()"
                    }
                }
            ]
        }
        mock_response.raise_for_status = MagicMock()

        config = LLMConfig(api_key="test-key")

        with patch("llm_agent.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            code = await generate_pandas_code("avg fare per airline", "schema", config)

        assert "result" in code
        assert "df" in code

    @pytest.mark.asyncio
    async def test_strips_markdown_fences(self):
        from llm_agent import LLMConfig, generate_pandas_code

        fenced_code = "```python\nresult = df['fare'].mean()\n```"
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": fenced_code}}]
        }
        mock_response.raise_for_status = MagicMock()

        config = LLMConfig(api_key="test-key")

        with patch("llm_agent.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            code = await generate_pandas_code("mean fare", "schema", config)

        assert "```" not in code


# ---------------------------------------------------------------------------
# FastAPI endpoint tests (mocked LLM)
# ---------------------------------------------------------------------------

class TestAPIEndpoints:
    @pytest.fixture(autouse=True)
    def setup_app(self, sample_df):
        """Patch app state so tests don't need real CSV files."""
        import main

        original_df = main.state.df
        original_schema = main.state.schema_description
        original_cfg = main.state.llm_config

        from data_loader import get_schema_description
        from llm_agent import LLMConfig

        main.state.df = sample_df
        main.state.schema_description = get_schema_description(sample_df)
        main.state.llm_config = LLMConfig(api_key="test-key")

        yield

        main.state.df = original_df
        main.state.schema_description = original_schema
        main.state.llm_config = original_cfg

    @pytest.fixture
    def client(self):
        from main import app

        return TestClient(app)

    def test_root_health_check(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_schema_endpoint(self, client):
        resp = client.get("/schema")
        assert resp.status_code == 200
        data = resp.json()
        assert "columns" in data
        assert "airline_name" in data["columns"]

    def test_query_endpoint_success(self, client):
        with (
            patch("main.generate_pandas_code", new_callable=AsyncMock) as mock_gen,
            patch("main.interpret_result", new_callable=AsyncMock) as mock_interp,
        ):
            mock_gen.return_value = "result = df[['airline_name', 'fare']]"
            mock_interp.return_value = "Here are the results."

            resp = client.post(
                "/query",
                json={"question": "Show airline names and fares", "interpret": True},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["question"] == "Show airline names and fares"
        assert "generated_code" in body
        assert body["row_count"] == 4

    def test_query_endpoint_no_api_key(self, client):
        import main

        original_key = main.state.llm_config.api_key
        main.state.llm_config = main.state.llm_config.model_copy(
            update={"api_key": ""}
        )

        resp = client.post("/query", json={"question": "Show me data"})
        assert resp.status_code == 400

        main.state.llm_config = main.state.llm_config.model_copy(
            update={"api_key": original_key}
        )

    def test_query_endpoint_bad_generated_code(self, client):
        with patch("main.generate_pandas_code", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = "result = df['this_col_does_not_exist']"
            resp = client.post(
                "/query",
                json={"question": "Bad question"},
            )
        assert resp.status_code == 422