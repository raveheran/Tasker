# Tasker — Final Requirements Specification

> **Purpose:** This document defines all requirements for Tasker, a locally-hosted, browser-based personal task management system. It serves as the single reference for implementation planning.
>
> **User:** Single user, single browser tab. Personal use only.

---

## 1. Architecture & Data

### 1.1 Local-First, Single-File Storage
- All data persisted in a single local file within the project folder (SQLite with WAL mode).
- **Instant persistence** — every change saved immediately; no explicit "save" action.
- **Fast** — all reads and writes imperceptible during normal use.
- **Scales gracefully** — handles thousands of tasks, user stories, and notes without degradation.
- **Locally runnable** — no network dependency.

### 1.2 Data Export
- Export tasks, user stories, sprints, and notes to CSV and/or JSON.
- Filterable export (e.g., export only a specific sprint or project).

### 1.3 Launch
- Start via a single command (`npm start`) that launches the backend and opens the browser.
- Express.js serves both the API and the built SPA from a single process.

### 1.4 Single User, Single Tab
- No concurrent access handling needed. Single user, single browser tab.

---

## 2. UI & Experience

### 2.1 Browser-Based UI
- Runs in a local browser. Tech stack: React 18 + TypeScript + Vite (frontend), Express.js (backend), shadcn/ui + Tailwind CSS.
- Beautiful, modern dark-mode UI (dark mode only — no light theme).
- Fluid interactions and animations.
- Rich visualizations and graphs (Recharts).

### 2.2 Dark Mode
- The entire UI is dark-mode only. All components, charts, and views designed for a dark palette from the start.

### 2.3 Color Coding
- Items are color-coded by **status** by default.
- Users can manually override the color of any individual item.
- Color coding is consistent across all views (Kanban cards, table rows, calendar events, timeline bars, etc.).
- Colors are in addition to labels — labels provide categorical tagging, colors provide visual scanning.

### 2.4 Drag and Drop
Drag and drop supported within each view (not cross-space):
- **Kanban:** Drag cards between columns to update the grouping field.
- **Calendar / Week view:** Drag tasks between days to reschedule Do Dates.
- **Timeline:** Drag to move or resize task bars (adjusts start/end dates).
- **Table:** Drag rows to reorder within a group.
- **Subtasks:** Drag to reorder checklist items within a task.
- **My Day:** Drag to reorder tasks for prioritization.
- All drag interactions provide visual feedback (ghost preview, drop zone highlighting).

Cross-space moves (e.g., Backlog → Sprint) are done via context menu or explicit action buttons, not drag-and-drop.

### 2.5 Quick Add
- A persistent "+" button or keyboard shortcut accessible from any view.
- Creates a task with minimal fields (title required; optional: sprint, label, status).
- Context-aware: pre-fills fields based on current view (e.g., adds today's date if in My Day, sets status to Inbox if in Backlog).

### 2.6 Smooth UX Patterns
- Inline editing of fields directly in table/kanban views (click to edit, Enter to save, Esc to cancel).
- Hover previews — hovering over a task in any view shows a compact summary tooltip.
- Smooth transitions and animations when switching views, opening/closing panels, filtering.
- Collapsible sections and panels to manage information density.
- Breadcrumb navigation when drilling into user stories, tasks, or nested views.

### 2.7 Settings
- A dedicated settings window for managing:
  - Statuses: add, edit, reorder, remove statuses.
  - Any other global configuration added in the future.

---

## 3. Item Types & Fields

### 3.1 Tasks
A task is the primary work unit. Fields:

| Field | Type | Notes |
|---|---|---|
| **Title** | Text | Required |
| **Status** | Enum | See §3.4 |
| **Parent User Story** | Reference | Optional link to a user story |
| **Do Date** | Date | Single date — the date I plan to actually work on this |
| **Start Date** | Date | For timeline/calendar range rendering |
| **End Date** | Date | For timeline/calendar range rendering. Start–End is always a contiguous range |
| **Context Labels** | Multi-select tags | Project, topic, or category the task belongs to |
| **Sprint** | Reference | Which sprint this task is in (or planned for) |
| **Effort Estimate** | Number (days) | Always in days. Supports fractions (e.g., 3.5 days) |
| **Details** | Markdown | Standard markdown with link pasting support. No rich-text WYSIWYG editor needed |
| **Subtasks** | Checklist | Ordered list of sub-items with checkboxes; progress bar shows % complete |
| **Dependencies** | References | Links to other tasks this task depends on (blocking relationship). Informational — no enforcement or arrows |
| **Requires Other** | Toggle | Indicates this task needs help from another person. When on, shows 🪢 symbol in Kanban, Calendar, and Timeline views. Optional text field for who/what is needed |
| **Related Tasks** | References | Non-hierarchical "related to" links to other tasks |
| **Color** | Color | Auto-set by status; manually overridable |
| **Template Origin** | Reference | Which template was used to create this item (if any) |

**Date logic:**
- **Do Date** = the specific day I plan to work on this. Used for My Day view (Do Date = today) and Kanban "now" grouping.
- **Start Date / End Date** = contiguous range for Timeline and Calendar rendering. A task appears in "now" in Kanban/My Day if today falls within the Start–End range.

### 3.2 User Stories
A user story is a parent container for related tasks. Fields:

| Field | Type | Notes |
|---|---|---|
| **Title** | Text | Required |
| **Status** | Enum | Same status set as tasks |
| **Context Labels** | Multi-select tags | Project/topic |
| **Sprint** | Reference | Sprint assignment |
| **Details** | Markdown | Standard markdown |
| **Child Tasks** | List | Auto-populated; clickable navigation to each task |
| **Progress** | Auto-calculated | Progress bar based on child task statuses (e.g., 3/5 done = 60%) |
| **Color** | Color | Auto-set by status; manually overridable |

### 3.3 Notes
Freeform content not tied to a specific task or user story. Fields:

| Field | Type | Notes |
|---|---|---|
| **Title** | Text | Required |
| **Content** | Markdown | Standard markdown |
| **Context Labels** | Multi-select tags | Shared label list with tasks and user stories |
| **Sprint** | Reference | Optional sprint association |
| **Linked Items** | References | Optional links to tasks, user stories, or other notes |
| **Template Origin** | Reference | Which template was used |

- Notes can be individually deleted.
- Notes share the same label pool as tasks and user stories.

### 3.4 Unified Status Workflow
A single status system spans the full lifecycle from planning through execution:

**Default statuses (ordered pipeline):**

| Phase | Status | Meaning |
|---|---|---|
| **Planning** | Inbox | Freshly captured. Raw idea or note from manager |
| **Planning** | Baking | Thinking about approach, forming understanding |
| **Planning** | Collecting Info | Gathering inputs, waiting on clarification |
| **Planning** | Ready for Work | Fully defined, can be pulled into a sprint |
| **Execution** | To Do | Assigned to a sprint, not started |
| **Execution** | In Progress | Actively working on it |
| **Execution** | In Review | Work done, awaiting review/validation |
| **Execution** | Done | Completed |
| **Any** | Blocked | Stuck, cannot proceed |

- A task transitions from planning to execution when it moves from "Ready for Work" to "To Do" (typically by being assigned to a sprint).
- Statuses are globally defined and **user-customizable** via Settings (add, edit, reorder, remove).
- The Kanban view uses statuses as the default column grouping.
- **Blocked** is phase = "Any" — it appears wherever the task lives. Setting a backlog item to Blocked removes it from Backlog view (which only shows planning-phase statuses); it remains visible in the main Tasks view.

### 3.5 Dependencies
- A task can declare a **"blocked by"** dependency on one or more other tasks.
- Dependencies are **informational only** — shown as links in the task detail panel. No enforcement, no arrows on Timeline.
- The **"Requires Other"** toggle marks a task as needing help from another person. When enabled:
  - Optional text field captures who/what is needed.
  - The symbol 🪢 appears on the task card in Kanban, Calendar, and Timeline views.

### 3.6 Task Linking
- Tasks can be linked with a non-hierarchical **"Related to"** relationship.
- Related tasks are shown in the task detail panel as clickable references.

---

## 4. Views

All views operate on the same underlying data. A change in any view is immediately reflected in every other view.

### 4.1 Table View
- Spreadsheet-like grid of all tasks with sortable, resizable columns.
- Inline editing of any field.
- Row grouping by any field (status, sprint, label, etc.).

### 4.2 Kanban View
- Cards arranged in columns.
- **Default bins:** Status columns.
- **Configurable bins:** User can switch the grouping dimension to any categorizable task field:
  - Status
  - Context Label (e.g., one bin per project)
  - Sprint
  - Do Date (grouped by day, week, etc.)
  - Requires Other (yes/no)
- Drag cards between columns to update the corresponding field.
- Cards show key info at a glance: title, status color, labels, progress bar (if subtasks exist), 🪢 if "Requires Other" is on.
- Tasks where today falls within Start–End date range appear in "now" grouping when bins are date-based.

### 4.3 Timeline View (Gantt-style)
- Horizontal bars representing task durations (Start Date → End Date).
- Drag to move or resize bars (adjusts start/end dates).
- **No dependency arrows** — dependencies are informational only, visible in task detail.
- Zoomable granularity (day, week, sprint, month).
- Color-coded by status.
- 🪢 symbol on tasks where "Requires Other" is on.
- Custom-built component using @dnd-kit.

### 4.4 Calendar View
- Monthly calendar with tasks placed on their Do Date.
- Multi-day tasks (Start–End date range) rendered as spanning bars.
- Drag tasks between days to reschedule Do Date.
- Click a day to see all tasks for that day in a detail panel.
- 🪢 symbol on tasks where "Requires Other" is on.
- Built with FullCalendar (@fullcalendar/react).

### 4.5 My Day — Daily Focus View
- Shows tasks where Do Date = today OR today falls within Start–End date range.
- Ordered list with manual drag-to-reorder for prioritization.
- **Order is persisted** per date — refreshing the page preserves the prioritized order.
- Quick-add directly into today (sets Do Date = today).
- Compact view — minimal chrome, maximum task visibility.
- Optional: "completed today" section at the bottom.

### 4.6 Week View
- 7-day column layout showing tasks distributed by Do Date.
- Drag tasks between days to reschedule.
- At-a-glance weekly planning surface.
- Shows effort estimates per day if available.
- Built with FullCalendar (@fullcalendar/react).

### 4.7 Dashboard / Home Screen
The landing page when opening Tasker. High-level overview of current and upcoming work:
- **Sprint summary:** Active sprint name, dates, task status distribution (pie/donut chart), progress bar.
- **Tasks by status:** Bar or donut chart.
- **Tasks by context label:** Distribution chart.
- **Upcoming deadlines:** Next 7 days of tasks by Do Date.
- **Overdue items:** Count and list of tasks past their Do Date, highlighted in red.
- **Recently completed:** Last N completed tasks.
- All dashboard widgets are clickable — drill through to the relevant filtered view.
- Built with Recharts.

### 4.8 Filtering (applies to all views)
- Every view supports filtering by any field:
  - Status, Sprint, Context Label, Do Date range, Start/End Date range, Effort range.
  - Parent User Story.
  - Requires Other (yes/no).
  - Template origin.
- **Text fields** (Title, Details) filter on partial match (substring search).
- Multiple filters combine with AND logic.
- Active filters shown as removable chips above the view.
- Filters are per-view and persist within a session.

---

## 5. Spaces & Navigation

### 5.1 Space Structure
Tasker is organized into distinct **spaces**, accessible via a sidebar:

| Space | Purpose |
|---|---|
| **Dashboard** | Home screen with overview metrics and charts (§4.7) |
| **Tasks** | All non-archived tasks with Table/Kanban/Timeline/Calendar/Week sub-views. No default filter — user can filter by sprint, status, label, or any field (§5.2) |
| **Backlog** | Planning-phase tasks only, Kanban + Table sub-views (§5.3) |
| **My Day** | Today's focused task list (§4.5) |
| **User Stories** | Overview and management of user stories (§5.5) |
| **Notes** | Freeform notes space (§3.3) |
| **Archive** | Archived items, filterable and restorable (§5.4) |
| **Sprint Overview** | Summary view of all sprints and their tasks (§5.6) |
| **Templates** | Manage templates (§6) |

### 5.2 Tasks Space
The main workspace for viewing and managing all tasks. Shows **all non-archived tasks** (`is_archived = false`) by default with no filters applied.

- **Sub-views:** Table, Kanban, Timeline, Calendar, Week — switchable via tabs within the space.
- **Filtering:** Optional. User can filter by any field (sprint, status, label, date range, etc.) using the standard filter bar (§4.8). For example, filtering by a sprint shows only that sprint's tasks.
- All tasks appear here regardless of status phase (planning or execution). The Backlog space provides a specialized view for planning-phase tasks.

### 5.3 Backlog (Pre-Planning Space)
The backlog is the intake and refinement area where tasks are captured, matured, and eventually pulled into sprints. It shows **only tasks with planning-phase statuses** (Inbox, Baking, Collecting Info, Ready for Work) that are not archived. Tasks with execution-phase statuses or Blocked status do not appear here.

**Sub-views:** Kanban (default) + Table.

**Backlog UX:**
- **Quick capture:** Title-only task creation drops items into Inbox status.
- **Visual pipeline:** Kanban board grouped by planning statuses — flow from raw idea → ready.
- **Aging indicators:** Items sitting in the same status for a long time are visually flagged (subtle highlight or badge).
- **Sprint pull:** "Ready for Work" items can be assigned to a sprint via context menu or action button (sets status to "To Do").
- Backlog items retain all standard task fields and can be filtered/sorted like any other view.

### 5.4 Archive
- Archived items are stored with an `is_archived` boolean flag. All non-archive views filter `WHERE is_archived = false` by default.
- Archive space shows only items where `is_archived = true`.
- **Filterable by:** Sprint, date range, context label/project, status, user story, and text search.
- Searchable and browsable.
- **Restore:** Items can be restored from archive back to active spaces (sets `is_archived = false`, preserving existing status).
- **Archive action:** Manual — user explicitly archives via context menu or action button. Setting status to Done does NOT auto-archive.

### 5.5 User Stories Space
A dedicated area for managing user stories — designed as a work overview:

- **List/Board view** of all user stories, grouped by sprint or context label.
- Each user story shows:
  - Title, status, labels, sprint.
  - **Progress bar** auto-calculated from child task statuses.
  - **Inline child task summary** — count by status (e.g., "2 To Do, 3 In Progress, 1 Done").
  - Click to expand and see full child task list with links.
- Click any user story to open its detail view.
- Click any child task to navigate directly to it.
- From any task, a link navigates back to its parent user story.

### 5.6 Sprint Overview
A view showing all sprints (past, current, future) with summary information:
- Each sprint shows: name, date range, task count, status distribution, effort totals.
- Expandable to see the full task list for any sprint (all tasks regardless of status).
- Click through to the tasks within a sprint.
- Current/active sprint visually highlighted.

### 5.7 Moving Items Between Spaces
- Tasks can be moved between spaces via **context menu or action buttons** (e.g., "Assign to Sprint", "Send to Backlog", "Archive").
- **Assign to Sprint:** Updates the Sprint field. If task is in a planning-phase status, also sets status to "To Do". Task disappears from Backlog.
- **Send to Backlog:** Clears Sprint field, sets status to "Inbox".
- **Archive:** Sets `is_archived = true`. Status is NOT changed (preserves the status it had when archived).

---

## 6. Templates

### 6.1 Template System
Templates are reusable structures that pre-fill fields, details content, and subtask checklists when creating a new item. Templates are **shared across all item types** — the same template collection is available when creating a task, user story, or note.

**Applying to an existing item:** When a template is applied to an item that already has content in its description, the template text is **appended** to the existing content. No existing content is deleted. Template subtasks are also **appended** to any existing subtasks.

### 6.2 Template Operations
- **Create** new templates from scratch.
- **Edit** any template, including the defaults.
- **Delete** user-created templates. Default templates can be edited but not deleted.
- **Apply** a template when creating a new item — pre-fills all template-defined fields and content.
- **Apply** a template to an existing item — appends template content to existing description and subtasks.
- Templates managed in a dedicated **Templates space** (tab).

### 6.3 Default Templates

**User Story Template:**
- Title: [User Story Title]
- Details (markdown):
  ```
  ## Description
  As a [role], I want [goal], so that [benefit].

  ## Acceptance Criteria
  - [ ] Criterion 1
  - [ ] Criterion 2

  ## Notes
  ```

**Task Pre-Planning Template:**
- Title: [Task Title]
- Details (markdown):
  ```
  ## Context from manager
  What was communicated.

  ## My understanding
  Rephrased in own words.

  ## Open questions
  Things to clarify.

  ## Initial approach
  Rough plan.

  ## Dependencies / blockers
  What's needed before starting.
  ```
- Subtasks:
  - [ ] Clarify requirements
  - [ ] Identify dependencies
  - [ ] Estimate effort
  - [ ] Move to Ready for Work

**Task Template:**
- Title: [Task Title]
- Details (markdown):
  ```
  ## Objective
  What this task accomplishes.

  ## Approach
  How to tackle it.

  ## Done criteria
  How to know it's finished.
  ```

**Sprint Retrospective Template** (applied as a Note):
- Title: Sprint [N] Retrospective
- Details (markdown):
  ```
  ## What went well

  ## What didn't go well

  ## What to try next sprint

  ## Action items
  - [ ] Action 1
  - [ ] Action 2
  ```

---

## 7. Sprint Management

### 7.1 Sprint Lifecycle
- **Create** a sprint with: Name, Start Date, End Date (typically 2-week cadence).
- **Start** a sprint — it becomes the active sprint.
- Only one sprint can be active at a time. Future sprints can be created and have tasks assigned in advance.
- No formal "close sprint" workflow. Sprints transition naturally — start a new sprint, and the previous one becomes viewable in the Sprint Overview (§5.6).

### 7.2 Sprint Overview
- All sprints (past, current, future) visible in the Sprint Overview space.
- Each sprint shows all its tasks (any status), summary stats, and effort totals.
- Historical sprint data preserved indefinitely.

---

## 8. Search

### 8.1 Global Search
- Accessible from anywhere via a search bar or keyboard shortcut.
- Searches across **all content**: task titles, details, subtask text, user story titles/details, note titles/content, labels.
- **Includes completed/archived items** — with a clear indicator that a result is from the archive.
- Results grouped by type (Tasks, User Stories, Notes) with quick navigation.
- Partial match / substring search on all text fields.
- Filter search results by space, status, sprint, label.
- Powered by SQLite FTS5.

---

## 9. Non-Functional Requirements

### 9.1 Performance
- UI interactions (view switches, filters, drag-and-drop) respond in under 100ms.
- Data persistence is immediate and non-blocking.
- Smooth performance with up to 5,000+ tasks in the database.

### 9.2 Data Integrity
- No data loss on crash or unexpected close — WAL mode.
- All changes are atomic at the field level.

### 9.3 Portability
- The entire application and its data are contained within the project folder.
- Moving the folder to another machine should work without reconfiguration (assuming Node.js is available).

---

## 10. Implementation Phases

### Phase 1: Foundation — Data Model + Core UI Shell
**Goal:** Working app with basic task CRUD and navigation.

- Project structure: React + Vite (client), Express + better-sqlite3 (server).
- SQLite schema: tasks, user_stories, notes, sprints, labels, task_labels, templates, subtasks, statuses.
- Unified status system with planning + execution statuses, seeded defaults.
- UI shell: sidebar navigation between spaces, dark-mode theme (shadcn/ui + Tailwind).
- **Table View** (TanStack Table): inline editing, sorting, column resizing, row grouping.
- Task detail panel: all fields, markdown (react-markdown + @uiw/react-md-editor), subtasks.
- Quick Add from any view.
- Basic filtering (status, sprint, label, text search).
- Settings page for status CRUD.
- Templates: seed 4 defaults, apply on create.
- Single-command launch (`npm start`).

### Phase 2: Kanban + Backlog + Labels
- **Kanban View** (@dnd-kit) with configurable bins.
- Backlog space (Kanban + Table, planning statuses only).
- Aging indicators.
- Labels: CRUD, shared pool, assign/filter.
- Color coding by status + manual override.
- Context menu move actions (Assign to Sprint, Send to Backlog, Archive).

### Phase 3: Calendar + Week + My Day
- **Calendar View** (FullCalendar) — month, drag reschedule, multi-day spans.
- **Week View** (FullCalendar) — 7-day, effort per day.
- **My Day** — persisted order, drag reorder, quick-add.
- 🪢 symbol rendering.

### Phase 4: Timeline (Gantt) — can parallel Phase 3
- Custom Timeline component (@dnd-kit) — drag move/resize bars.
- Zoomable (day/week/sprint/month).
- Status colors, 🪢 symbol.

### Phase 5: User Stories + Sprint Management + Notes
- User Stories space: list/board, progress bars, child task summaries, navigation.
- Sprint CRUD, activate, Sprint Overview.
- Notes space: CRUD, shared labels, linked items, delete.

### Phase 6: Dashboard + Search
- Dashboard: sprint summary, status/label charts (Recharts), upcoming, overdue, recent.
- Global Search (FTS5): all content, archive indicator, type grouping.

### Phase 7: Archive + Export + Template Management
- Archive space: is_archived filter, restore.
- Data export: CSV/JSON with filters.
- Template editing, creation, deletion UI.

### Phase 8: Polish + Dependencies + Linking
- Task dependencies ("blocked by" links).
- Related task links.
- Requires Other toggle + text field.
- Hover previews, breadcrumbs, animations, filter persistence, edge cases.

---

## Appendix: Not Included (Deferred)

- Rich-text WYSIWYG editor — using markdown.
- Dependency arrows on Timeline.
- Cross-space drag-and-drop.
- Custom Kanban category sets — bins use existing fields.
- Workload heatmap.
- Undo/Redo.
- Burndown/burnup charts.
- Sprint close workflow.
- Priority field as separate axis.
- Time tracking / actual effort.
- Due Date as separate field.
- Recurring tasks.
- Sprint capacity planning.
- Keyboard shortcuts.
- Bulk operations.
- Data import.
- Task change history / audit log.
- Custom fields.
- Light mode.
- Overdue notifications.
- Note-to-task conversion.
