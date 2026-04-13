const db = require("./config/db");
const pool = db.promise;

const CATEGORY_MAP = {
  "Tech": "1",
  "Social Media": "2",
  "Both": "3"
};

async function run() {
  try {
    console.log("--- DATABASE SYNC REPAIR STARTED ---");
    
    // 1. Fetch all projects
    const [projects] = await pool.query("SELECT project_id, project_name, project_category, client_id FROM crm_tbl_projects");
    console.log(`Auditing ${projects.length} projects...`);
    
    let repairedCount = 0;
    
    for (const p of projects) {
      // Normalize project category first if it is legacy text
      let projectCat = p.project_category;
      if (CATEGORY_MAP[projectCat]) {
        projectCat = CATEGORY_MAP[projectCat];
        await pool.query("UPDATE crm_tbl_projects SET project_category = ? WHERE project_id = ?", [projectCat, p.project_id]);
        console.log(`Normalized Project ${p.project_id} category to ${projectCat}`);
      }

      if (!p.client_id) continue;

      // Find associated lead
      const [clients] = await pool.query("SELECT lead_id FROM crm_tbl_clients WHERE client_id = ?", [p.client_id]);
      if (clients.length > 0 && clients[0].lead_id) {
        const leadId = clients[0].lead_id;
        
        // Update Lead to match Project source of truth
        await pool.query("UPDATE crm_tbl_leads SET lead_category = ? WHERE lead_id = ?", [projectCat, leadId]);
        repairedCount++;
        console.log(`Synced Lead ${leadId} to category ${projectCat} (from Project ${p.project_id})`);
      }
    }

    // 2. Also normalize any remaining Leads that don't have projects
    const [leads] = await pool.query("SELECT lead_id, lead_category FROM crm_tbl_leads");
    for (const l of leads) {
       if (CATEGORY_MAP[l.lead_category]) {
         const newCat = CATEGORY_MAP[l.lead_category];
         await pool.query("UPDATE crm_tbl_leads SET lead_category = ? WHERE lead_id = ?", [newCat, l.lead_id]);
         console.log(`Normalized Lead ${l.lead_id} category to ${newCat}`);
       }
    }

    console.log(`--- REPAIR COMPLETED: ${repairedCount} leads synced to projects ---`);
    process.exit(0);
  } catch (err) {
    console.error("Critical Repair Error:", err);
    process.exit(1);
  }
}
run();
