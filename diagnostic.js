const db = require("./config/db");
const pool = db.promise;

async function run() {
  try {
    const [leads] = await pool.query("SELECT lead_id, full_name, lead_category, lead_status FROM crm_tbl_leads WHERE lead_status = 'Converted' LIMIT 5");
    console.log("Converted Leads:", leads);
    
    for (const lead of leads) {
      const [clients] = await pool.query("SELECT client_id, organisation_name FROM crm_tbl_clients WHERE lead_id = ?", [lead.lead_id]);
      console.log(`Lead ${lead.lead_id} -> Clients:`, clients);
      
      for (const client of clients) {
        const [projects] = await pool.query("SELECT project_id, project_name, project_category FROM crm_tbl_projects WHERE client_id = ?", [client.client_id]);
        console.log(`  Client ${client.client_id} -> Projects:`, projects);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
