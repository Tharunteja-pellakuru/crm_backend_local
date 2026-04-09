-- Migration: Refactor crm_tbl_followups Primary Key and Add Audit Columns
-- Description: Renames 'id' to 'followup_id', adds 'created_by' and 'updated_by' columns, and updates foreign key references.

-- 1. Disable foreign key checks to safely perform structural changes
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Drop foreign key constraint from dependent table crm_tbl_followUpSummary
ALTER TABLE crm_tbl_followUpSummary DROP FOREIGN KEY IF EXISTS crm_tbl_followUpSummary_ibfk_1;

-- 3. Rename Primary Key column in crm_tbl_followups
-- Note: 'RENAME COLUMN' is supported in MySQL 8.0.1+, MariaDB 10.5.2+
-- Using 'CHANGE COLUMN' for broader compatibility (MariaDB 10.4)
ALTER TABLE crm_tbl_followups CHANGE COLUMN id followup_id INT AUTO_INCREMENT;

-- 4. Add Audit Columns if they don't already exist
ALTER TABLE crm_tbl_followups 
ADD COLUMN IF NOT EXISTS created_by INT NULL,
ADD COLUMN IF NOT EXISTS updated_by INT NULL;

-- 5. Re-add foreign key constraint with updated reference
ALTER TABLE crm_tbl_followUpSummary 
ADD CONSTRAINT crm_tbl_followUpSummary_ibfk_1 
FOREIGN KEY (followup_id) REFERENCES crm_tbl_followups(followup_id) 
ON DELETE CASCADE;

-- 6. Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
