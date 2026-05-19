-- ================================================================
-- add_deployment_configs.sql
-- Run ONCE in Supabase SQL Editor AFTER schema.sql and seed scripts.
-- Adds the "deployment configurations" system that lets you maintain
-- multiple isolated roster profiles (e.g. "שיבוץ כללי", "קו לבוש").
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE: deployment_configs
-- A named roster configuration (e.g. "שיבוץ כללי")
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deployment_configs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: deployment_assignments
-- Maps a soldier → crew + position within ONE specific config.
-- position_label is free text: "מפקד", "תותחן", or any custom label.
-- PRIMARY KEY ensures each soldier appears at most once per config.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deployment_assignments (
  config_id      UUID    NOT NULL REFERENCES deployment_configs(id) ON DELETE CASCADE,
  user_id        UUID    NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  crew_id        UUID    REFERENCES public.crews(id) ON DELETE SET NULL,
  position_label TEXT    NOT NULL DEFAULT 'חייל',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (config_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_da_config ON deployment_assignments(config_id);
CREATE INDEX IF NOT EXISTS idx_da_crew   ON deployment_assignments(config_id, crew_id);

-- ----------------------------------------------------------------
-- Seed the default "שיבוץ כללי" from existing users.crew_id data.
-- Skips if any config already exists (safe to run idempotently).
-- ----------------------------------------------------------------
DO $$
DECLARE
  cfg_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM deployment_configs LIMIT 1) THEN

    INSERT INTO deployment_configs (name) VALUES ('שיבוץ כללי') RETURNING id INTO cfg_id;

    INSERT INTO deployment_assignments (config_id, user_id, crew_id, position_label)
    SELECT
      cfg_id,
      u.id,
      u.crew_id,
      CASE u.crew_position
        WHEN 'commander' THEN 'מפקד'
        WHEN 'gunner'    THEN 'תותחן'
        WHEN 'loader'    THEN 'טוען'
        WHEN 'driver'    THEN 'נהג'
        ELSE 'חייל'
      END
    FROM public.users u
    WHERE u.crew_id IS NOT NULL;

    RAISE NOTICE 'Created default config "שיבוץ כללי": %', cfg_id;
  ELSE
    RAISE NOTICE 'Configs already exist – skipping seed.';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
ALTER TABLE deployment_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_assignments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can READ
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deployment_configs' AND policyname='configs_read') THEN
    CREATE POLICY configs_read ON deployment_configs FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deployment_assignments' AND policyname='assignments_read') THEN
    CREATE POLICY assignments_read ON deployment_assignments FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  -- Commanders can WRITE configs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deployment_configs' AND policyname='configs_write') THEN
    CREATE POLICY configs_write ON deployment_configs FOR ALL
      USING     (get_my_role() IN ('company_commander','platoon_commander'))
      WITH CHECK(get_my_role() IN ('company_commander','platoon_commander'));
  END IF;

  -- Commanders can WRITE assignments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deployment_assignments' AND policyname='assignments_write') THEN
    CREATE POLICY assignments_write ON deployment_assignments FOR ALL
      USING     (get_my_role() IN ('company_commander','platoon_commander','crew_commander'))
      WITH CHECK(get_my_role() IN ('company_commander','platoon_commander','crew_commander'));
  END IF;
END $$;
