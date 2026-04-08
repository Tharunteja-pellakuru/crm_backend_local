-- Migration Script: Update crm_tbl_admins schema
-- Date: 2026-04-08

-- 1. Rename id to admin_id
-- We use CHANGE to rename the column and preserve attributes
ALTER TABLE crm_tbl_admins CHANGE COLUMN id admin_id INT AUTO_INCREMENT;

-- 2. Add created_by and updated_by columns if they don't exist
-- We add them after updated_at for logical grouping
ALTER TABLE crm_tbl_admins
ADD COLUMN created_by INT NULL AFTER updated_at,
ADD COLUMN updated_by INT NULL AFTER created_by;

-- 3. Log the change
-- Assuming a generic schema log table exists, or just for documentation
-- INSERT INTO crm_schema_logs (table_name, change_description) VALUES ('crm_tbl_admins', 'Renamed id to admin_id, added created_by and updated_by');
