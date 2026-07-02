CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, app_id text NOT NULL, app_name text NOT NULL, storefront text NOT NULL DEFAULT 'US',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tracked_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword text NOT NULL, enabled boolean NOT NULL DEFAULT true, tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id, keyword)
);
CREATE TABLE IF NOT EXISTS rank_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tracked_keyword_id uuid NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
  rank integer, result_count integer NOT NULL, competition integer NOT NULL, opportunity integer NOT NULL,
  method_version text NOT NULL, confidence text NOT NULL, observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rank_observations_keyword_time ON rank_observations(tracked_keyword_id, observed_at);
CREATE TABLE IF NOT EXISTS signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tracked_keyword_id uuid REFERENCES tracked_keywords(id) ON DELETE CASCADE, kind text NOT NULL,
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_name text NOT NULL, status text NOT NULL,
  detail text, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
