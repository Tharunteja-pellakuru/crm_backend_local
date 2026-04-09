-- Rollback Script: Rename lead_id back to id and drop audit columns in crm_tbl_leads
-- Date: 2026-04-09

-- 1. Drop foreign keys referencing lead_id
ALTER TABLE crm_tbl_followups DROP FOREIGN KEY crm_tbl_followups_ibfk_1;
ALTER TABLE crm_tbl_clients DROP FOREIGN KEY fk_client_lead;

-- 2. Rename the column back
ALTER TABLE crm_tbl_leads RENAME COLUMN lead_id TO id;

-- 3. Drop audit columns
ALTER TABLE crm_tbl_leads 
DROP COLUMN created_by,
DROP COLUMN updated_by;

-- 4. Re-add foreign keys referencing 'id'
-- Followups
ALTER TABLE crm_tbl_followups 
ADD CONSTRAINT crm_tbl_followups_ibfk_1 
FOREIGN KEY (lead_id) REFERENCES crm_tbl_leads(id) 
ON DELETE CASCADE;

-- Clients
ALTER TABLE crm_tbl_clients 
ADD CONSTRAINT fk_client_lead 
FOREIGN KEY (lead_id) REFERENCES crm_tbl_leads(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;
