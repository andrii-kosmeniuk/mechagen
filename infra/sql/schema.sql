-- MechaGen Database Schema (SQLite-compatible)
-- Generated after refactor: all entities have explicit tables and relationships.
-- Designed for later migration to PostgreSQL — no SQLite-specific extensions used.
-- Run against: SQLite3, PostgreSQL, or any ANSI SQL-compatible engine.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────────────
-- PLANS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  slug              TEXT      PRIMARY KEY,   -- 'free' | 'pro' | 'team'
  name              TEXT      NOT NULL,
  monthly_price_usd REAL      NOT NULL DEFAULT 0,
  max_generations   INTEGER   NOT NULL DEFAULT 5,
  max_blueprints    INTEGER   NOT NULL DEFAULT 3,
  max_solid_builds  INTEGER   NOT NULL DEFAULT 1,
  max_workspaces    INTEGER   NOT NULL DEFAULT 1,
  max_members       INTEGER   NOT NULL DEFAULT 1,
  solid_enabled     INTEGER   NOT NULL DEFAULT 0, -- boolean
  export_formats    TEXT      NOT NULL DEFAULT 'obj,glb',
  created_at        TEXT      NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS / ACCOUNTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           TEXT      PRIMARY KEY,           -- external auth ID or API key userId
  email        TEXT      NULL UNIQUE,
  name         TEXT      NULL,
  plan_slug    TEXT      NOT NULL DEFAULT 'free' REFERENCES plans(slug),
  credit_balance INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT      NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT      NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKSPACES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id           TEXT      PRIMARY KEY,
  name         TEXT      NOT NULL,
  owner_user_id TEXT     NOT NULL REFERENCES users(id),
  plan_slug    TEXT      NOT NULL DEFAULT 'free' REFERENCES plans(slug),
  created_at   TEXT      NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT      NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT      NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT      NOT NULL REFERENCES users(id),
  role         TEXT      NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  joined_at    TEXT      NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL DEFAULT 'Untitled Project',
  owner_user_id TEXT    NOT NULL REFERENCES users(id),
  workspace_id  TEXT    NULL REFERENCES workspaces(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_owner      ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace  ON projects(workspace_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- BLUEPRINTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blueprints (
  id              TEXT    PRIMARY KEY,
  user_id         TEXT    NOT NULL REFERENCES users(id),
  project_id      TEXT    NULL REFERENCES projects(id),
  filename        TEXT    NOT NULL,
  file_path       TEXT    NOT NULL,    -- relative to uploads/
  mime_type       TEXT    NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  analysis_json   TEXT    NULL,        -- BlueprintAnalysisV1 JSON
  analyzed_at     TEXT    NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blueprints_user    ON blueprints(user_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_project ON blueprints(project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- GENERATIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generations (
  id                   TEXT    PRIMARY KEY,
  project_id           TEXT    NOT NULL DEFAULT 'default-project' REFERENCES projects(id),
  user_id              TEXT    NOT NULL REFERENCES users(id),
  prompt               TEXT    NOT NULL DEFAULT '',
  context              TEXT    NULL,
  status               TEXT    NOT NULL DEFAULT 'queued',
    -- queued | analyzing_blueprint | generating_spec | checking_constraints
    -- generating_plan | building_preview | validating | repairing | ready | failed
  blueprint_id         TEXT    NULL REFERENCES blueprints(id),
  manufacturing_mode   TEXT    NULL,
  material_preference  TEXT    NULL,
  high_detail          INTEGER NOT NULL DEFAULT 0,
  solid_requested      INTEGER NOT NULL DEFAULT 0,
  spec_json            TEXT    NULL,        -- SpecV1 JSON
  blueprint_analysis   TEXT    NULL,        -- embedded blueprint hints
  constraint_report    TEXT    NULL,        -- ConstraintReportV1 JSON
  geometry_plan        TEXT    NULL,        -- GeometryPlanV1 JSON
  validation_report    TEXT    NULL,        -- ValidationReportV1 JSON
  preview_parts        TEXT    NULL,        -- preview JSON
  stl_base64           TEXT    NULL,
  image_url            TEXT    NULL,
  error_context        TEXT    NULL,
  solid_status         TEXT    NULL,        -- null | pending | building | done | failed
  build_metadata       TEXT    NULL,        -- JSON
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_generations_user      ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_project   ON generations(project_id);
CREATE INDEX IF NOT EXISTS idx_generations_status    ON generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_created   ON generations(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- REPAIR ATTEMPTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS repair_attempts (
  id              TEXT    PRIMARY KEY,
  generation_id   TEXT    NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  issues_before   TEXT    NULL,   -- JSON array of issues
  plan_before     TEXT    NULL,   -- GeometryPlanV1 JSON
  plan_after      TEXT    NULL,
  validation_after TEXT   NULL,
  success         INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT    NULL,
  repaired_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_repairs_generation ON repair_attempts(generation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SOLID BUILDS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solid_builds (
  id              TEXT    PRIMARY KEY,
  generation_id   TEXT    NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  status          TEXT    NOT NULL DEFAULT 'pending',
    -- pending | building | done | failed
  cad_script      TEXT    NULL,
  stl_base64      TEXT    NULL,
  output_path     TEXT    NULL,
  vertex_count    INTEGER NULL,
  triangle_count  INTEGER NULL,
  execution_ms    INTEGER NULL,
  worker_url      TEXT    NULL,
  error_message   TEXT    NULL,
  started_at      TEXT    NULL,
  completed_at    TEXT    NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_solid_builds_generation ON solid_builds(generation_id);
CREATE INDEX IF NOT EXISTS idx_solid_builds_status     ON solid_builds(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- EXPORTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exports (
  id              TEXT    PRIMARY KEY,
  generation_id   TEXT    NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  user_id         TEXT    NOT NULL REFERENCES users(id),
  format          TEXT    NOT NULL,   -- 'obj' | 'glb' | 'stl'
  file_path       TEXT    NULL,
  file_size_bytes INTEGER NULL,
  status          TEXT    NOT NULL DEFAULT 'ready',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exports_generation ON exports(generation_id);
CREATE INDEX IF NOT EXISTS idx_exports_user       ON exports(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- USAGE EVENTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_events (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL REFERENCES users(id),
  workspace_id TEXT    NULL REFERENCES workspaces(id),
  event_type   TEXT    NOT NULL,   -- 'generation' | 'solid_build' | 'export' | ...
  credits_used INTEGER NOT NULL DEFAULT 0,
  metadata     TEXT    NULL,       -- JSON
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_user    ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_type    ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_events(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- ONBOARDING STATES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS onboarding_states (
  id               TEXT    PRIMARY KEY,
  user_id          TEXT    NOT NULL UNIQUE REFERENCES users(id),
  current_step     TEXT    NOT NULL DEFAULT 'welcome',
  step_index       INTEGER NOT NULL DEFAULT 0,
  steps_completed  TEXT    NOT NULL DEFAULT '[]',  -- JSON array
  skipped          INTEGER NOT NULL DEFAULT 0,
  started_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at     TEXT    NULL,
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ANALYTICS EVENTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_events (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NULL REFERENCES users(id),
  session_id TEXT    NULL,
  event_name TEXT    NOT NULL,
  page       TEXT    NULL,
  metadata   TEXT    NULL,   -- JSON
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_event   ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_user    ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- WAITLIST
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id         TEXT    PRIMARY KEY,
  email      TEXT    NOT NULL UNIQUE,
  name       TEXT    NULL,
  company    TEXT    NULL,
  use_case   TEXT    NULL,
  source     TEXT    NULL,
  status     TEXT    NOT NULL DEFAULT 'pending',  -- 'pending' | 'invited' | 'joined'
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email  ON waitlist_entries(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist_entries(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- FEEDBACK
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_entries (
  id              TEXT    PRIMARY KEY,
  user_id         TEXT    NULL REFERENCES users(id),
  project_id      TEXT    NULL REFERENCES projects(id),
  generation_id   TEXT    NULL REFERENCES generations(id),
  category        TEXT    NOT NULL DEFAULT 'other',
  message         TEXT    NOT NULL,
  metadata        TEXT    NULL,   -- JSON
  status          TEXT    NOT NULL DEFAULT 'open',
    -- 'open' | 'in_review' | 'resolved' | 'wont_fix'
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_user     ON feedback_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status   ON feedback_entries(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback_entries(category);
