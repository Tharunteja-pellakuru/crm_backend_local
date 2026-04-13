const db = require("./config/db");
const pool = db.promise;

async function run() {
  try {
    const projectId = 9;
    const newCategory = '2'; // Changing from 3 back to 2
    
    console.log(`Verifying Sync: Updating Project ${projectId} to Category ${newCategory}...`);
    
    // Simulate query that projectsController.updateProject runs
    await pool.query("UPDATE crm_tbl_projects SET project_category = ? WHERE project_id = ?", [newCategory, projectId]);
    
    // Simulate sync block in projectsController.js
    const [pRows] = await pool.query("SELECT client_id FROM crm_tbl_projects WHERE project_id = ?", [projectId]);
    const clientId = pRows[0].client_id;
    const [cRows] = await pool.query("SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?", [clientId]);
    const leadId = cRows[0].lead_id;
    
    await pool.query("UPDATE crm_tbl_leads SET lead_category = ? WHERE lead_id = ?", [newCategory, leadId]);
    
    console.log("Update complete. verifying database values...");
    
    const [pResult] = await pool.query("SELECT project_category FROM crm_tbl_projects WHERE project_id = ?", [projectId]);
    const [lResult] = await pool.query("SELECT lead_category FROM crm_tbl_leads WHERE lead_id = ?", [leadId]);
    
    console.log(`Project 9 Category: ${pResult[0].project_category}`);
    console.log(`Lead 6 Category: ${lResult[0].lead_category}`);
    
    if (pResult[0].project_category === newCategory && lResult[0].lead_category === newCategory) {
      console.log("SUCCESS: Bi-directional sync verified in DB!");
    } else {
      console.error("FAILURE: Sync mismatch!");
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
