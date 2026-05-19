-- ============================================================
-- COMPANY PERSONNEL MANAGEMENT SYSTEM
-- Military Reserve / Active Armor Company
-- Full schema with RLS policies
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS — drop first to allow clean re-runs
-- ============================================================

DROP TYPE IF EXISTS user_role     CASCADE;
DROP TYPE IF EXISTS crew_position CASCADE;
DROP TYPE IF EXISTS soldier_status CASCADE;
DROP TYPE IF EXISTS request_status CASCADE;

CREATE TYPE user_role AS ENUM (
  'company_commander',   -- מפקד פלוגה (עליון)
  'platoon_commander',   -- מפקד מחלקה
  'crew_commander',      -- מפקד צוות
  'soldier'             -- חייל
);

CREATE TYPE crew_position AS ENUM (
  'commander',   -- מפקד
  'gunner',      -- תותחן
  'loader',      -- טוען
  'driver'       -- נהג
);

CREATE TYPE soldier_status AS ENUM (
  'available',   -- זמין
  'leave',       -- חופשה
  'mission',     -- משימה
  'sick'         -- חולה
);

CREATE TYPE request_status AS ENUM (
  'pending',    -- ממתין
  'approved',   -- אושר
  'rejected'    -- נדחה
);

-- ============================================================
-- DROP TABLES (safe re-run) — CASCADE handles foreign keys
-- ============================================================

DROP TABLE IF EXISTS audit_log          CASCADE;
DROP TABLE IF EXISTS feedback           CASCADE;
DROP TABLE IF EXISTS absence_requests   CASCADE;
DROP TABLE IF EXISTS users              CASCADE;
DROP TABLE IF EXISTS crews              CASCADE;
DROP TABLE IF EXISTS platoons           CASCADE;
DROP TABLE IF EXISTS email_whitelist    CASCADE;

-- ============================================================
-- TABLE: email_whitelist
-- Controls who is allowed to register
-- ============================================================

CREATE TABLE email_whitelist (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  added_by      UUID,  -- references auth.users
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: platoons
-- ============================================================

CREATE TABLE platoons (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,             -- e.g. "מחלקה 1"
  platoon_number INTEGER UNIQUE NOT NULL,  -- 1, 2, 3, HQ=0
  commander_id  UUID,                      -- references users.id (set after users created)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: crews
-- ============================================================

CREATE TABLE crews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,             -- e.g. "צוות א׳"
  platoon_id    UUID REFERENCES platoons(id) ON DELETE SET NULL,
  commander_id  UUID,                      -- references users.id
  vehicle_id    TEXT,                      -- tank/vehicle identifier
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: users (extends auth.users via id)
-- personal_id = military ID number (unique per soldier)
-- ============================================================

CREATE TABLE users (
  id                        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_id               TEXT UNIQUE NOT NULL,   -- military personal ID
  email                     TEXT UNIQUE NOT NULL,
  first_name                TEXT NOT NULL,
  last_name                 TEXT NOT NULL,
  phone_number              TEXT,
  role                      user_role NOT NULL DEFAULT 'soldier',
  primary_platoon_id        UUID REFERENCES platoons(id) ON DELETE SET NULL,
  crew_id                   UUID REFERENCES crews(id) ON DELETE SET NULL,
  crew_position             crew_position,
  status                    soldier_status NOT NULL DEFAULT 'available',
  medical_fitness           BOOLEAN DEFAULT TRUE,
  medical_fitness_notes     TEXT,
  shooting_qualification_date DATE,
  is_backup_in_crew_id      UUID REFERENCES crews(id) ON DELETE SET NULL,  -- backup slot in another crew
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Add back foreign keys for commander references
ALTER TABLE platoons
  ADD CONSTRAINT fk_platoon_commander
  FOREIGN KEY (commander_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE crews
  ADD CONSTRAINT fk_crew_commander
  FOREIGN KEY (commander_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: absence_requests (soldier submissions)
-- ============================================================

CREATE TABLE absence_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  soldier_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type  soldier_status NOT NULL,   -- leave / sick / mission
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  status        request_status NOT NULL DEFAULT 'pending',
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: feedback (historical commander notes on soldiers)
-- ============================================================

CREATE TABLE feedback (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  soldier_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  is_private    BOOLEAN DEFAULT FALSE,  -- only visible to company_commander if true
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_log (security trail)
-- ============================================================

CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,      -- e.g. 'ASSIGN_SOLDIER', 'BULK_IMPORT'
  target_table  TEXT,
  target_id     TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================

CREATE INDEX idx_users_platoon      ON users(primary_platoon_id);
CREATE INDEX idx_users_crew         ON users(crew_id);
CREATE INDEX idx_users_role         ON users(role);
CREATE INDEX idx_users_status       ON users(status);
CREATE INDEX idx_crews_platoon      ON crews(platoon_id);
CREATE INDEX idx_feedback_soldier   ON feedback(soldier_id);
CREATE INDEX idx_requests_soldier   ON absence_requests(soldier_id);
CREATE INDEX idx_requests_status    ON absence_requests(status);

-- ============================================================
-- UPDATED_AT trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: get_my_role()
-- Returns the role of the currently authenticated user
-- Used safely inside RLS policies (no infinite recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCTION: get_my_platoon_id()
-- Returns the platoon of the currently authenticated user
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_platoon_id()
RETURNS UUID AS $$
  SELECT primary_platoon_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCTION: is_commander_of_platoon(platoon_id)
-- Returns true if current user commands that platoon
-- ============================================================

CREATE OR REPLACE FUNCTION is_commander_of_platoon(p_platoon_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platoons
    WHERE id = p_platoon_id AND commander_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================

ALTER TABLE email_whitelist     ENABLE ROW LEVEL SECURITY;
ALTER TABLE platoons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: email_whitelist
-- Only company_commander can manage the whitelist
-- ============================================================

CREATE POLICY "whitelist_select_commander"
  ON email_whitelist FOR SELECT
  USING (get_my_role() = 'company_commander');

CREATE POLICY "whitelist_insert_commander"
  ON email_whitelist FOR INSERT
  WITH CHECK (get_my_role() = 'company_commander');

CREATE POLICY "whitelist_delete_commander"
  ON email_whitelist FOR DELETE
  USING (get_my_role() = 'company_commander');

-- ============================================================
-- RLS POLICIES: platoons
-- ============================================================

-- Company commander sees all platoons
-- Platoon commanders see only their own platoon
-- Soldiers see only their own platoon
CREATE POLICY "platoons_select"
  ON platoons FOR SELECT
  USING (
    get_my_role() = 'company_commander'
    OR commander_id = auth.uid()
    OR id = get_my_platoon_id()
  );

-- Only company commander can create/edit/delete platoons
CREATE POLICY "platoons_insert"
  ON platoons FOR INSERT
  WITH CHECK (get_my_role() = 'company_commander');

CREATE POLICY "platoons_update"
  ON platoons FOR UPDATE
  USING (get_my_role() = 'company_commander');

CREATE POLICY "platoons_delete"
  ON platoons FOR DELETE
  USING (get_my_role() = 'company_commander');

-- ============================================================
-- RLS POLICIES: crews
-- ============================================================

CREATE POLICY "crews_select"
  ON crews FOR SELECT
  USING (
    get_my_role() = 'company_commander'
    OR platoon_id = get_my_platoon_id()
    OR commander_id = auth.uid()
  );

CREATE POLICY "crews_insert"
  ON crews FOR INSERT
  WITH CHECK (
    get_my_role() IN ('company_commander', 'platoon_commander')
  );

CREATE POLICY "crews_update"
  ON crews FOR UPDATE
  USING (
    get_my_role() = 'company_commander'
    OR (get_my_role() = 'platoon_commander' AND platoon_id = get_my_platoon_id())
  );

CREATE POLICY "crews_delete"
  ON crews FOR DELETE
  USING (
    get_my_role() = 'company_commander'
    OR (get_my_role() = 'platoon_commander' AND platoon_id = get_my_platoon_id())
  );

-- ============================================================
-- RLS POLICIES: users
-- CRITICAL: Soldiers cannot see other platoons' data
-- ============================================================

CREATE POLICY "users_select"
  ON users FOR SELECT
  USING (
    -- Can always see yourself
    id = auth.uid()
    -- Company commander sees everyone
    OR get_my_role() = 'company_commander'
    -- Platoon commander sees their platoon members
    OR (
      get_my_role() = 'platoon_commander'
      AND primary_platoon_id = get_my_platoon_id()
    )
    -- Crew commander sees their crew members
    OR (
      get_my_role() = 'crew_commander'
      AND crew_id IN (
        SELECT crew_id FROM users WHERE id = auth.uid()
      )
    )
    -- Soldiers can only see themselves (covered by first condition)
  );

-- Only company_commander can create new users (bulk import also uses service role)
CREATE POLICY "users_insert"
  ON users FOR INSERT
  WITH CHECK (
    get_my_role() = 'company_commander'
    -- Allow self-registration via service_role (handled in API route)
    OR auth.uid() = id
  );

-- Update rules: self + commanders for their scope
CREATE POLICY "users_update"
  ON users FOR UPDATE
  USING (
    id = auth.uid()  -- self-update (limited fields enforced in app layer)
    OR get_my_role() = 'company_commander'
    OR (
      get_my_role() = 'platoon_commander'
      AND primary_platoon_id = get_my_platoon_id()
    )
    OR (
      get_my_role() = 'crew_commander'
      AND crew_id IN (SELECT crew_id FROM users WHERE id = auth.uid())
    )
  );

-- Only company commander can delete users
CREATE POLICY "users_delete"
  ON users FOR DELETE
  USING (get_my_role() = 'company_commander');

-- ============================================================
-- RLS POLICIES: absence_requests
-- ============================================================

CREATE POLICY "requests_select"
  ON absence_requests FOR SELECT
  USING (
    soldier_id = auth.uid()  -- soldier sees own requests
    OR get_my_role() = 'company_commander'
    OR (
      get_my_role() = 'platoon_commander'
      AND soldier_id IN (
        SELECT id FROM users WHERE primary_platoon_id = get_my_platoon_id()
      )
    )
    OR (
      get_my_role() = 'crew_commander'
      AND soldier_id IN (
        SELECT id FROM users WHERE crew_id IN (
          SELECT crew_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Any authenticated user can submit a request for themselves
CREATE POLICY "requests_insert"
  ON absence_requests FOR INSERT
  WITH CHECK (soldier_id = auth.uid());

-- Commanders can approve/reject; soldiers can cancel pending own requests
CREATE POLICY "requests_update"
  ON absence_requests FOR UPDATE
  USING (
    get_my_role() = 'company_commander'
    OR (
      get_my_role() = 'platoon_commander'
      AND soldier_id IN (
        SELECT id FROM users WHERE primary_platoon_id = get_my_platoon_id()
      )
    )
    OR (soldier_id = auth.uid() AND status = 'pending')  -- soldier can cancel
  );

-- ============================================================
-- RLS POLICIES: feedback
-- CRITICAL: Soldiers are COMPLETELY BLOCKED from this table
-- ============================================================

CREATE POLICY "feedback_select"
  ON feedback FOR SELECT
  USING (
    -- Soldiers: NO ACCESS whatsoever
    get_my_role() = 'company_commander'
    OR (
      get_my_role() = 'platoon_commander'
      AND is_private = FALSE
      AND soldier_id IN (
        SELECT id FROM users WHERE primary_platoon_id = get_my_platoon_id()
      )
    )
    OR (
      get_my_role() = 'crew_commander'
      AND is_private = FALSE
      AND author_id = auth.uid()  -- crew commanders only see their own feedback
    )
  );

CREATE POLICY "feedback_insert"
  ON feedback FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND get_my_role() IN ('company_commander', 'platoon_commander', 'crew_commander')
  );

CREATE POLICY "feedback_delete"
  ON feedback FOR DELETE
  USING (
    author_id = auth.uid()
    OR get_my_role() = 'company_commander'
  );

-- ============================================================
-- RLS POLICIES: audit_log
-- Only company commander can view audit log
-- System (service_role) writes to it
-- ============================================================

CREATE POLICY "audit_select_commander"
  ON audit_log FOR SELECT
  USING (get_my_role() = 'company_commander');

-- ============================================================
-- FUNCTION: check_email_whitelist()
-- Called by the auth hook to validate registration
-- ============================================================

CREATE OR REPLACE FUNCTION check_email_whitelist(p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM email_whitelist WHERE email = LOWER(p_email)
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: get_available_soldiers_for_position(position, crew_id)
-- Returns soldiers matching a crew position who are unassigned
-- Used by the Smart Floating Assignment feature
-- ============================================================

CREATE OR REPLACE FUNCTION get_available_soldiers_for_position(
  p_position    crew_position,
  p_platoon_id  UUID
)
RETURNS TABLE (
  id            UUID,
  personal_id   TEXT,
  first_name    TEXT,
  last_name     TEXT,
  phone_number  TEXT,
  status        soldier_status,
  is_backup     BOOLEAN
) AS $$
  SELECT
    u.id,
    u.personal_id,
    u.first_name,
    u.last_name,
    u.phone_number,
    u.status,
    (u.is_backup_in_crew_id IS NOT NULL) AS is_backup
  FROM users u
  WHERE
    u.crew_position = p_position
    AND u.crew_id IS NULL              -- unassigned to a primary crew
    AND u.status = 'available'
    AND u.primary_platoon_id = p_platoon_id
    AND u.medical_fitness = TRUE
  ORDER BY u.last_name, u.first_name
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- SEED: Company platoons
-- ============================================================

INSERT INTO platoons (name, platoon_number) VALUES ('מטה פלוגה',    0);
INSERT INTO platoons (name, platoon_number) VALUES ('מחלקה 1',      1);
INSERT INTO platoons (name, platoon_number) VALUES ('מחלקה 2',      2);
INSERT INTO platoons (name, platoon_number) VALUES ('מחלקה 3',      3);
INSERT INTO platoons (name, platoon_number) VALUES ('מחלקה 4',      4);
INSERT INTO platoons (name, platoon_number) VALUES ('חולייה טכנית', 5);
INSERT INTO platoons (name, platoon_number) VALUES ('ספיירים',      6);
