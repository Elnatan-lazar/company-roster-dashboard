-- Run this in the Supabase SQL Editor

-- 1. Permission columns on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS can_edit_roster   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_feedback boolean NOT NULL DEFAULT false;

-- 2. Company-wide strength goal settings (singleton row)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combat_crews_target integer NOT NULL DEFAULT 13,
  tech_members_target integer NOT NULL DEFAULT 5,
  spare_commanders    integer NOT NULL DEFAULT 0,
  spare_gunners       integer NOT NULL DEFAULT 0,
  spare_loaders       integer NOT NULL DEFAULT 0,
  spare_drivers       integer NOT NULL DEFAULT 0,
  updated_at          timestamptz DEFAULT now()
);

-- Seed default row if none exists
INSERT INTO public.company_settings (combat_crews_target, tech_members_target)
SELECT 13, 5
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- 3. Standardize loader label to 'טען' (without Vav) in existing assignment data
UPDATE public.deployment_assignments
SET position_label = 'טען'
WHERE position_label = 'טוען';
