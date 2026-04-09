-- Rollback Script: Revert crm_tbl_enquiries schema changes
-- Date: 2026-04-09
-- Description: Remove created_by and updated_by columns from crm_tbl_enquiries

-- USE crm_db;

-- Drop columns if they exist
ALTER TABLE crm_tbl_enquiries
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS updated_by;

-- Optional: Log the rollback
-- INSERT INTO crm_schema_logs (table_name, change_description) VALUES ('crm_tbl_enquiries', 'Rollback: Removed created_by and updated_by columns');
