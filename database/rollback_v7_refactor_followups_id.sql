-- Rollback: Refactor crm_tbl_followups Primary Key
-- Description: Reverts 'followup_id' back to 'id', removes audit columns, and restores foreign key references.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop foreign key constraint
ALTER TABLE crm_tbl_followUpSummary DROP FOREIGN KEY IF EXISTS crm_tbl_followUpSummary_ibfk_1;

-- 2. Rename Primary Key column back to 'id'
ALTER TABLE crm_tbl_followups CHANGE COLUMN followup_id id INT AUTO_INCREMENT;

-- 3. Remove Audit Columns
ALTER TABLE crm_tbl_followups 
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS updated_by;

-- 4. Re-add foreign key constraint with old reference
ALTER TABLE crm_tbl_followUpSummary 
ADD CONSTRAINT crm_tbl_followUpSummary_ibfk_1 
FOREIGN KEY (followup_id) REFERENCES crm_tbl_followups(id) 
ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
