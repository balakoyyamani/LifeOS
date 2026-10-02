# LifeOS — Personal Career & Life Operating System

Production Website: [https://lifesos.online](https://lifesos.online)

LifeOS is a personal career and life operating system designed for turning recurring commitments, routines, goals, focus sessions, and career milestones into an honest daily execution view.

---

## Features

- **Daily Execution & Today View**: Real-time daily score, category balance, streak signals, and incremental progress tracking.
- **Goals & Daily Progress**: Measurable targets, recurring frequencies, milestone deadlines, and progress logs.
- **Schedules & Recurring Commitments**: Robust recurrence engine (`daily`, `weekdays`, `weekends`, `weekly:DAYS`, `every_n_days`, `monthly`) with occurrence resolution without database bloat.
- **Server-Persistent Focus Timers**: Start, pause, resume, and stop focus sessions. Preserves elapsed time across browser refreshes and server restarts, with automatic activity and goal progress sync.
- **Reminders & Push Notifications**: Web Push (VAPID) and schedule-linked reminders dispatched automatically via background workers.
- **Tasks & Routines**: Group schedules into morning/evening routines and track discrete action items.
- **Career Management**: Track job applications, interview stages, offers, and conversion rates.
- **Production MCP Server (`/mcp`)**: Full Model Context Protocol server exposing **42 production tools** for ChatGPT, Claude, and agentic clients over Streamable HTTP and SSE with OAuth 2.1 / PKCE and API Token authentication.

---

## Model Context Protocol (MCP) Server

LifeOS exposes a production MCP server for ChatGPT and AI assistants at:

```
https://lifesos.online/mcp
```

### Quick ChatGPT Integration

1. Go to **Settings** (`/settings`) in your LifeOS dashboard.
2. Under **Model Context Protocol (MCP) Integration**, generate a secure API Token (`los_mcp_...`).
3. In ChatGPT (or your MCP client), configure:
   - **Server URL**: `https://lifesos.online/mcp`
   - **Authorization**: `Bearer <YOUR_LOS_MCP_TOKEN>`
4. Ask ChatGPT:
   - *"What do I have scheduled today?"*
   - *"Start my Java study timer for 2 hours."*
   - *"Schedule Gym every Monday, Wednesday, and Friday at 7 AM."*
   - *"Show me my active goals and progress this week."*

For detailed architecture, OAuth 2.1 RFC 8414 discovery, and full documentation of all 42 tools, see [`docs/MCP.md`](docs/MCP.md).

---

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Backend**: Express 5 on Node.js 24, TypeScript 5.9
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk (`@clerk/express`, `@clerk/clerk-react`) + Secure LifeOS user mapping
- **Frontend**: React 19, Vite 7, Tailwind CSS v4, Lucide Icons
- **MCP Protocol**: `@modelcontextprotocol/sdk` (Streamable HTTP, SSE, JSON-RPC 2.0)
- **Deployment**: Docker containerization on Render

---

## Local Development

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.production.example` to `.env` in the root and fill in your PostgreSQL and Clerk credentials:
```bash
cp .env.production.example .env
```

Required keys:
- `DATABASE_URL` — PostgreSQL connection string (Supabase / Neon / Local Postgres)
- `CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`

### 3. Run Development Server
```bash
# Start API Server & MCP (port 5000)
pnpm --filter @workspace/api-server run dev

# Start Frontend (port 5173)
pnpm --filter @workspace/lifeos run dev
```

### 4. Running Tests & Quality Checks
```bash
# Run all unit and integration test suites
pnpm test

# Full workspace TypeScript validation
pnpm run typecheck

# Production build
pnpm run build
```

---

## Production Deployment

LifeOS is configured for automated deployment via Docker:
- Deployment blueprint: `render.yaml`
- Dockerfile: `./Dockerfile`
- Health check endpoint: `/api/healthz`
- MCP endpoint: `/mcp` (or `/api/mcp`)
- OAuth 2.1 discovery: `/.well-known/oauth-authorization-server`
