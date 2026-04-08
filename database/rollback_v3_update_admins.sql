-- Rollback Script: Revert crm_tbl_admins schema changes
-- Date: 2026-04-08

-- 1. Rename admin_id back to id
ALTER TABLE crm_tbl_admins CHANGE COLUMN admin_id id INT AUTO_INCREMENT;

-- 2. Remove created_by and updated_by columns
ALTER TABLE crm_tbl_admins
DROP COLUMN created_by,
DROP COLUMN updated_by;
