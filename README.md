# Tasker

A self-hosted, single-user task management app with five views (table, Kanban, calendar, week, Gantt timeline), sprint planning, user stories, Markdown notes, templates, and a dashboard — all backed by a local SQLite database with zero cloud dependency.

---

## Table of Contents

- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
- [Workspaces](#workspaces)
- [Application Guide](#application-guide)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Data Storage & Backup](#data-storage--backup)
- [Tech Stack](#tech-stack)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (SPA)                     │
│  React 19 · Zustand · TanStack Query · Tailwind CSS │
│  FullCalendar · Recharts · dnd-kit · MDEditor       │
└────────────────────────┬────────────────────────────┘
                         │ REST / JSON
┌────────────────────────┴────────────────────────────┐
│              Express 5 (Node.js + TypeScript)        │
│         Serves API + static client in production     │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────┐
│              SQLite via better-sqlite3 (WAL mode)    │
│                   ~/.tasker/tasker.db                 │
└─────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 18 or newer | Includes npm. Check with `node -v`. |
| npm | 9 or newer | Check with `npm -v`. |

The database driver (`better-sqlite3`) ships prebuilt binaries for common platforms. If npm has to compile it from source, you also need a C/C++ toolchain (Windows: *Visual Studio Build Tools* with the "Desktop development with C++" workload; macOS: `xcode-select --install`; Linux: `build-essential` and `python3`).

### Install

Tasker has two `package.json` files — one for the server (repo root) and one for the client (`client/`). Install both:

```bash
git clone <repo-url> Tasker      # or copy the folder
cd Tasker
npm install
cd client && npm install && cd ..
```

### Run (production mode)

```bash
npm start
```

This builds the client (`client/dist`), starts the Express server, and opens <http://localhost:3000> in your browser. The server serves both the API and the built UI, so only one process is needed. Stop it with `Ctrl+C`.

To use a different port:

```bash
PORT=4000 npm start              # macOS / Linux / Git Bash
$env:PORT=4000; npm start        # Windows PowerShell
```

### Run (development mode)

Use two terminals for hot reload:

```bash
npm run dev:server    # Express API on :3000, restarts on file changes
npm run dev:client    # Vite dev server on :5173, proxies /api to :3000
```

Open <http://localhost:5173> in dev mode. The Vite proxy targets port 3000, so keep the API on its default port while developing.

### npm scripts

| Script | Where | What it does |
| --- | --- | --- |
| `npm start` | root | Build the client, then start the server and open the browser |
| `npm run dev` | root | Start the server once (no client build, no file watcher) |
| `npm run dev:server` | root | Start the server with a file watcher (`tsx watch`) |
| `npm run dev:client` | root | Start the Vite dev server (runs `npm run dev` in `client/`) |
| `npm run build:client` | root | Type-check and build the client into `client/dist` |
| `npm run lint` | `client/` | Run ESLint on the client |

### First run

The database is created automatically on first start at `~/.tasker/tasker.db` (on Windows: `C:\Users\<you>\.tasker\tasker.db`), seeded with the default statuses and templates. It becomes your **Default** workspace (see [Workspaces](#workspaces)). Nothing else needs to be configured.

Optional environment variables:

| Variable | Effect |
| --- | --- |
| `PORT` | HTTP port (default `3000`) |
| `TASKER_HOME` | Use another data folder instead of `~/.tasker` (handy for testing or a portable setup) |
| `TASKER_NO_OPEN` | Set to any value to stop the server opening your browser on start |

### Quick tour

1. Press `Ctrl/⌘ + J`, type a title, and press Enter to capture your first task.
2. Open **Tasks** (`2`) and try the five views — Table, Kanban, Calendar, Week, Timeline — from the toolbar. Click any task to open the detail panel on the right.
3. Create a sprint in **Settings**, activate it, and assign tasks to it. **Sprint Overview** and the **Dashboard** then show progress.
4. Use **My Day** (`4`) to pick what you'll work on today, and **Work Summary** to generate a Markdown report of what you finished.
5. Use `Ctrl/⌘ + K` any time to search tasks, stories, and notes.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE` / port already in use | Another process uses port 3000. Stop it or run with a different `PORT`. |
| Blank page or "Cannot GET /" after `npm run dev` | The client has not been built. Use `npm start`, or run `npm run build:client` once. |
| `better-sqlite3` install or "invalid ELF/Win32 application" errors | Install the build tools listed above, then `npm rebuild better-sqlite3`. Reinstall dependencies if you copied `node_modules` from another OS. |
| Connection banner / toast in the UI | The API server is not running or crashed — check the terminal running the server. |
| Browser does not open automatically | Open <http://localhost:3000> manually. |

### Project structure

```
package.json            server scripts and dependencies
server/
  index.ts              Express bootstrap, route registration, static serving
  db.ts                 SQLite connection pool (one per workspace) and schema/migration runner
  workspaces.ts         workspace registry, create/rename/delete, per-request selection
  schema.sql            tables, indexes, seed data, additive migrations
  routes/               one module per domain (tasks, notes, sprints, ...)
client/
  package.json          frontend dependencies and build/lint scripts
  vite.config.ts        React + Tailwind plugins, "@" alias, /api proxy
  src/
    api.ts · hooks.ts   typed REST client and TanStack Query hooks
    store.ts            persisted UI/filter state (Zustand)
    lib/workspace.ts    which workspace this browser tab uses
    components/         one component per space, view, or control
resources/ideas/        original requirements specification
TASKER_RECREATION_BRIEF.md   implementation brief for rebuilding the app
```

---

## Core Concepts

- **Statuses** belong to a **phase**: *Planning* (pre-work), *Execution* (active work), or *Any*. The defaults are Backlog → Baking → Collecting Info → Ready for Work → To Do → In Progress → In Review → Done, plus Blocked. You can customize these in Settings.
- **Sprints** are time-boxed iterations with optional start/end dates. One sprint can be *active* at a time. Tasks and user stories can be assigned to a sprint.
- **Labels** are color-coded tags shared across tasks, user stories, and notes. Labels can be hidden (archived) without being deleted.
- **User Stories** are higher-level requirements that group related tasks.
- **Templates** define reusable Markdown content and subtask checklists that can be applied when creating tasks or notes.
- **Task flags**: ❗️ Priority · ⚡️ Quick · 🪢 Requires Other (blocked by external dependency).
- **Recurring tasks** auto-generate the next occurrence when marked Done (daily, weekdays, weekly, biweekly, monthly).

---

## Workspaces

A workspace is a completely separate Tasker database — its own tasks, stories, notes, statuses, sprints, labels, templates, settings and uploaded images. Use them to keep, say, work and personal planning apart.

- **Switch** from the small menu at the top of the sidebar, opposite the Tasker logo. The browser tab title shows the active workspace.
- **Create, rename, switch to and delete** workspaces in **Settings → Workspaces**, which also shows each workspace's folder, task count and last-modified time.
- **Two tabs, two workspaces:** every browser tab remembers its own workspace, so you can work in different workspaces side by side. A new tab starts in the workspace you used last.
- **Your existing data is the "Default" workspace.** It stays exactly where it always was (`~/.tasker/tasker.db` and `~/.tasker/uploads/`) — it is registered in place, never moved or copied. It can be renamed but never deleted.
- **Deleting** a workspace needs two confirmations (a warning, then typing its name). Nothing is erased outright: the folder is moved to `~/.tasker/trash/`, so you can restore it by hand if you change your mind. You can't delete the workspace you are currently in.
- **Filters** (status, sprint, label…) are remembered per workspace, since they refer to that workspace's own IDs.
- If a workspace's database file goes missing or can't be opened, Tasker shows it as unavailable and offers to switch to another workspace instead of creating an empty database.

Where things live on disk:

| Path | Contents |
| --- | --- |
| `~/.tasker/tasker.db`, `~/.tasker/uploads/` | The Default workspace (original location) |
| `~/.tasker/workspaces/<id>/` | Every other workspace: `tasker.db` and `uploads/` |
| `~/.tasker/workspaces.json` | Registry of workspace names (rebuilt automatically if damaged) |
| `~/.tasker/trash/` | Deleted workspaces, kept until you remove them |

---

## Application Guide

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + K` | Global Search |
| `⌘/Ctrl + J` | Quick Add task |
| `Escape` | Close detail panel / Quick Add |
| `1`–`9` | Switch spaces: 1 Dashboard · 2 Tasks · 3 Backlog · 4 My Day · 5 User Stories · 6 Notes · 7 Archive · 8 Sprint Overview · 9 Activity |

Number keys work only when focus is outside text inputs.

### Dashboard

At-a-glance metrics: active/done/overdue task counts, status and phase distribution charts, label breakdown (top 10), active sprint progress with effort tracking, and the 5 most recently updated tasks. Filter by sprint or date range (this week, this month, last 30 days).

### Tasks

The primary workspace. A toolbar lets you switch between five views; all share the same **Filter Bar** (status, sprint, label, phase, free-text search, sort field/direction).

- **Table** — Spreadsheet-style list with inline editing of status, sprint, dates, and effort. Right-click for context menu (archive, duplicate, delete). Hover for quick-action buttons.
- **Kanban** — Drag-and-drop columns grouped by Status, Label, or Due Date. Date grouping auto-buckets into Late / Today / Tomorrow / remaining weekdays / Next Week / Future / No Date. Inline `+` button per column. Toggle to hide completed tasks.
- **Calendar** — Full-month FullCalendar grid. Tasks with `do_date` appear on their day; tasks with `start_date`/`end_date` span multiple days. Drag to reschedule. An "Unscheduled" sidebar shows execution-phase tasks you can drag onto the calendar.
- **Week** — 7-day time grid. Drag tasks between days to reschedule.
- **Timeline (Gantt)** — Horizontal bars for tasks with date ranges. Drag to move or resize edges to change dates. Zoom: Day / Week / Month. Today marker shown as a red line.

Use **From Template** in the toolbar to create a task pre-populated from a template.

### Backlog

Shows only **Planning-phase** tasks (Backlog, Baking, Collecting Info, Ready for Work). Toggle between Kanban and Table layouts. Useful for grooming work before it enters an active sprint.

### My Day

A drag-and-drop daily priority list. Add existing tasks via the search panel or create new ones inline. Tasks show overdue badges when their `do_date` is past. Removing a task from My Day doesn't change its status — it just clears the `my_day_order`.

### User Stories

Master-detail layout: story list on the left, selected story's Markdown details and linked tasks on the right. Each story card shows total/active task counts. Filter by sprint or search by title.

### Notes

Hierarchical Markdown notes with a tree sidebar. Drag notes onto each other to nest them. The editor supports image paste (auto-uploaded). Notes can be tagged with labels, linked to sprints, and bidirectionally linked to tasks. Create from templates for standardized formats.

### Labels

Pick one or more labels to see every task, user story, and note that carries them, grouped into collapsible sections. Click a result to jump to it.

### Sprint Overview

Select a sprint to see task breakdown by status, effort progress (completed vs. estimated days), days remaining, and all sprint tasks grouped by status. You can activate a sprint from here.

### Work Summary

Generates a copyable Markdown report of completed and in-progress work. Scope to: This/Last Week, This/Last Month, a specific Sprint, or a custom date range. Includes task counts, effort totals, and per-task details (labels, sprint, dates).

### Archive

Browse archived tasks and user stories in separate tabs. Search, restore to active state, or permanently delete.

### Templates

Create and edit reusable templates with a name, description, Markdown details content, and a list of subtask titles. Templates can be applied to existing tasks (content is appended) or used to generate new tasks/notes. Default templates are protected from deletion.

### Activity Log

Chronological feed of all changes (creations, status changes, updates, deletions, duplications, recurring task generation). Filter by entity type. Clear all history if needed.

### Settings

Manage **Workspaces** (create, rename, switch, delete), **Statuses** (name, color, phase — cannot delete if in use), **Sprints** (create, set dates, activate), **Labels** (name, color), and **App Settings** (default effort days, default task status). Also provides JSON and CSV export buttons. Labels can be hidden from pickers here without deleting them.

### Quick Add & Global Search

**Quick Add** (`⌘J` or floating `+` button): type a title, press Enter — task is created with the default status. **Global Search** (`⌘K`): searches tasks, stories, and notes. Select multiple task results for bulk status changes or archiving.

---

## Data Model

### Task

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | Task name (required) |
| `status_id` | FK → Status | Current status |
| `user_story_id` | FK? | Parent user story |
| `do_date` | date? | Scheduled date (`YYYY-MM-DD`) |
| `start_date` / `end_date` | date? | Timeline range (Gantt / calendar multi-day) |
| `sprint_id` | FK? | Sprint assignment |
| `effort_estimate` | number? | Effort in days |
| `details` | string | Markdown body |
| `is_priority` | bool | ❗️ flag |
| `is_quick` | bool | ⚡️ flag |
| `requires_other` | bool | 🪢 external blocker (`requires_other_note` for description) |
| `recurrence_rule` | string? | `daily` · `weekdays` · `weekly` · `biweekly` · `monthly` |
| `color_override` | string? | Custom hex color for calendar/timeline |
| `is_archived` | bool | Soft-delete |
| `completed_at` | datetime? | Set when the task enters *Done*, cleared if it leaves |

Plus: **labels** (many-to-many), **subtasks** (ordered checklist), `my_day_order` / `kanban_order` (view positions), `template_origin_id`, `recurrence_parent_id`.

### Status

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Unique name |
| `phase` | enum | `planning` · `execution` · `any` |
| `color` | string | Hex color |
| `sort_order` | number | Display order |

The phase controls visibility (Backlog space = planning only) and dashboard grouping.

### Sprint

`name`, optional `start_date`/`end_date`, `is_active` flag. Only one sprint active at a time.

### Label

`name` (unique), `color`, `is_hidden`. Shared across tasks, user stories, and notes via join tables.

### User Story

Same status/sprint/label/archive model as tasks, plus a `details` Markdown field. Tasks reference stories via `user_story_id`.

### Note

`title`, `content` (Markdown), optional `sprint_id`, `parent_id` (for nesting), `sort_order`, and labels.

### Template

`name` (unique), `description`, `details_content` (Markdown), `subtasks_json` (JSON string array), `is_default`.

### Relationships

| Link | Description |
| --- | --- |
| Task → User Story | `task.user_story_id` |
| Task → Sprint | `task.sprint_id` |
| Task Dependencies | Directional "blocked by" with circular-dependency detection |
| Task Relations | Bidirectional peer links |
| Task ↔ Note | Bidirectional links |
| Note → Note | Parent/child nesting via `parent_id` |

---

## API Reference

All endpoints are under `/api`. Bodies are JSON. `GET /api/health` returns `{ status, db, workspace }`.

### Tasks (`/api/tasks`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/tasks` | List tasks (with filters: `is_archived`, `status_id`, `sprint_id`, `label_id`, `search`, `status_phase`, `do_date_from`, `do_date_to`, `has_do_date`) |
| GET | `/api/tasks/:id` | Get single task with labels and subtasks |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/tasks/:id/duplicate` | Duplicate a task with its labels and subtasks |
| PUT | `/api/tasks/kanban/reorder` | Reorder tasks in Kanban view (`{ order: [id, ...] }`) |
| GET | `/api/tasks/work-summary` | Get work summary data (`scope`, `sprint_id`, `date_from`, `date_to`) |

### My Day (`/api/tasks/my-day`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/tasks/my-day/:taskId` | Add a task to My Day |
| DELETE | `/api/tasks/my-day/:taskId` | Remove a task from My Day |
| PUT | `/api/tasks/my-day/reorder` | Reorder My Day tasks (`{ order: [id, ...] }`) |

### Subtasks (`/api/tasks/:taskId/subtasks`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/tasks/:taskId/subtasks` | Add a subtask |
| PUT | `/api/tasks/:taskId/subtasks/:subtaskId` | Update a subtask |
| DELETE | `/api/tasks/:taskId/subtasks/:subtaskId` | Delete a subtask |
| PUT | `/api/tasks/:taskId/subtasks-order` | Reorder subtasks (`{ order: [id, ...] }`) |

### Dependencies & Relations (`/api/tasks/:id/…`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/tasks/:id/dependencies` | Get tasks that block this task |
| GET | `/api/tasks/:id/dependents` | Get tasks that this task blocks |
| POST | `/api/tasks/:id/dependencies` | Add a dependency (`{ depends_on_task_id }`) |
| DELETE | `/api/tasks/:id/dependencies/:depId` | Remove a dependency |
| GET | `/api/tasks/:id/relations` | Get related tasks |
| POST | `/api/tasks/:id/relations` | Add a relation (`{ related_task_id }`) |
| DELETE | `/api/tasks/:id/relations/:relId` | Remove a relation |

### Task ↔ Note Links (`/api/tasks/:id/linked-notes`, `/api/notes/:id/linked-tasks`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/tasks/:id/linked-notes` | Get notes linked to a task |
| POST | `/api/tasks/:id/linked-notes` | Link a note to a task (`{ note_id }`) |
| DELETE | `/api/tasks/:id/linked-notes/:noteId` | Unlink a note from a task |
| GET | `/api/notes/:id/linked-tasks` | Get tasks linked to a note |
| POST | `/api/notes/:id/linked-tasks` | Link a task to a note (`{ task_id }`) |
| DELETE | `/api/notes/:id/linked-tasks/:taskId` | Unlink a task from a note |

### Statuses (`/api/statuses`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/statuses` | List all statuses (ordered by `sort_order`) |
| POST | `/api/statuses` | Create a status (`{ name, phase, color }`) |
| PUT | `/api/statuses/:id` | Update a status |
| PUT | `/api/statuses/reorder` | Reorder statuses (`{ order: [id, ...] }`) |
| DELETE | `/api/statuses/:id` | Delete a status (fails if in use) |

### Sprints (`/api/sprints`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/sprints` | List all sprints |
| GET | `/api/sprints/:id` | Get single sprint |
| POST | `/api/sprints` | Create a sprint (`{ name, start_date, end_date }`) |
| PUT | `/api/sprints/:id` | Update a sprint |
| POST | `/api/sprints/:id/activate` | Set a sprint as the active sprint |
| DELETE | `/api/sprints/:id` | Delete a sprint (unassigns tasks/stories) |

### Labels (`/api/labels`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/labels` | List all labels |
| POST | `/api/labels` | Create a label (`{ name, color }`) |
| PUT | `/api/labels/:id` | Update a label |
| DELETE | `/api/labels/:id` | Delete a label (removes all associations) |

### User Stories (`/api/user-stories`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/user-stories` | List user stories (with filters: `is_archived`, `status_id`, `sprint_id`, `label_id`, `search`, `status_phase`) |
| GET | `/api/user-stories/:id` | Get single story with tasks and labels |
| POST | `/api/user-stories` | Create a user story (`{ title, status_id, sprint_id, details, label_ids }`) |
| PUT | `/api/user-stories/:id` | Update a user story |
| DELETE | `/api/user-stories/:id` | Delete a user story (unlinks tasks) |

### Notes (`/api/notes`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/notes` | List notes (with filters: `sprint_id`, `label_id`, `search`) |
| GET | `/api/notes/:id` | Get single note with labels and links |
| POST | `/api/notes` | Create a note (`{ title, content, sprint_id, parent_id, label_ids }`) |
| PUT | `/api/notes/:id` | Update a note |
| PUT | `/api/notes/reorder/batch` | Batch reorder notes (`{ items: [{ id, parent_id, sort_order }] }`) |
| DELETE | `/api/notes/:id` | Delete a note |

### Templates (`/api/templates`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/templates` | List all templates |
| GET | `/api/templates/:id` | Get single template |
| POST | `/api/templates` | Create a template (`{ name, description, details_content, subtasks_json }`) |
| PUT | `/api/templates/:id` | Update a template |
| DELETE | `/api/templates/:id` | Delete a template (cannot delete defaults) |
| POST | `/api/templates/:id/apply/:taskId` | Apply template to existing task |
| POST | `/api/templates/:id/create-task` | Create a new task from template |
| POST | `/api/templates/:id/create-note` | Create a new note from template |

### Workspaces (`/api/workspaces`)

Every other `/api` request runs against one workspace, chosen by the `X-Workspace: <id>` header (or `?ws=<id>` for URLs the browser loads itself, such as images and downloads). With neither, the **default** workspace is used, so existing scripts and old image links keep working. An unknown id returns `404` with `code: "WORKSPACE_NOT_FOUND"`; a missing or corrupt database returns `503` with `code: "WORKSPACE_UNAVAILABLE"`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/workspaces` | List workspaces (`?stats=1` adds task count and last-modified time) |
| POST | `/api/workspaces` | Create a workspace with its own database (`{ name }`) |
| PUT | `/api/workspaces/:id` | Rename (`{ name }`); files on disk are not touched |
| DELETE | `/api/workspaces/:id` | Move to trash (`{ confirm_name }` must equal the workspace name). Rejected for the default workspace and for the workspace named in `X-Workspace` |

### Other Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/dashboard` | Dashboard stats (optional: `sprint_id`, `date_from`, `date_to`) |
| GET | `/api/search?q=…` | Global search across tasks, stories, and notes |
| GET | `/api/activity` | Activity log (optional: `entity_type`, `entity_id`, `limit`) |
| DELETE | `/api/activity` | Clear all activity history |
| GET | `/api/settings` | Get all app settings as key-value |
| PUT | `/api/settings/:key` | Update a setting (`{ value }`) |
| POST | `/api/uploads` | Upload base64 image (`{ data, filename }`) → returns `{ url }` |
| GET | `/api/uploads/:filename` | Serve uploaded image |
| GET | `/api/export/json` | Download full data as JSON |
| GET | `/api/export/tasks-csv` | Download tasks as CSV (`?include_archived=true`) |

---

## Data Storage & Backup

All data lives locally — no accounts, no cloud sync:

| Path | Contents |
| --- | --- |
| `~/.tasker/tasker.db` | SQLite database of the Default workspace (WAL mode). Auto-created on first run; schema migrations handled automatically. |
| `~/.tasker/uploads/` | Uploaded images of the Default workspace (pasted into Markdown editors). |
| `~/.tasker/workspaces/<id>/` | Database and uploads of each additional [workspace](#workspaces). |

The `~/.tasker/` path avoids conflicts with cloud-synced project directories (OneDrive, Dropbox, etc.).

**Backup:**

```bash
cp ~/.tasker/tasker.db ~/.tasker/tasker-backup-$(date +%Y%m%d).db
```

To back up everything including all workspaces, copy the whole `~/.tasker/` folder while Tasker is stopped.

You can also export via the Settings UI or the `/api/export/json` and `/api/export/tasks-csv` endpoints (see [API Reference](#api-reference)).

---

## Tech Stack

| Technology | Purpose |
| --- | --- |
| **Express 5** | HTTP server and REST API |
| **better-sqlite3** | SQLite database (synchronous, WAL mode) |
| **React 19** + **TypeScript** | UI framework |
| **Vite 8** | Build tool and dev server |
| **Tailwind CSS 4** | Utility-first styling (dark theme) |
| **Zustand** | Client state management |
| **TanStack Query / Table** | Server-state caching, headless table |
| **@dnd-kit** | Drag and drop (Kanban, My Day, subtasks) |
| **FullCalendar** | Calendar and week views |
| **Recharts** | Dashboard charts |
| **@uiw/react-md-editor** | Markdown editing |
| **date-fns** | Date utilities |
| **Lucide React** | Icons |

---

## License

ISC
