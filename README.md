# VITOGRAPH

> Health-tech AI platform — персональный анализ биомаркеров, расчёт динамической нормы витаминов и минералов на основе анализов крови, стиля жизни и окружающей среды.

## Tech Stack

| Layer                 | Technology                                     |
| --------------------- | ---------------------------------------------- |
| Frontend              | Next.js 16, React 19, TypeScript, Tailwind CSS |
| AI Backend (Node)     | Express, LangChain, GPT-5.4 (lab diagnostics)  |
| Core Backend (Python) | FastAPI, AsyncOpenAI (file parser)             |
| Database              | Supabase (PostgreSQL), Prisma ORM              |
| Auth                  | Supabase Auth (JWT)                            |

## Project Structure

```
VITOGRAPH/
├── apps/
│   ├── api/                  # Python FastAPI — парсинг PDF/DOCX, расчёт норм
│   │   ├── main.py           # Entry point (POST /parse, /calculate, /health)
│   │   ├── services/         # file_parser.py, norm_engine.py
│   │   ├── schemas/          # Pydantic models
│   │   └── src/              # Node.js AI backend (Express)
│   │       └── ai/src/       # LangChain graphs, routes, controllers
│   └── web/                  # Next.js frontend
│       └── src/
│           ├── app/          # Pages (ClientPage.tsx)
│           ├── components/   # UI components (medical/, diary/, ui/)
│           └── lib/          # API client, Supabase client, utils
├── docs/                     # Architecture docs
├── prisma/                   # Prisma schema
├── supabase/                 # Migrations
├── trash/                    # Archived/unused files
├── start_dev.ps1             # Dev server launcher
└── PROJECT_RESUME.md         # Project context summary
```

## Quick Start

```powershell
# 1. Start all dev servers (Python + Node + Next.js)
.\start_dev.ps1

# Or manually:
# Python API (port 8000)
cd apps/api && uvicorn main:app --reload --port 8000

# Node AI Engine (port 3001)
cd apps/api/src && npm run dev

# Next.js Frontend (port 3000)
cd apps/web && npm run dev
```

## Environment Variables

Create `apps/api/.env`:
```env
SUPABASE_URL=...
SUPABASE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o
```

Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
