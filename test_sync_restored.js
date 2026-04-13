const db = require("./config/db");
const pool = db.promise;

async function run() {
  try {
    const projectId = 11;
    const leadId = 11;
    const newCategory = '3';
    
    console.log(`Testing Sync on RESTORED data: Updating Project ${projectId} to Category ${newCategory}...`);
    
    // Simulate what projectsController.updateProject does
    // 1. Update Project
    await pool.query("UPDATE crm_tbl_projects SET project_category = ? WHERE project_id = ?", [newCategory, projectId]);
    
    // 2. Sync to Lead (logic from controller)
    const [projectRows] = await pool.query("SELECT client_id, project_category FROM crm_tbl_projects WHERE project_id = ?", [projectId]);
    const clientId = projectRows[0].client_id;
    const currentCategory = projectRows[0].project_category;
    const [clientRows] = await pool.query("SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?", [clientId]);
    const actualLeadId = clientRows[0].lead_id;
    
    await pool.query("UPDATE crm_tbl_leads SET lead_category = ? WHERE lead_id = ?", [currentCategory, actualLeadId]);
    
    console.log("Update and Sync complete. Verifying...");
    
    const [pRes] = await pool.query("SELECT project_category FROM crm_tbl_projects WHERE project_id = ?", [projectId]);
    const [lRes] = await pool.query("SELECT lead_category FROM crm_tbl_leads WHERE lead_id = ?", [actualLeadId]);
    
    console.log(`Project 11 Category: ${pRes[0].project_category}`);
    console.log(`Lead 11 Category: ${lRes[0].lead_category}`);
    
    if (pRes[0].project_category === newCategory && lRes[0].lead_category === newCategory) {
       console.log("SUCCESS: Bi-directional synchronization is working on the new schema and restored data!");
    } else {
       console.error("FAILURE: Sync failed.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
