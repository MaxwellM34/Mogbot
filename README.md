# Mogbot — The AI Agent That Mogs Every Task

An autonomous AI agent powered by Claude that mogs Manus by being fully yours. Browse the web, execute code, manage files, and chain multi-step plans to absolutely mog complex tasks.

## What It Does

- **Browse the web** — click, type, scroll, navigate with Playwright
- **Read & extract** content from any page
- **Execute code** — Python, Node.js, bash (sandboxed via Docker or local)
- **Manage files** — create, edit, read, list
- **Fill forms** and interact with web apps
- **Pause and ask you** when it hits CAPTCHAs, 2FA, or login walls
- **Chain everything** into multi-step autonomous plans

## Architecture

```
┌─────────────────────────────────────────────┐
│                   YOU (User)                │
│         Terminal / Web UI / Discord         │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │    Mogbot Core      │
         │  (Orchestrator)     │
         │  - Task Planner     │
         │  - Action Loop      │
         │  - Memory Manager   │
         └──┬───┬───┬───┬─────┘
            │   │   │   │
   ┌────────▼┐ ┌▼───▼┐ ┌▼──────────┐
   │ Claude  │ │Code │ │ Browser   │
   │  API    │ │Exec │ │(Playwright│
   │ (Brain) │ │     │ │  /CDP)    │
   └─────────┘ └─────┘ └───────────┘
```

## Prerequisites

- **Node.js 20+**
- **Python 3.11+** (for sandboxed code execution)
- **Docker** (optional, for isolated code execution)
- **Anthropic API Key** (`ANTHROPIC_API_KEY`)

## Quick Start

```bash
# Install dependencies
npm install

# Install browser
npx playwright install chromium

# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Run in dev mode (interactive)
npx tsx src/main.ts

# Run with a task
npx tsx src/main.ts "Find the top 3 trending repos on GitHub and save a summary"
```

## Project Structure

```
mogbot/
├── src/
│   ├── core/
│   │   ├── orchestrator.ts    # Main agent loop
│   │   ├── planner.ts         # Task decomposition
│   │   └── memory.ts          # Conversation + state memory
│   ├── tools/
│   │   ├── definitions.ts     # Tool schemas for Claude
│   │   ├── browser.ts         # Playwright browser control
│   │   ├── code-exec.ts       # Sandboxed code execution
│   │   ├── files.ts           # File operations
│   │   └── human.ts           # Human-in-the-loop
│   └── ui/
│       └── server.ts          # Web UI server
├── public/
│   └── index.html             # Web UI frontend
├── workspace/                 # Agent's working directory
├── Dockerfile.sandbox         # Code execution sandbox
├── tsconfig.json
└── package.json
```

## Web UI

```bash
npx tsx src/ui/server.ts
# Open http://localhost:3000
```

## How Human-in-the-Loop Works

When Mogbot hits a CAPTCHA, login wall, or needs a decision:

1. Claude calls `ask_human` with the type of help needed
2. The browser is visible (non-headless mode) so you can see it
3. Terminal/UI shows the prompt and waits for your input
4. You interact with the browser directly (solve CAPTCHA, enter credentials)
5. You type `done` or provide the info needed
6. Mogbot resumes and continues the task

The agent never sees your passwords — it just waits while you handle the sensitive part.

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

## Building for Production

```bash
npm run build
npm start
```

## Cost Awareness

Each agent loop iteration calls the Claude API. A typical task takes 10-30 iterations.

| Model | ~Cost per iteration | 20-step task |
|-------|-------------------|--------------|
| Sonnet 4 | ~$0.02-0.05 | ~$0.50-1.00 |
| Opus 4 | ~$0.10-0.25 | ~$2.00-5.00 |

## License

MIT
