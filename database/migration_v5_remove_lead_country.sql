-- Migration Script: Remove country column from crm_tbl_leads
-- Date: 2026-04-09
-- Description: Drop the 'country' column as it is redundant (covered by country_code)

-- USE crm_db;

-- Drop column if it exists
ALTER TABLE crm_tbl_leads
DROP COLUMN IF EXISTS country;
