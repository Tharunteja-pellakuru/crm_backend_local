const db = require("./config/db");

const clientId = 1; // Testing with ID 1
const query = `
    SELECT f.*, s.conclusion_message as follow_brief, s.completed_at, s.completed_by, 
           p.project_name as projectName, p.client_id as mappedClientId,
           COALESCE(f.lead_id, (SELECT lead_id FROM crm_tbl_clients WHERE client_id = p.client_id)) as originalLeadId
    FROM crm_tbl_followups f
    LEFT JOIN crm_tbl_followUpSummary s ON f.followup_id = s.followup_id
    LEFT JOIN crm_tbl_projects p ON f.project_id = p.project_id
    WHERE f.lead_id = ? 
       OR f.lead_id = (SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?)
       OR f.project_id IN (SELECT project_id FROM crm_tbl_projects WHERE client_id = ?)
    ORDER BY f.followup_datetime DESC
  `;

db.query(query, [clientId, clientId, clientId], (err, results) => {
  if (err) {
    console.error("QUERY FAILED:", err);
    process.exit(1);
  }
  console.log("QUERY SUCCESS, FOUND:", results.length, "rows");
  console.log("FIRST ROW:", results[0]);
  process.exit(0);
});
