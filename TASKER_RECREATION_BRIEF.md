# Tasker Recreation Brief

This document is a self-contained implementation brief for recreating Tasker on another machine. Treat it as the compatibility and design reference for the current repository. Preserve the behaviors, visual language, information architecture, and data relationships described here unless the product owner explicitly requests an adjustment.

The original application is a local-first, single-user task and work-management system. It is designed for one person using one browser tab, with no account system, cloud service, or collaboration protocol. The application should feel like a dense but calm desktop workbench: fast scanning, immediate edits, keyboard access, and a persistent right-side detail surface.

## 1. Product Contract

Tasker combines:

- Task capture, planning, execution, scheduling, and archiving.
- A unified status pipeline shared by tasks and user stories.
- Multiple synchronized task representations: table, Kanban, calendar, week, and Gantt-style timeline.
- Sprint planning and effort tracking in days.
- User stories as parent containers for tasks.
- Hierarchical Markdown notes with labels and links.
- Reusable templates for tasks, user stories, and notes.
- Cross-entity search, activity history, data export, and configurable statuses.
- A local SQLite database with immediate persistence.

All views read and mutate the same underlying records. A status, label, date, sprint, archive, or ordering change made in one view must be visible in other relevant views after the mutation completes.

### Product boundaries

- Single user and single browser tab only.
- No authentication, multi-user permissions, remote sync, or conflict resolution.
- No light theme. The visual system is dark-only.
- No cross-space drag and drop. Moving an item between conceptual spaces is done with an explicit action or context menu.
- Dependencies are informational. Do not enforce them or draw dependency arrows in the timeline.
- Markdown is the content format. Use a Markdown editor/preview, not a rich-text WYSIWYG editor.

## 2. Architecture

Use a small two-tier local application:

```text
Browser
  React 19 + TypeScript + Vite
  Zustand for UI/filter persistence
  TanStack Query for server state and cache invalidation
  Tailwind CSS 4 for styling
  FullCalendar, Recharts, dnd-kit, Markdown editor
        | REST/JSON under /api
Express 5 + Node.js + TypeScript
  API routes and production static-file serving
        | synchronous local access
SQLite via better-sqlite3
  WAL mode, foreign keys enabled, local file
```

### Required runtime behavior

- `npm start` builds the client, starts Express, and opens `http://localhost:3000`.
- Express serves the built SPA and all `/api/*` routes from one process in production.
- The default port is `3000`; allow `PORT` to override it.
- Vite development mode runs on its normal port and proxies `/api` to `http://localhost:3000`.
- The database is created automatically on first start at `~/.tasker/tasker.db`. Keep this location outside cloud-synced folders because SQLite WAL files and sync clients can conflict.
- Enable SQLite `journal_mode = WAL` and `foreign_keys = ON`.
- Apply the schema automatically at startup. Additive `ALTER TABLE` migrations must be safe to run repeatedly; an already-existing column should not prevent startup.
- Use `express.json({ limit: '10mb' })` because Markdown notes may contain image data or large content.
- Provide `GET /api/health` returning `{ status: 'ok', db: 'connected' }` when the database is healthy.
- Open the browser after the server starts, but tolerate environments where automatic opening fails.
- Close the database and HTTP server on `SIGINT` and `SIGTERM`.

### Exact package choices

Use the existing ecosystem rather than replacing it with an unrelated framework:

**Server:** `express`, `better-sqlite3`, `cors`, `open`, `tsx`, `typescript`.

**Client:** `react`, `react-dom`, `react-router-dom`, `zustand`, `@tanstack/react-query`, `@tanstack/react-table`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@fullcalendar/react`, `@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `recharts`, `@uiw/react-md-editor`, `react-markdown`, `remark-gfm`, `date-fns`, `lucide-react`, `clsx`, and `tailwind-merge`.

Use the versions compatible with the source repository's manifests. The current source uses React 19, TypeScript 6, Vite 8, Tailwind 4, Express 5, Zustand 5, TanStack Query 5, Recharts 3, FullCalendar 6, and dnd-kit 6/10.

## 3. Repository Shape

Keep the implementation split similarly:

```text
package.json                 root scripts and server dependencies
client/
  index.html
  package.json               frontend dependencies and build/lint scripts
  vite.config.ts             React, Tailwind, @ alias, /api proxy
  src/
    api.ts                   typed REST client
    hooks.ts                 TanStack Query queries and mutations
    store.ts                 persisted UI/filter state and connection toasts
    types.ts                 domain and API types
    main.tsx                 React root and QueryClient setup
    App.tsx                  persistent shell and space switch
    index.css                Tailwind theme and library overrides
    components/              one component per major space/view/control
    hooks/                   keyboard shortcut hook
    lib/                     sorting, utilities, image upload
  public/                    favicon and public assets
server/
  index.ts                   Express bootstrap and route registration
  db.ts                      database initialization and migration runner
  schema.sql                 schema, indexes, seed data, migrations
  routes/                    one route module per domain
```

Use the `@` alias for `client/src`, PascalCase component filenames, typed API wrappers, and query invalidation after successful mutations.

## 4. Visual Language and Layout

### Theme

The UI is dark-only and should be designed from the start as a dark interface, not as a light interface with colors inverted later. Use these semantic Tailwind theme tokens:

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#0f1117` | application background |
| `foreground` | `#e5e7eb` | primary text |
| `card` / `popover` | `#1a1b23` | panels, cards, menus |
| `primary` / `ring` | `#818cf8` | selected controls, focus, timeline marker |
| `secondary` / `muted` / `accent` | `#262730` | controls, hover surfaces, secondary backgrounds |
| `muted-foreground` | `#9ca3af` | secondary text |
| `destructive` | `#ef4444` | deletion, blocked/overdue emphasis |
| `border` / `input` | `#2e303a` | all borders and inputs |
| `sidebar` | `#13141b` | navigation rail |
| `sidebar-foreground` | `#9ca3af` | inactive navigation text |
| `sidebar-accent` | `#262730` | active/hover navigation surface |

Use small radii: `0.25rem` for small controls, `0.375rem` for medium controls, and `0.5rem` for larger panels. Use system sans-serif with antialiasing, compact typography, and no decorative marketing hero. The interface is an operational tool, so information density and scanability take priority.

Global styling requirements:

- `body` has no margin, uses the background token, and fills the viewport.
- `#root` is a flex container with at least the viewport height.
- The app root is `flex h-screen overflow-hidden`.
- Use 6px scrollbars with a transparent track, `#3f3f46` thumb, and `#52525b` hover thumb.
- Use borders consistently through the semantic border token.
- Use Lucide icons in controls and navigation. Tooltips/titles should identify unfamiliar icon-only actions.
- Use modest transitions for hover, view switches, drawers, menus, and drag feedback. Avoid excessive animation.
- Keep text inside controls and cards; compact labels may hide on small widths, but controls must remain usable.

### Persistent shell

The main screen is a three-layer composition:

1. A fixed left sidebar, `w-56` (approximately 224px), full viewport height, darker than the main background, with a right border.
2. A flexible main content column, `flex-1 min-w-0 flex flex-col overflow-hidden`.
3. A fixed right task-detail drawer that overlays the main content when a task is selected.

Sidebar structure:

- Top logo row: small favicon plus bold `Tasker` wordmark, with a bottom border.
- Search control directly below the logo.
- Scrollable main navigation.
- Settings in a bottom section separated by a top border.
- Navigation rows use a Lucide icon, 14px-ish text, compact vertical padding, rounded medium corners, and `sidebar-accent` when active or hovered.

Main view structure:

- Most spaces use a full-height flex column.
- A compact top toolbar contains the page title, view controls, filters, and creation actions.
- Content below the toolbar owns its scrolling. Avoid making the entire body scroll when a table, board, or editor should scroll independently.

Task detail drawer:

- Opens with a semi-transparent black backdrop and a right-anchored card-colored panel.
- Default width is 600px, minimum width 360px, bounded by viewport width.
- It has a draggable left resize handle and persists the width in Zustand.
- Header contains breadcrumb-like parent story text when available, `Task #id`, Archive, Duplicate, Delete, and Close actions.
- Body scrolls independently and includes title, fields, flags, labels, Markdown details, subtasks, links, dependencies, and activity.
- Clicking the backdrop closes it.

Quick Add:

- Available from every space through a persistent bottom-right action and `Cmd/Ctrl+J`.
- Title is required. Create with the configured default status, then optionally set other context.
- Keep the form compact and context-aware.

## 5. Navigation and Spaces

The sidebar order is:

1. Dashboard
2. Tasks
3. Backlog
4. My Day
5. User Stories
6. Notes
7. Labels
8. Archive
9. Sprint Overview
10. Work Summary
11. Templates
12. Activity
13. Settings at the bottom

The initial active space is Dashboard. Persist the active space and selected task view across reloads, but do not persist transient selections such as an open task drawer unless explicitly desired.

### Dashboard

The landing page is a compact operational overview, not a marketing page. Include:

- Metric cards for total, done, active, due today, overdue, and user stories.
- Active sprint summary with dates, task counts, status distribution, progress, and completed/estimated effort.
- Status and phase charts.
- Top-label distribution, limited to the most relevant labels.
- Upcoming tasks and recently updated tasks.
- Overdue items visibly emphasized with the destructive/red color.
- Sprint and date-preset filters such as all, this week, this month, and last 30 days.
- Clickable widgets that navigate to useful filtered views where practical.

Charts use Recharts and must remain legible against the dark palette. Avoid low-contrast axes and legends.

### Tasks

Tasks is the primary workspace and shows all non-archived tasks with no default sprint or status filter. The toolbar contains:

- Page title `Tasks`.
- Segmented view control with icons and labels for Table, Kanban, Timeline, Calendar, and Week.
- A `From Template` menu that creates a task from a selected template and opens its detail drawer.
- The shared FilterBar.

The selected task view is persisted. All five views operate on the same task query and mutation contracts.

### Backlog

Backlog is the planning-only workspace. It shows non-archived tasks whose status phase is `planning`, normally in Kanban or Table mode. It should not show execution-phase or `any`-phase tasks. It is used for intake, clarification, and readiness before sprint execution.

### My Day

My Day is the daily focus list. Include tasks with today's `do_date` and tasks whose `start_date` through `end_date` range contains today. The list supports drag reorder, and the order is persisted in `my_day_order`. Adding a task to My Day is distinct from changing status. Show overdue badges and optionally a completed-today section.

### User Stories

Use a master-detail layout:

- Left side: searchable/filterable story list, optionally filtered by sprint.
- Right side: selected story title, status, labels, sprint, Markdown details, progress, and linked child tasks.
- Child task rows are clickable and open the global task detail drawer.
- Show total/active task counts and progress derived from child statuses.

### Notes

Use a two-pane editor:

- Left tree/sidebar contains notes with indentation, parent/child nesting, selection, and drag-to-nest/reorder behavior.
- Right pane contains title and Markdown content, labels, sprint, and linked tasks.
- Support creating notes from templates and pasting images into Markdown content through an upload endpoint.
- Notes can be deleted and linked bidirectionally to tasks.

### Labels

Provide shared label CRUD and color management. Labels are used by tasks, user stories, and notes. Hidden labels may be archived/hidden without deleting historical relationships.

### Archive

Use separate Tasks and Stories tabs. Search archived records, restore them while preserving their prior status, or permanently delete them. Active views must consistently exclude `is_archived = 1`.

### Sprint Overview

Show all sprints, including past, active, and future. Selecting a sprint shows:

- Date range and active state.
- Task counts by status.
- Completed versus estimated effort in days.
- Days remaining where dates exist.
- All tasks in the sprint grouped by status.

Only one sprint can be active at a time. Activating one must clear the previous active flag.

### Work Summary

Generate a copyable Markdown report for this week, last week, this month, last month, a selected sprint, or a custom date range. Include task counts, effort totals, labels, sprint, dates, and per-task status/details appropriate to the selected scope.

### Templates

Use a list/editor layout. The editor manages name, description, Markdown content, and ordered subtask titles. Default templates are editable but protected from deletion. Applying a template to an existing task appends Markdown and appends subtasks; it must not erase existing content.

### Activity

Show a chronological activity feed with entity type filtering and a clear-all action. Log creation, updates, status changes, duplication, deletion, archive/restore, and recurring task generation where applicable.

### Settings

Provide sections for:

- Status CRUD, color, phase, and ordering.
- Sprint CRUD and activation.
- Label CRUD and colors.
- App settings such as default effort days and default task status.
- JSON and CSV export actions.

Do not delete a status that is still referenced by records; return a clear error or require reassignment.

## 6. Task Views

### Shared FilterBar

Use a consistent filter strip above task lists and boards. Support status, sprint, label, phase, free-text search, and sort field/direction. Active filters should be visible and removable. Multiple filters use AND semantics. Preserve filter state in the session and persist the stable filter configuration in Zustand.

The current client filter state includes:

- `statusId`
- `sprintId`
- `labelId`
- `searchText`
- `statusPhase`
- `sortField`: created date, do date, sprint, label, or title
- `sortDir`: ascending or descending
- `kanbanGroupBy`: status, label, or do date
- `kanbanHideCompleted`

### Table

Use TanStack Table for a spreadsheet-like task grid. Include sortable columns, compact row density, status and sprint editing, dates, effort, labels, and task flags. Support inline or detail-driven editing, row actions, and context-menu actions for archive, duplicate, and delete. Preserve stable column widths and allow horizontal scrolling rather than squeezing content into unreadable cells.

### Kanban

Use dnd-kit. The default grouping is status. Also support grouping by label and do date. The board should have horizontally scrollable columns, compact task cards, a per-column add affordance, drag overlays/ghosts, and highlighted drop targets.

Do-date buckets should cover late, today, tomorrow, remaining working days, next week, future, and no date. Moving a card between status columns updates `status_id`; moving between compatible date or label groups updates the corresponding field. Persist manual order through `kanban_order`. Provide a hide-completed toggle.

Task cards should show:

- Title.
- Status color or manual color override as a visual edge/accent.
- Labels.
- Effort or date where useful.
- Subtask progress when subtasks exist.
- `Requires Other` indicator (`[needs help]` in accessible text; the current UI uses the rope symbol).
- Priority and quick-task indicators where enabled.

### Calendar

Use FullCalendar with the day-grid and interaction plugins. Render `do_date` as a single-day task event and `start_date`/`end_date` as a spanning event. Make events status-colored or override-colored. Dragging an event changes its Do Date. Clicking opens the task drawer. Include an unscheduled sidebar for suitable tasks when present.

### Week

Use FullCalendar's seven-day/time-grid presentation for weekly planning. Place tasks by Do Date, allow drag rescheduling between days, and show effort estimates where useful. Keep day columns stable and readable.

### Timeline

Implement a custom Gantt-style view with dnd-kit rather than dependency arrows. Render tasks with a valid start/end range as horizontal bars on a date scale. Support Day, Week, and Month zoom. Drag the bar to move the date range; drag either edge to resize it. Show a clear red or primary-colored today marker. Apply status/override colors and the Requires Other indicator. Dependencies remain visible only in task details.

## 7. Domain Model

Use SQLite integer IDs and ISO date strings (`YYYY-MM-DD`) for date-only fields. Timestamp fields use SQLite UTC datetime strings.

### Status

```text
id, name, phase, color, sort_order
```

`phase` is one of `planning`, `execution`, or `any`. The default ordered seed is:

| Order | Name | Phase | Color |
| ---: | --- | --- | --- |
| 0 | Backlog | planning | `#9ca3af` |
| 1 | Baking | planning | `#f59e0b` |
| 2 | Collecting Info | planning | `#8b5cf6` |
| 3 | Ready for Work | planning | `#10b981` |
| 4 | To Do | execution | `#3b82f6` |
| 5 | In Progress | execution | `#f97316` |
| 6 | In Review | execution | `#a855f7` |
| 7 | Done | execution | `#22c55e` |
| 8 | Blocked | any | `#ef4444` |

Important: older requirements refer to `Inbox`; the implemented seed/migration uses `Backlog` and renames an existing `Inbox` status to `Backlog`. Recreate the current behavior unless a later adjustment explicitly changes it.

### Task

```text
id, title, status_id, user_story_id, do_date, start_date, end_date,
sprint_id, effort_estimate, details, requires_other, requires_other_note,
color_override, is_quick, is_priority, recurrence_rule,
recurrence_parent_id, is_archived, my_day_order, kanban_order,
template_origin_id, created_at, updated_at, completed_at
```

Relationships and behavior:

- `status_id` is required.
- `user_story_id` and `sprint_id` are optional foreign keys.
- `do_date` is the day planned for actual work.
- `start_date` and `end_date` define a contiguous timeline/calendar range.
- `effort_estimate` is a nullable decimal number of days; support values such as `3.5` and step `0.25` in the UI.
- `details` is Markdown.
- `requires_other` is a boolean integer. When enabled, show `requires_other_note` and the indicator on Kanban, Calendar, Timeline, and details.
- `is_quick` and `is_priority` are optional visual flags.
- `color_override` is nullable; status color is the default when it is absent.
- `is_archived` is a soft delete. Completing a task does not archive it.
- `my_day_order` and `kanban_order` persist view-specific manual ordering.
- `completed_at` records when the task entered Done.
- Recurrence values are `daily`, `weekdays`, `weekly`, `biweekly`, or `monthly`. When a recurring task is completed, generate the next occurrence with a parent reference.

### Subtask

```text
id, task_id, title, is_completed, sort_order
```

Subtasks are ordered checklist items with add, edit, toggle, delete, and reorder operations. Show completion percentage in task cards/details when any exist.

### User Story

```text
id, title, status_id, sprint_id, details, color_override,
is_archived, template_origin_id, created_at, updated_at
```

A story owns zero or more tasks through `tasks.user_story_id`. Calculate progress and child status counts from its tasks. Apply status colors and optional color overrides consistently with tasks.

### Sprint

```text
id, name, start_date, end_date, is_active, created_at, updated_at
```

Only one sprint may have `is_active = 1`.

### Label

```text
id, name, color, is_hidden
```

Labels are shared through `task_labels`, `user_story_labels`, and `note_labels` join tables. Do not delete labels casually if preserving historical tagging matters; support hiding them.

### Note

```text
id, title, content, sprint_id, parent_id, sort_order,
template_origin_id, created_at, updated_at
```

Notes form a tree through `parent_id`, are ordered by `sort_order`, use Markdown, and can have labels and links to tasks, stories, and notes.

### Template

```text
id, name, description, details_content, subtasks_json,
is_default, created_at, updated_at
```

Store ordered subtask titles as a JSON array. Seed these templates:

- `User Story`: description, acceptance criteria, notes.
- `Task Pre-Planning`: manager context, understanding, open questions, approach, dependencies; subtasks for clarifying, identifying dependencies, estimating effort, and moving to Ready for Work.
- `Task`: objective, approach, done criteria.
- `Sprint Retrospective`: what went well, what did not, next experiment, action items.

### Links and activity

Use these join tables:

- `task_dependencies(task_id, depends_on_task_id)` for informational blocked-by relationships.
- `task_relations(task_id, related_task_id)` for bidirectional peer relationships.
- `task_note_links(task_id, note_id)` for bidirectional task-note links.
- `note_links(note_id, linked_type, linked_id)` for note links to tasks, stories, or notes.

Activity records contain `entity_type`, `entity_id`, `action`, `details`, and `created_at`. Add indexes for status, sprint, story, date, archive, and activity lookup columns.

### App settings

Use a key-value table. Seed:

```text
default_effort_days = 3
default_task_status = To Do
```

## 8. API Contract

All API endpoints are JSON under `/api`. The client should centralize requests in `client/src/api.ts`, throw readable errors for non-2xx responses, and use TanStack Query hooks to invalidate affected query keys after mutations.

### Tasks

```text
GET    /tasks
GET    /tasks/:id
POST   /tasks
PUT    /tasks/:id
DELETE /tasks/:id
POST   /tasks/:id/duplicate

POST   /tasks/:taskId/subtasks
PUT    /tasks/:taskId/subtasks/:subtaskId
DELETE /tasks/:taskId/subtasks/:subtaskId
PUT    /tasks/:taskId/subtasks-order

POST   /tasks/my-day/:taskId
DELETE /tasks/my-day/:taskId
PUT    /tasks/my-day/reorder
PUT    /tasks/kanban/reorder
GET    /tasks/work-summary
```

Task list filters include `is_archived`, `status_id`, `sprint_id`, `label_id`, `search`, `status_phase`, `do_date_from`, `do_date_to`, and `has_do_date`.

### Other resources

```text
GET/POST       /statuses
PUT/DELETE     /statuses/:id
PUT            /statuses/reorder

GET/POST       /sprints
GET/PUT/DELETE /sprints/:id
POST           /sprints/:id/activate

GET/POST       /labels
PUT/DELETE     /labels/:id

GET/POST       /templates
GET/PUT/DELETE /templates/:id
POST           /templates/:templateId/apply/:taskId
POST           /templates/:templateId/create-task
POST           /templates/:templateId/create-note

GET/POST       /user-stories
GET/PUT/DELETE /user-stories/:id

GET/POST       /notes
GET/PUT/DELETE /notes/:id
PUT            /notes/reorder/batch
GET/POST       /notes/:noteId/linked-tasks
DELETE         /notes/:noteId/linked-tasks/:taskId

GET            /dashboard
GET            /search?q=...&labels=...
GET            /export/json
GET            /export/tasks-csv

GET            /tasks/:taskId/dependencies
GET            /tasks/:taskId/dependents
POST           /tasks/:taskId/dependencies
DELETE         /tasks/:taskId/dependencies/:dependsOnTaskId
GET            /tasks/:taskId/relations
POST           /tasks/:taskId/relations
DELETE         /tasks/:taskId/relations/:relatedTaskId
GET/POST       /tasks/:taskId/linked-notes
DELETE         /tasks/:taskId/linked-notes/:noteId

GET/DELETE     /activity
GET/PUT        /settings
PUT            /settings/:key
POST           /uploads
```

Search should cover task titles/details/subtasks, story titles/details, note titles/content, and labels where the SQLite implementation supports it. Include archived records and mark archived results clearly.

## 9. Interaction Rules

### Keyboard shortcuts

- `Cmd/Ctrl+K`: open global search.
- `Cmd/Ctrl+J`: open Quick Add.
- `Escape`: close the task detail drawer or Quick Add.
- Number keys `1` through `9`: switch the first nine spaces when focus is outside an input, textarea, or editable control.

### Persistence and feedback

- Every field mutation saves immediately; there is no global Save button.
- Use synchronous SQLite writes for the small local single-user workload.
- Show a connection/error guard when the server cannot be reached.
- Show toast messages for failures and useful success/undo cases. Error text should explain that a change may not have been saved.
- Invalidate related query keys after mutations so all views converge quickly.
- Use optimistic-looking, low-latency UI where safe, but do not hide failed persistence.

### Drag and drop

Support drag interactions within the owning view:

- Kanban cards between columns update the grouping field.
- My Day items reorder `my_day_order`.
- Calendar and Week events reschedule `do_date`.
- Timeline bars move or resize `start_date`/`end_date`.
- Notes reorder or change parent.
- Subtasks reorder within a task.

Every drag should have a visible drag overlay or ghost and a highlighted drop target. Do not implement implicit cross-space moves.

## 10. Markdown and Media

Use `@uiw/react-md-editor` for editing and `react-markdown` with `remark-gfm` for rendered Markdown where a read-only rendering is needed. The editor uses dark mode and a 50/50 editor/preview split when live preview is shown. Override the library's inline widths so the editor fills its parent and does not overflow the detail drawer or note pane.

Support standard Markdown links, lists, checkboxes, headings, and tables. Pasted images in notes should be sent to `POST /api/uploads` and inserted as a Markdown reference. Do not replace Markdown with HTML as the stored format.

## 11. Verification Checklist

Before considering a recreation complete, verify the following:

### Build and startup

- Fresh install succeeds for root and client dependencies.
- `npm run build:client` succeeds.
- `npm start` creates the database, serves the SPA, responds to `/api/health`, and opens or prints the local URL.
- Vite development proxy reaches the Express API.
- Restarting the server does not lose data or fail on already-applied migrations.

### Data behavior

- Fresh database has the nine statuses in the exact order above and the four default templates.
- Task CRUD, labels, subtasks, user stories, notes, sprints, templates, archive, and settings persist after reload.
- Status changes record `completed_at` on entering Done and recurring tasks generate the next occurrence when configured.
- Assigning a planning task to a sprint can transition it to `To Do` where that workflow is enabled; sending a task to Backlog clears sprint and uses the planning default.
- Deleting a status in use is rejected safely.
- My Day and Kanban manual ordering survives reload.
- Notes preserve tree structure and task links.
- Export output is valid JSON/CSV and respects the requested scope/filter.

### UI behavior

- Sidebar, toolbars, table, boards, calendar, timeline, editors, menus, drawer, and charts remain readable in the dark palette.
- Task detail drawer opens from every task surface, can be resized, and closes through X, backdrop, and Escape.
- Inline edits save on blur/Enter and Escape cancels where supported.
- Filters combine with AND logic and remain visible as removable controls.
- Drag overlays and drop states are clear and do not resize columns or cards.
- Today/date logic is consistent between My Day, Kanban, Calendar, Week, and Timeline.
- Archived items are excluded from active spaces but searchable and restorable in Archive.
- Responsive behavior keeps the main content usable on narrower screens; hide nonessential view labels rather than allowing overlap.

## 12. Known Source-Reconciliation Notes

Use these notes to avoid copying stale requirements as if they were current implementation facts:

- The product requirements originally called the first planning status `Inbox`; the live schema seeds `Backlog` and migrates `Inbox` to it.
- The product requirements described project-folder storage, but the live implementation stores SQLite under `~/.tasker` specifically to avoid OneDrive/cloud filesystem issues.
- The live application includes several capabilities that were once listed as deferred: recurrence, priority and quick flags, activity history, hierarchical notes, templates, task-note links, and dependency/related-task panels.
- The current UI includes a Labels space, Work Summary, Activity, and richer Settings beyond the earliest phase plan.
- Do not add a light theme, cloud backend, authentication, cross-space drag, dependency arrows, rich-text-only editing, or a separate due-date field unless a later adjustment explicitly requests one.

When adapting this system for the other machine, preserve the contracts above first. Apply requested product adjustments as explicit deltas, update the data model and API together, and add a focused verification case for each changed behavior.
