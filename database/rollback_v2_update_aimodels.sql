-- Rollback Script: Revert crm_tbl_aiModels schema update
-- Date: 2026-04-08

-- Remove added columns
ALTER TABLE crm_tbl_aiModels
DROP COLUMN uuid,
DROP COLUMN created_by,
DROP COLUMN updated_at,
DROP COLUMN updated_by;

-- Rename aimodel_id back to id
ALTER TABLE crm_tbl_aiModels CHANGE COLUMN aimodel_id id INT AUTO_INCREMENT;
