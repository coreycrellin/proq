# Mission Control

A project management dashboard for managing multiple coding projects — built to serve as the control plane for AI-assisted development workflows.

## Features

- **Project Sidebar** — Persistent left panel showing all projects with real-time status indicators (active, review, idle, error)
- **Kanban Board** — 4-column drag-and-drop task board (Todo → In Progress → Verify → Done) powered by @dnd-kit
- **Chat Panel** — Terminal-style activity log and chat interface with resizable split pane
- **Live Preview** — Embedded iframe for viewing running dev servers
- **Code Tab** — Quick launcher for opening projects in your editor
- **Agent-Ready API** — RESTful endpoints designed for AI agent integration, with task fields for findings, human review steps, and execution logs

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** lowdb (JSON file storage)
- **Drag & Drop:** @dnd-kit
- **Icons:** Lucide React

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Data Storage

Mission Control uses file-based JSON storage — no external database required.

- `data/config.json` — Project registry
- `data/state/{project-id}.json` — Per-project tasks and chat history

State files are gitignored so each environment maintains its own data.

## API

All endpoints are under `/api/projects`:

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/projects` | GET, POST | List or create projects |
| `/api/projects/[id]` | GET, PATCH, DELETE | Single project operations |
| `/api/projects/[id]/tasks` | GET, POST | List or create tasks |
| `/api/projects/[id]/tasks/[taskId]` | PATCH, DELETE | Update or delete a task |
| `/api/projects/[id]/chat` | GET, POST | Chat/activity log |

## Scripts

```bash
npm run dev    # Development server
npm run build  # Production build
npm run start  # Production server
npm run lint   # ESLint
```
