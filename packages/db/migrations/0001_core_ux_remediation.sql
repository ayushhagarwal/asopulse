ALTER TABLE projects ADD COLUMN IF NOT EXISTS icon_url text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS schedule_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS schedule_frequency text NOT NULL DEFAULT 'daily';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS schedule_time text NOT NULL DEFAULT '06:00';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS schedule_timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS schedule_weekday integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM projects
    GROUP BY owner_id, app_id, storefront
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS projects_owner_app_storefront
      ON projects(owner_id, app_id, storefront);
  END IF;
END $$;

ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'scheduled';
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS requested_count integer NOT NULL DEFAULT 0;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS observed_count integer NOT NULL DEFAULT 0;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0;
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS failures jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS job_runs_project_time ON job_runs(project_id, started_at DESC);
