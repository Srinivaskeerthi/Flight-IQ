import pandas as pd
from sqlalchemy import create_engine

# 🔥 UPDATE PASSWORD
engine = create_engine("postgresql://postgres:Srinivas0710@localhost:5432/FlightDB")

# Load CSV
bookings = pd.read_csv("Flight_Bookings.csv")
airlines = pd.read_csv("Airline_ID_to_Name.csv")

# Fix column typo if exists
if "airlie_id" in bookings.columns:
    bookings.rename(columns={"airlie_id": "airline_id"}, inplace=True)

# Insert into PostgreSQL
bookings.to_sql("bookings", engine, if_exists="replace", index=False)
airlines.to_sql("airlines", engine, if_exists="replace", index=False)

print("✅ Tables created and data inserted successfully!")