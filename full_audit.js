const db = require("./config/db");
const pool = db.promise;

async function run() {
  try {
    const [projects] = await pool.query("SELECT project_id, project_category, client_id FROM crm_tbl_projects");
    console.log(`Found ${projects.length} projects.`);
    
    for (const p of projects) {
      if (!p.client_id) {
        console.log(`Project ${p.project_id} has NO client_id.`);
        continue;
      }
      
      const [clients] = await pool.query("SELECT client_id, lead_id FROM crm_tbl_clients WHERE client_id = ?", [p.client_id]);
      if (clients.length === 0) {
        console.log(`Project ${p.project_id} -> Client ${p.client_id} (NOT FOUND)`);
        continue;
      }
      
      const c = clients[0];
      if (!c.lead_id) {
        console.log(`Project ${p.project_id} -> Client ${c.client_id} -> Lead (NONE)`);
        continue;
      }
      
      const [leads] = await pool.query("SELECT lead_id, lead_category FROM crm_tbl_leads WHERE lead_id = ?", [c.lead_id]);
      if (leads.length === 0) {
        console.log(`Project ${p.project_id} -> Client ${c.client_id} -> Lead ${c.lead_id} (NOT FOUND)`);
        continue;
      }
      
      const l = leads[0];
      if (p.project_category !== l.lead_category) {
        console.log(`MISMATCH: Project ${p.project_id} cat=${p.project_category} vs Lead ${l.lead_id} cat=${l.lead_category}`);
      } else {
        console.log(`OK: Project ${p.project_id} matches Lead ${l.lead_id} (cat=${p.project_category})`);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
