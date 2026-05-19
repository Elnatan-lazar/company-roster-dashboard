-- Migration: add is_admin flag to users
-- Run in Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Company commanders automatically get admin rights
UPDATE public.users
SET is_admin = true
WHERE role = 'company_commander';
