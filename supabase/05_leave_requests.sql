-- Migration: Add leave_requests table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  leave_time  text,
  reason      text,
  status      text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved')),
  approved_by uuid        REFERENCES public.users(id),
  approved_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Disable RLS so the admin client (service role) can always access
ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;

-- Index for fast soldier + date lookups
CREATE INDEX IF NOT EXISTS idx_leave_requests_soldier ON public.leave_requests(soldier_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status  ON public.leave_requests(status);
