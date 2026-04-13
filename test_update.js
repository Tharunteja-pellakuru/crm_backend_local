const db = require("./config/db");
const pool = db.promise;

async function run() {
  try {
    const projectId = 9;
    const newCategory = '3';
    
    console.log(`Updating Project ${projectId} to Category ${newCategory}...`);
    
    // Simulate the controller logic
    const [result] = await pool.query(
      "UPDATE crm_tbl_projects SET project_category = ? WHERE project_id = ?",
      [newCategory, projectId]
    );
    console.log("Projects Update Result:", result.affectedRows);

    // Get client_id
    const [pRows] = await pool.query("SELECT client_id FROM crm_tbl_projects WHERE project_id = ?", [projectId]);
    const clientId = pRows[0].client_id;
    console.log("Client ID:", clientId);

    // Get lead_id
    const [cRows] = await pool.query("SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?", [clientId]);
    const leadId = cRows[0].lead_id;
    console.log("Lead ID:", leadId);

    // Update lead
    const [lResult] = await pool.query("UPDATE crm_tbl_leads SET lead_category = ? WHERE lead_id = ?", [newCategory, leadId]);
    console.log("Leads Update Result:", lResult.affectedRows);

    // Verify
    const [pVerify] = await pool.query("SELECT project_category FROM crm_tbl_projects WHERE project_id = ?", [projectId]);
    const [lVerify] = await pool.query("SELECT lead_category FROM crm_tbl_leads WHERE lead_id = ?", [leadId]);
    
    console.log("Project 9 now has category:", pVerify[0].project_category);
    console.log("Lead now has category:", lVerify[0].lead_category);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
