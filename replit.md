# LifeOS

LifeOS is a personal career and life operating system for turning recurring commitments into an honest daily execution view.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/lifeos/src/` — React app, Clerk routes, responsive shell, Today view, and Goals management.
- `artifacts/api-server/src/routes/` — Express REST routes for health, dashboard, today, and goals.
- `artifacts/api-server/src/lib/lifeos.ts` — user bootstrap, daily-goal generation, scoring, and response mapping.
- `lib/api-spec/openapi.yaml` — API contract source of truth.
- `lib/db/src/schema/` — Drizzle schema for users, profiles, goals, daily goals, and goal progress.

## Architecture decisions

- Clerk owns browser authentication; the API accepts only authenticated Clerk sessions on user-owned routes.
- Recurring goals are stored separately from date-specific daily goal instances, so changing a goal does not rewrite history.
- Daily score uses transparent category weights and clamps each measurable goal at 100% completion.
- New accounts receive a small starter goal set on first authenticated API access so the first Today view is useful.

## Product

- Public LifeOS landing page with branded Clerk sign-in and sign-up screens.
- Today view with daily completion, daily score, category balance, streak signal, and incremental progress controls.
- Goals view with create, edit, pause/resume, and delete flows.
- Settings view with account status and clearly labeled later-phase areas.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.
- The generated API client needs `dom.iterable` in `lib/api-client-react/tsconfig.json` for its `Headers.entries()` typing.
- Production Clerk proxy wiring is mounted at `/api/__clerk`; browser API calls stay same-origin and do not attach bearer tokens.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
