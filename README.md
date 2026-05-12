# VIEW

AI-native operating system for corporate volunteer programs. Two workspaces share one Postgres database: a corporate side (Acme Robotics) for vetting nonprofits, activating events, and reporting up — and a nonprofit side (Greater Austin Food Bank / Boys & Girls Clubs) for publishing events, running donation campaigns, and managing volunteer rosters.

Brand promise: **AI as operator, not autopilot.** Every AI-generated artifact has explicit Approve / Edit / Reject, an "as of" timestamp, and clear attribution. State changes only on human approval.

Built per [`view-build-prompt-v5.md`](https://example.com) — see `<build_phases>` in that document for the phase plan.

## Stack

- **Next.js 16** App Router + React 19 + TypeScript (Turbopack default)
- **Tailwind CSS 4** via `@theme inline` in `globals.css` (no `tailwind.config.ts` — Tailwind 4 is CSS-first)
- **shadcn/ui** primitives in `src/components/ui/`
- **Drizzle ORM** on **Neon Postgres** (HTTP driver, works on edge)
- **Vercel AI SDK 6** (`ai`) + **Anthropic SDK** (`@anthropic-ai/sdk`) for streaming diligence and recaps
- **Adapter pattern**: every external integration (ProPublica, Charity Navigator, Anthropic) has both a `LiveAdapter` and a `FixtureAdapter`. `DATA_MODE` selects which is active. Default is `fixture` — demos work without any API keys.
- `pnpm` as the package manager.

## Install

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local — at minimum set DATABASE_URL to a Neon connection string.
# For fixture mode (default), no API keys are required.
```

## Database setup

```bash
pnpm db:generate   # generate migrations from src/db/schema.ts
pnpm db:migrate    # apply migrations to the Neon DB at DATABASE_URL
pnpm db:seed       # populate workspaces, partners, events, donations, recap
```

`drizzle-kit studio` is available via `pnpm db:studio` for inspecting the DB.

## Run

```bash
pnpm dev          # http://localhost:3000 — DATA_MODE=fixture (the default)
```

Other modes:

```bash
pnpm dev:live     # DATA_MODE=live — calls real ProPublica + Anthropic (requires ANTHROPIC_API_KEY)
pnpm fixtures:capture   # DATA_MODE=live CAPTURE_FIXTURES=true — captures new fixtures as a side effect
```

## Routes

The whole app lives under a single `(app)` route group; the active workspace cookie (`view.activeWorkspace`) controls which register (operator/cyan or field/green) renders. Pick a workspace from `/`.

**Corporate-only:** `/workbench`, `/discover`, `/matching`, `/recaps`
**Nonprofit-only:** `/home`, `/volunteers`
**Shared (workspace-aware):** `/campaigns`, `/partners`, `/events`

## Phase status

| Phase | What's in | Status |
| --- | --- | --- |
| 1 | Scaffolding, design system, sidebar + top bar chrome, adapter scaffolding, seed | **✅ done** |
| 2 | AI Diligence (HERO) — streaming Blueprint document with 5 sections, fixture + live | Pending |
| 3 | Nonprofit event creation + corporate Discover + activation comms drafts | Pending |
| 4 | Donation matching + giving campaigns | Pending |
| 5 | Bidirectional event flow + Operator Workbench | Pending |
| 6 | Recaps + marketing artifacts | Pending |

## Project layout

```
src/
  app/
    (app)/          # all workbench pages (cyan or green via data-accent on layout)
    api/
      workspace/    # POST sets active workspace cookie
    page.tsx        # Blueprint landing — workspace picker
    layout.tsx      # root layout, fonts
    globals.css     # @theme inline tokens, accent CSS variables, body chrome
  components/
    layout/         # Sidebar, TopBar, ClaudeStatusPill, WorkspaceSwitcher, *Badge
    shared/         # AIApprovalBar, SourceMarker, StatusPill, EyebrowLabel, BlueprintDocument
    landing/        # WorkspacePickerCards
    ui/             # shadcn primitives
  db/
    schema.ts       # Drizzle Postgres schema (workspaces → recaps)
    client.ts       # lazy Neon HTTP driver
    seed.ts         # idempotent seed script
  lib/
    data-mode.ts    # getDataMode() — reads DATA_MODE env
    workspaces.ts   # static registry with deterministic UUIDs
    active-workspace.ts # cookie reader
    scoped-db.ts    # workspaceId-scoped query helper
    propublica/     # adapter: index.ts | types.ts | live.ts | fixture.ts
    charity-navigator/  # adapter: same shape
    llm/            # adapter: same shape (streams with replay cadence)
    fixtures/       # captured ProPublica / Charity Navigator / Claude responses
    scripts/        # one-off smoke and utility scripts
    utils.ts        # cn()
```

## Adapter contract

Every external call goes through one of three packages:

- `lib/propublica/` — `propublica.search(query)`, `propublica.getOrganization(ein)`
- `lib/charity-navigator/` — `charityNavigator.getRating(ein)` (returns null when no fixture / no key)
- `lib/llm/` — `llm.streamText({ fixtureKey, systemPrompt, userPrompt })`, `llm.generateObject({ schema, ... })`

The `getDataMode()` function selects live or fixture at module load. **No route handler imports `fetch` for these services directly; no route handler imports the Anthropic SDK directly.** Bypassing the adapter breaks fixture mode and breaks demos.

To capture new fixtures for a new EIN or flow:

```bash
DATA_MODE=live CAPTURE_FIXTURES=true ANTHROPIC_API_KEY=sk-ant-... pnpm dev
# Walk through the flow in the UI. Fixtures land in src/lib/fixtures/ as a side effect.
# Commit them.
```

## Workspace boundary

`scopedDb(workspaceId)` wraps the Drizzle client. Every DB read by a route handler must call this. Cross-workspace reads (e.g., corporate reading nonprofit events through the partner relationship) are explicit exceptions and must carry a `// CROSS_WORKSPACE_READ: <justification>` comment.

## Demo defaults

- `DATA_MODE=fixture` — no API costs, deterministic streaming cadence
- `DEMO_MODE=true` — top-bar "Demo mode" badge visible, "Simulate donation" button enabled (Phase 4)

## Deploy

Push to GitHub and import in Vercel. Add the Neon integration — it provisions a Postgres branch per preview deploy and sets `DATABASE_URL` automatically. The build command (`pnpm db:migrate && next build`) runs migrations against the preview branch DB.

For preview environments, leave `DATA_MODE=fixture` — preview deploys cost no API spend.
