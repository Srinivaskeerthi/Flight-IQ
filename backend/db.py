from sqlalchemy import create_engine
import pandas as pd

# 🔥 UPDATE THESE
DB_USER = "postgres"
DB_PASSWORD = "Srinivas0710"
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "FlightDB"

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
