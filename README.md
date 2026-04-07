# Mogbot — The AI Agent That Mogs Every Task

An autonomous AI agent powered by Claude that mogs Manus by being fully yours. Browse the web, execute code, manage files, and chain multi-step plans to absolutely mog complex tasks.

## What It Does

- **Browse the web** — click, type, scroll, navigate with Playwright
- **Read & extract** content from any page
- **Execute code** — Python, Node.js, bash
- **Manage files** — create, edit, read, list
- **Fill forms** and interact with web apps
- **Pause and ask you** when it hits CAPTCHAs, 2FA, or login walls
- **Chain everything** into multi-step autonomous plans
- **Track spending** — real-time budget enforcement in CAD
- **Persist history** — tasks and logs stored in PostgreSQL

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    YOU (User)                    │
│              React Web UI (:3000)                │
└──────────────────────┬──────────────────────────┘
                       │  WebSocket + REST
              ┌────────▼─────────┐
              │  FastAPI Backend  │
              │     (:8000)      │
              └──┬───┬───┬───┬──┘
                 │   │   │   │
  ┌──────────────▼┐ ┌▼───▼┐ ┌▼────────────┐
  │  Claude API   │ │Code │ │  Playwright  │
  │  (Anthropic)  │ │Exec │ │  (Browser)   │
  └───────────────┘ └─────┘ └─────────────┘
                 │
          ┌──────▼──────┐
          │  PostgreSQL  │
          │   (:5432)    │
          └─────────────┘
```

## Prerequisites

- **Docker & Docker Compose** (recommended)
- **Anthropic API Key** (`ANTHROPIC_API_KEY`)

For local development without Docker:
- Python 3.12+
- Node.js 20+
- PostgreSQL 16+

## Quick Start

### Docker (recommended)

```bash
# Set up local environment
cp .env.local.example .env.local
# Edit .env.local with your ANTHROPIC_API_KEY

# Launch (reads ENV=local from .env by default)
docker-compose up --build

# To switch to cloud: change ENV=cloud in .env, then:
cp .env.cloud.example .env.cloud
# Edit .env.cloud with production values
docker-compose up --build

# Open http://localhost:3000
```

### Local Development

```bash
# 1. Set up backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
playwright install chromium

# 2. (Optional) Start PostgreSQL for task persistence
docker run -d --name mogbot-db \
  -e POSTGRES_USER=mogbot -e POSTGRES_PASSWORD=mogbot -e POSTGRES_DB=mogbot \
  -p 5432:5432 postgres:16-alpine

# 3. Start backend (works without Postgres — just no persistence)
uvicorn app.main:app --reload --port 8000

# 4. Frontend (separate terminal)
cd webapp
npm install
npm run dev

# Open http://localhost:5173 (Vite dev server)
```

## Project Structure

```
Mogbot/
├── backend/                        # Python FastAPI
│   ├── app/
│   │   ├── main.py                 # FastAPI app + lifespan
│   │   ├── config.py               # Pydantic Settings (.env)
│   │   ├── database.py             # asyncpg connection pool
│   │   ├── models.py               # Pydantic schemas
│   │   ├── core/
│   │   │   ├── orchestrator.py     # Agent loop (Claude + tools)
│   │   │   └── budget.py           # CAD budget tracking
│   │   ├── tools/
│   │   │   ├── definitions.py      # 14 tool schemas
│   │   │   ├── browser.py          # Playwright async
│   │   │   ├── code_exec.py        # asyncio subprocess
│   │   │   ├── files.py            # Path-safe file ops
│   │   │   └── human.py            # Human-in-the-loop via WS
│   │   └── routers/
│   │       ├── tasks.py            # REST: CRUD tasks
│   │       └── ws.py               # WebSocket: real-time execution
│   ├── alembic/                    # Database migrations
│   ├── Dockerfile
│   └── pyproject.toml
├── webapp/                         # React 19 + Vite 6
│   ├── src/
│   │   ├── components/
│   │   │   ├── TaskInput.tsx       # Task + budget input
│   │   │   ├── LogStream.tsx       # Real-time log viewer
│   │   │   ├── BudgetBar.tsx       # Budget progress bar
│   │   │   └── TaskHistory.tsx     # Past tasks sidebar
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts     # WS with auto-reconnect
│   │   └── lib/
│   │       └── api.ts              # REST client
│   ├── Dockerfile + nginx.conf
│   └── package.json
├── docker-compose.yml              # postgres + backend + webapp
├── workspace/                      # Agent's working directory
└── .env                            # Configuration
```

## Web UI

The React frontend connects to the backend via WebSocket for real-time streaming:

- **Task input** with budget control (CAD) and model selector
- **Live log stream** — see every tool call, result, and thought in real time
- **Budget bar** — green/yellow/red progress as spending increases
- **Task history** — browse past tasks and their logs from PostgreSQL
- **Human-in-the-loop** — inline prompts when the agent needs help

## How Human-in-the-Loop Works

When Mogbot hits a CAPTCHA, login wall, or needs a decision:

1. Claude calls `ask_human` with the type of help needed
2. The WebSocket pushes a prompt to the frontend
3. You respond inline in the web UI
4. Mogbot resumes and continues the task

The agent never sees your passwords — it just waits while you handle the sensitive part.

## API

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/api/tasks/` | Create a task |
| `GET` | `/api/tasks/` | List tasks (paginated) |
| `GET` | `/api/tasks/{id}` | Get task details |
| `GET` | `/api/tasks/{id}/logs` | Get task logs |

### WebSocket

Connect to `ws://localhost:8000/ws/run` and send:

```json
{"type": "start", "task": "Find trending repos on GitHub", "budget_cad": 5.0}
```

The server streams events back:

| Event | Description |
|-------|-------------|
| `task_created` | Task ID assigned |
| `log` | Agent thinking/status |
| `tool_call` | Tool being invoked |
| `tool_result` | Tool output |
| `budget` | Spend update |
| `human_input_needed` | Agent needs human help |
| `result` | Final task result |
| `error` | Error occurred |

## Tools Available to the Agent

| Tool | Description |
|------|-------------|
| `browser_navigate` | Go to a URL |
| `browser_click` | Click elements by CSS selector or text |
| `browser_type` | Type into input fields |
| `browser_scroll` | Scroll up/down |
| `browser_screenshot` | Screenshot the current page |
| `browser_read_page` | Extract text, links, and form elements |
| `browser_select` | Select dropdown options |
| `browser_back` | Navigate back |
| `execute_code` | Run Python, bash, or JavaScript |
| `file_read` | Read a file |
| `file_write` | Write a file |
| `file_list` | List directory contents |
| `ask_human` | Ask the human for help |
| `task_complete` | Signal task completion |

## Configuration

Three environment files:

- **`.env`** — selector only, contains `ENV=local` or `ENV=cloud`
- **`.env.local`** — local development config + secrets
- **`.env.cloud`** — cloud / production config + secrets

To switch environments, change the value in `.env` — that's it. Copy from the `.example` files to get started.

All config is via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key |
| `DATABASE_URL` | `postgresql://mogbot:mogbot@localhost:5432/mogbot` | PostgreSQL connection string |
| `HOST` | `0.0.0.0` | Backend bind address |
| `PORT` | `8000` | Backend port |
| `WORKSPACE_DIR` | `./workspace` | Agent's file workspace |
| `DEFAULT_MODEL` | `claude-sonnet-4-20250514` | Default Claude model |
| `USD_TO_CAD_RATE` | `1.36` | Currency conversion rate |

## Cost Awareness

Each agent loop iteration calls the Claude API. Budget is enforced in CAD — the agent stops if it exceeds your limit.

| Model | ~Cost per iteration | 20-step task |
|-------|-------------------|--------------|
| Sonnet 4 | ~$0.02-0.05 | ~$0.50-1.00 |
| Opus 4 | ~$0.10-0.25 | ~$2.00-5.00 |

## License

MIT
