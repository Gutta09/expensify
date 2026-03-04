# ExpenseIQ — AI-Powered Intelligent Expense Tracker

> A full-stack MERN application that transforms expense tracking into an intelligent financial management system with AI-driven predictive analytics, anomaly detection, and Power BI embedded dashboards.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │  Auth UI  │ │Dashboard │ │ AI Chat  │ │ Power BI Embedded │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API / WebSocket
┌──────────────────────────┴──────────────────────────────────────┐
│                    Node.js + Express Backend                     │
│  ┌──────┐ ┌──────┐ ┌───────┐ ┌───────┐ ┌──────┐ ┌──────────┐  │
│  │ Auth │ │ RBAC │ │ Plaid │ │OpenAI │ │ PBI  │ │ ML Proxy │  │
│  └──────┘ └──────┘ └───────┘ └───────┘ └──────┘ └──────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐  ┌────────────┐  ┌──────────────┐
   │  MongoDB   │  │  ML Service │  │  Power BI    │
   │ (Atlas)    │  │  (Python)   │  │  Service     │
   └────────────┘  └────────────┘  └──────────────┘
```

## Tech Stack

| Layer        | Technology                                              |
|--------------|---------------------------------------------------------|
| Frontend     | React 18, TypeScript, Redux Toolkit, Tailwind CSS       |
| Backend      | Node.js 20, Express.js, TypeScript                      |
| Database     | MongoDB Atlas (Time-Series Collections)                 |
| AI/ML        | Python 3.11, Flask, Prophet, scikit-learn, TensorFlow   |
| LLM          | OpenAI GPT-4 API                                        |
| Banking      | Plaid API                                                |
| Analytics    | Power BI Embedded (Azure AD Service Principal)          |
| Auth         | JWT + bcrypt, Role-Based Access Control                 |
| DevOps       | Docker, docker-compose                                  |

## Quick Start

```bash
# 1. Clone and install
cp .env.example .env          # Configure environment variables
docker-compose up --build     # Start all services

# 2. Or run individually:
cd server && npm install && npm run dev
cd client && npm install && npm run dev
cd ml-service && pip install -r requirements.txt && python app.py
```

## Project Structure

```
expensify/
├── server/                 # Express.js backend
│   ├── src/
│   │   ├── config/         # DB, auth, third-party configs
│   │   ├── middleware/      # Auth, RBAC, validation, error handling
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic (AI, Plaid, PowerBI)
│   │   ├── utils/           # Helpers, constants
│   │   └── app.ts           # Express app setup
│   └── package.json
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── store/           # Redux store & slices
│   │   ├── services/        # API client functions
│   │   ├── hooks/           # Custom React hooks
│   │   └── App.tsx
│   └── package.json
├── ml-service/              # Python ML microservice
│   ├── models/              # Trained model artifacts
│   ├── services/            # Forecast, anomaly, categorizer
│   ├── app.py               # Flask API
│   └── requirements.txt
├── docker-compose.yml
└── .env.example
```

## User Roles

| Role     | Capabilities                                                    |
|----------|-----------------------------------------------------------------|
| Admin    | Manage users, view aggregate analytics, system configuration    |
| Analyst  | View multi-user insights, export data, configure AI models      |
| User     | Personal dashboard, transactions, AI coaching, budgets          |

## Key Features

- **Predictive Spending Forecasts**: Prophet-based time-series predictions with confidence intervals
- **Anomaly Detection**: Isolation Forest flags unusual transactions in real-time
- **AI Financial Coach**: GPT-4 powered conversational insights about spending habits
- **Smart Categorization**: ML-powered automatic transaction classification
- **Personalized Recommendations**: Behavioral analysis with actionable savings advice
- **Power BI Dashboards**: Embedded interactive reports with RLS per user
- **Bank Integration**: Plaid Link for automatic transaction ingestion
- **Real-Time Updates**: WebSocket notifications for new transactions and alerts

## Environment Variables

See `.env.example` for all required configuration variables.

## License

MIT
