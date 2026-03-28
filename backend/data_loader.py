"""
data_loader.py
Responsible for loading and merging the flight bookings and airline data.
"""

import pandas as pd
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def load_data(
    bookings_path: str = "Flight_Bookings.csv",
    airlines_path: str = "Airline_ID_to_Name.csv",
) -> pd.DataFrame:
    """
    Load Flight_Bookings.csv and Airline_ID_to_Name.csv, merge them on
    airline_id (the bookings column is named 'airlie_id' due to a typo in the
    source data — we normalise it here), and return a clean merged DataFrame.

    Parameters
    ----------
    bookings_path : str
        Path to the flight bookings CSV file.
    airlines_path : str
        Path to the airline ID-to-name CSV file.

    Returns
    -------
    pd.DataFrame
        Merged DataFrame with an 'airline_name' column added.

    Raises
    ------
    FileNotFoundError
        If either CSV file cannot be found at the given path.
    """
    bookings_file = Path(bookings_path)
    airlines_file = Path(airlines_path)

    if not bookings_file.exists():
        raise FileNotFoundError(f"Bookings file not found: {bookings_path}")
    if not airlines_file.exists():
        raise FileNotFoundError(f"Airlines file not found: {airlines_path}")

    logger.info("Loading bookings from %s", bookings_path)
    bookings_df = pd.read_csv(bookings_path)

    logger.info("Loading airline names from %s", airlines_path)
    airlines_df = pd.read_csv(airlines_path)

    # Normalise the typo in the source data: 'airlie_id' → 'airline_id'
    if "airlie_id" in bookings_df.columns:
        bookings_df.rename(columns={"airlie_id": "airline_id"}, inplace=True)

    # Normalise airline ID column name in the lookup table
    if "airlie_id" in airlines_df.columns:
        airlines_df.rename(columns={"airlie_id": "airline_id"}, inplace=True)

    # Convert datetime columns where possible
    for col in ("departure_dt", "arrival_dt"):
        if col in bookings_df.columns:
            bookings_df[col] = pd.to_datetime(bookings_df[col], errors="coerce")

    # Merge on airline_id
    merged_df = bookings_df.merge(airlines_df, on="airline_id", how="left")
    logger.info(
        "Merged DataFrame has %d rows and %d columns",
        len(merged_df),
        len(merged_df.columns),
    )

    return merged_df


def get_schema_description(df: pd.DataFrame) -> str:
    """
    Return a human-readable schema description for the DataFrame, useful
    when constructing prompts for the LLM.

    Parameters
    ----------
    df : pd.DataFrame

    Returns
    -------
    str
    """
    lines = ["DataFrame columns and dtypes:"]
    for col, dtype in df.dtypes.items():
        sample_vals = df[col].dropna().unique()[:3].tolist()
        lines.append(f"  - {col} ({dtype}): e.g. {sample_vals}")
    return "\n".join(lines)