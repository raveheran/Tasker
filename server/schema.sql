-- Tasker Database Schema

-- Statuses (user-customizable)
CREATE TABLE IF NOT EXISTS statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL CHECK(phase IN ('planning', 'execution', 'any')),
  color TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Sprints
CREATE TABLE IF NOT EXISTS sprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Labels (shared across tasks, user stories, notes)
CREATE TABLE IF NOT EXISTS labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280'
);

-- User Stories
CREATE TABLE IF NOT EXISTS user_stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  sprint_id INTEGER REFERENCES sprints(id),
  details TEXT NOT NULL DEFAULT '',
  color_override TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  template_origin_id INTEGER REFERENCES templates(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  user_story_id INTEGER REFERENCES user_stories(id),
  do_date TEXT,
  start_date TEXT,
  end_date TEXT,
  sprint_id INTEGER REFERENCES sprints(id),
  effort_estimate REAL,
  details TEXT NOT NULL DEFAULT '',
  requires_other INTEGER NOT NULL DEFAULT 0,
  requires_other_note TEXT,
  color_override TEXT,
  is_quick INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  my_day_order INTEGER,
  template_origin_id INTEGER REFERENCES templates(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Migration: add is_quick column for existing databases
ALTER TABLE tasks ADD COLUMN is_quick INTEGER NOT NULL DEFAULT 0;

-- Migration: add recurrence columns for existing databases
ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
ALTER TABLE tasks ADD COLUMN recurrence_parent_id INTEGER;

-- Subtasks
CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Task Labels (join table)
CREATE TABLE IF NOT EXISTS task_labels (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- User Story Labels (join table)
CREATE TABLE IF NOT EXISTS user_story_labels (
  user_story_id INTEGER NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (user_story_id, label_id)
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sprint_id INTEGER REFERENCES sprints(id),
  template_origin_id INTEGER REFERENCES templates(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Note Labels (join table)
CREATE TABLE IF NOT EXISTS note_labels (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, label_id)
);

-- Note Linked Items (polymorphic links)
CREATE TABLE IF NOT EXISTS note_links (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  linked_type TEXT NOT NULL CHECK(linked_type IN ('task', 'user_story', 'note')),
  linked_id INTEGER NOT NULL,
  PRIMARY KEY (note_id, linked_type, linked_id)
);

-- Task Dependencies (blocked by)
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id)
);

-- Task-Note Links (bidirectional)
CREATE TABLE IF NOT EXISTS task_note_links (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, note_id)
);

-- Task Related Links (non-hierarchical)
CREATE TABLE IF NOT EXISTS task_relations (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  related_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, related_task_id)
);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  details_content TEXT NOT NULL DEFAULT '',
  subtasks_json TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_story ON tasks(user_story_id);
CREATE INDEX IF NOT EXISTS idx_tasks_do_date ON tasks(do_date);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(is_archived);
CREATE INDEX IF NOT EXISTS idx_user_stories_status ON user_stories(status_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_sprint ON user_stories(sprint_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_archived ON user_stories(is_archived);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'user_story', 'note')),
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);

-- App Settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed default settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('default_effort_days', '3');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('default_task_status', 'To Do');

-- Seed default statuses
INSERT OR IGNORE INTO statuses (name, phase, color, sort_order) VALUES
  ('Backlog', 'planning', '#9ca3af', 0),
  ('Baking', 'planning', '#f59e0b', 1),
  ('Collecting Info', 'planning', '#8b5cf6', 2),
  ('Ready for Work', 'planning', '#10b981', 3),
  ('To Do', 'execution', '#3b82f6', 4),
  ('In Progress', 'execution', '#f97316', 5),
  ('In Review', 'execution', '#a855f7', 6),
  ('Done', 'execution', '#22c55e', 7),
  ('Blocked', 'any', '#ef4444', 8);

-- Migrate: rename Inbox → Backlog for existing databases (only if Backlog doesn't already exist)
UPDATE OR IGNORE statuses SET name = 'Backlog' WHERE name = 'Inbox';

-- Seed default templates
INSERT OR IGNORE INTO templates (name, description, details_content, subtasks_json, is_default) VALUES
  ('User Story', 'Standard user story structure', '## Description
As a [role], I want [goal], so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Notes
', '[]', 1),
  ('Task Pre-Planning', 'Pre-planning template for tasks from manager', '## Context from manager
What was communicated.

## My understanding
Rephrased in own words.

## Open questions
Things to clarify.

## Initial approach
Rough plan.

## Dependencies / blockers
What''s needed before starting.
', '["Clarify requirements","Identify dependencies","Estimate effort","Move to Ready for Work"]', 1),
  ('Task', 'Standard task structure', '## Objective
What this task accomplishes.

## Approach
How to tackle it.

## Done criteria
How to know it''s finished.
', '[]', 1),
  ('Sprint Retrospective', 'Sprint retrospective note', '## What went well

## What didn''t go well

## What to try next sprint

## Action items
- [ ] Action 1
- [ ] Action 2
', '[]', 1);

ALTER TABLE notes ADD COLUMN parent_id INTEGER REFERENCES notes(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Migration: add is_priority column for existing databases
ALTER TABLE tasks ADD COLUMN is_priority INTEGER NOT NULL DEFAULT 0;

-- Migration: add kanban_order column for manual reorder in Kanban
ALTER TABLE tasks ADD COLUMN kanban_order INTEGER;

-- Migration: preserve the timestamp a task entered Done
ALTER TABLE tasks ADD COLUMN completed_at TEXT;

UPDATE tasks
SET completed_at = (
  SELECT MAX(created_at)
  FROM activity_log
  WHERE entity_type = 'task'
    AND entity_id = tasks.id
    AND action = 'status_changed'
    AND details LIKE '%→ Done'
)
WHERE completed_at IS NULL;

-- Migration: add is_hidden column to labels (archive labels without deleting)
ALTER TABLE labels ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;

