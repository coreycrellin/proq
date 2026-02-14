# Mission Control — Claude Code Guide

## Project Overview
Project management dashboard for managing multiple coding projects. Designed to be controlled by an AI agent (Twin) that dispatches Claude Code sub-agents to work on tasks.

**Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, lowdb, @dnd-kit, uuid

## Quick Start
```bash
npm run dev    # Start dev server (localhost:3000)
npm run build  # Production build
npm run lint   # ESLint
```

## Architecture

### Directory Structure
```
src/
├── app/
│   ├── api/projects/           # REST API routes
│   │   ├── route.ts            # GET/POST projects
│   │   └── [id]/
│   │       ├── route.ts        # GET/PATCH/DELETE project
│   │       ├── tasks/          # GET/POST tasks, PATCH/DELETE [taskId]
│   │       └── chat/           # GET/POST chat messages
│   ├── globals.css             # CSS variables, dark theme, custom scrollbars
│   ├── layout.tsx              # Root layout (dark mode, Geist fonts)
│   └── page.tsx                # Main dashboard (all client state lives here)
├── components/
│   ├── Sidebar.tsx             # Project list with status indicators
│   ├── TopBar.tsx              # Project header + tab switcher
│   ├── KanbanBoard.tsx         # 4-column drag-drop board (@dnd-kit)
│   ├── TaskCard.tsx            # Individual task display
│   ├── ChatPanel.tsx           # Terminal-style chat interface
│   ├── LiveTab.tsx             # Iframe dev server preview
│   └── CodeTab.tsx             # Code editor launcher
└── lib/
    ├── db.ts                   # lowdb database operations
    ├── types.ts                # All TypeScript interfaces
    └── utils.ts                # cn() utility (clsx + tailwind-merge)
```

### Data Layer
- **`data/config.json`** — Project registry (id, name, path, status, serverUrl)
- **`data/state/{id}.json`** — Per-project state (tasks array + chatLog array)
- **`data/state/` is gitignored** — Each user has their own local state
- Database: lowdb (JSON file storage, no external DB needed)

### Key Types (src/lib/types.ts)
- **Project**: `{ id, name, path, status, serverUrl, createdAt }`
- **Task**: `{ id, title, description, status, priority, findings, humanSteps, agentLog, createdAt, updatedAt }`
- **ChatLogEntry**: `{ role: 'twin'|'brian', message, timestamp, toolCalls? }`
- Task statuses: `todo` → `in-progress` → `verify` → `done`
- Project statuses: `active`, `review`, `idle`, `error`

### API Routes
```
GET/POST       /api/projects              # List or create projects
GET/PATCH/DEL  /api/projects/[id]         # Single project CRUD
GET/POST       /api/projects/[id]/tasks   # List or create tasks
PATCH/DEL      /api/projects/[id]/tasks/[taskId]  # Update or delete task
GET/POST       /api/projects/[id]/chat    # Chat history
```

## Conventions

### Code Style
- Components: PascalCase filenames matching component name
- Props: `{ComponentName}Props` interfaces
- State: All dashboard state managed in `page.tsx` via useState
- Event handlers: `handle{Action}` naming
- All interactive components use `'use client'` directive

### Styling
- Dark mode only (class-based via `className="dark"`)
- Zinc color palette (zinc-800/900/950 backgrounds)
- Accent: blue-400 (active), green-400 (success), red-400 (error)
- CSS variables for theming in globals.css
- Utility-first Tailwind, minimal custom CSS

### Data Flow
- Fetch all projects on mount, then tasks for each project
- Chat loaded on project switch
- Optimistic UI updates for drag-drop task moves
- API calls use standard fetch with JSON bodies

### Agent Integration
Tasks have fields specifically for AI agent use:
- `findings` — Agent's analysis/findings (newline-separated)
- `humanSteps` — Action items for human review (newline-separated)
- `agentLog` — Execution log from agent session
- Task flow: Todo → In Progress (agent working) → Verify (human review) → Done

## Important Notes
- Path alias: `@/*` maps to `./src/*`
- `design-mock/` is a separate Vite prototype — not part of the main app
- lowdb v7 uses ESM — all db operations are async
- The app runs on port 3000 by default
