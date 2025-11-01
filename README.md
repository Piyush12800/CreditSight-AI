
# 💳 CreditSight AI

CreditSight AI is an **AI-powered financial credit management platform** built with **Next.js 14**, **Supabase**, **Prisma**, and **Google Gemini AI**.
It helps users track credits, debits, loans, and gain actionable financial insights through AI-driven analysis and RAG (Retrieval-Augmented Generation) models.

---

## 🚀 Features

### 💼 Core Functionality

- Secure user authentication with **Supabase**
- Manage and visualize transactions (credit, debit, loan)
- Real-time transaction summaries and charts
- Integrated **Prisma ORM** for PostgreSQL database management

### 🧠 AI-Powered Insights

- **Ask-AI Assistant** (Gemini integration) — analyze spending trends, suggest credit improvements, and answer finance-related questions
- Future RAG integration to use real user financial data for contextual AI reasoning

### 📊 Dashboard Highlights

- Interactive bar chart visualizations (Recharts)
- Categorized financial summaries
- Transaction history with type, amount, and description
- Intelligent financial recommendations (via Gemini)

---

## 🧰 Tech Stack

| Layer                   | Technology                                        |
| ----------------------- | ------------------------------------------------- |
| **Frontend**      | Next.js 14 (App Router), TailwindCSS              |
| **Backend**       | Next.js API Routes, Prisma ORM                    |
| **Database**      | PostgreSQL                                        |
| **Auth**          | Supabase Auth                                     |
| **AI**            | Google Gemini API (via `@google/generative-ai`) |
| **Visualization** | Recharts                                          |
| **Hosting**       | Vercel / Supabase (optional)                      |

---

## ⚙️ Environment Setup

Create a `.env` file in your project root:

```bash
DATABASE_URL="postgresql://postgres:1234@localhost:5432/creditSight"
GEMINI_API_KEY=your_gemini_api_key_here

NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```
