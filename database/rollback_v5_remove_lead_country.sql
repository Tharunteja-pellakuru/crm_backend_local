-- Rollback Script: Re-add country column to crm_tbl_leads
-- Date: 2026-04-09
-- Description: Re-add the 'country' column to leads

-- USE crm_db;

-- Add column if it doesn't exist
ALTER TABLE crm_tbl_leads
ADD COLUMN IF NOT EXISTS country VARCHAR(100) AFTER message;
