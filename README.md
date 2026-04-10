# ✈️ FlightIQ — AI-Powered Flight Data Analytics System

FlightIQ is an intelligent analytics platform that allows users to query flight data using natural language and receive structured insights with dynamic visualizations.

---

## 🚀 Overview

FlightIQ enables users to ask questions in plain English and get:

- Structured data results  
- Interactive charts  
- AI-generated insights  

It bridges the gap between natural language and data analytics using AI.

---

## ✨ Key Features

- Natural Language to SQL using Groq LLM  
- Dynamic Chart Selection (Bar, Line, Pie, Table)  
- Real-time query processing  
- Retry handling for API failures  
- Interactive visualizations using Highcharts  
- Full Stack Application (React + FastAPI)  

---

## 🏗️ Tech Stack

### Frontend
- React.js  
- Axios  
- Highcharts  

### Backend
- FastAPI  
- SQLAlchemy  
- PostgreSQL  
- Groq API  

### Deployment
- Frontend: Vercel  
- Backend: Render  

---

## 🧠 How It Works

User Query (Natural Language)  
        ↓  
Groq LLM  
        ↓  
SQL Query Generation  
        ↓  
PostgreSQL Database (via SQLAlchemy)  
        ↓  
Result Processing  
        ↓  
Dynamic Chart Selection  
        ↓  
Visualization (Highcharts)  

---

## 📊 Example Queries

- Monthly booking trend for 2023  
- Cancellation rate per airline  
- Revenue by extras type  
- Top 10 passengers by loyalty points  
- Show bookings by class  

---

## ⚙️ Environment Variables

### Frontend (Local)

Create `.env` inside `flight-frontend`:

REACT_APP_API_URL=http://localhost:8000

---

### Frontend (Production - Vercel)

Set in Vercel dashboard:

REACT_APP_API_URL=https://your-backend-url.onrender.com

---

### Backend (Render)

Set environment variables:

GROQ_API_KEY=your_api_key  

---

## 🛠️ Local Setup

### Clone Repository

git clone https://github.com/Srinivaskeerthi/Flight-IQ.git  
cd Flight-IQ  

---

### Backend Setup

cd backend  
pip install -r requirements.txt  
uvicorn main:app --reload  

---

### Database Setup

- Install PostgreSQL  
- Create database  
- Update connection string in backend  

---

### Frontend Setup

cd flight-frontend  
npm install  
npm start  

---

## ⚠️ Limitations

- Dependent on Groq API (rate limits may occur)  
- Ambiguous queries may require clarification  
- API latency may affect response time  

---

## 🔮 Future Improvements

- Multi-model support (Gemini / Local LLM)  
- Query intent classification  
- Better error handling & fallback  
- User authentication & dashboards  

---

## 👨‍💻 Author

Keerthi Srinivas  

---

## 💡 Project Domain

Full stack development ~ AI Integration & Data Analytics  

---

## ⭐ Support

If you like this project, give it a star on GitHub!
