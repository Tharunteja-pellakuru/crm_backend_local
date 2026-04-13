const db = require("./config/db");
const pool = db.promise;
const { v4: uuidv4 } = require("uuid");

async function run() {
  try {
    console.log("--- RESTORING TEST DATA ---");

    const converts = [
        { enquiry_id: 4, name: "Gopi Chand", category: "1" },
        { enquiry_id: 2, name: "John Marks", category: "2" }
    ];

    for (const data of converts) {
        console.log(`Converting ${data.name}...`);
        
        // 1. Mark Enquiry as Converted
        await pool.query("UPDATE crm_tbl_enquiries SET status = 'Converted' WHERE enquiry_id = ?", [data.enquiry_id]);

        // 2. Create Lead
        const leadUuid = uuidv4();
        const [lResult] = await pool.query(
            "INSERT INTO crm_tbl_leads (uuid, full_name, lead_category, lead_status, enquiry_id) VALUES (?, ?, ?, 'Converted', ?)",
            [leadUuid, data.name, data.category, data.enquiry_id]
        );
        const leadId = lResult.insertId;

        // 3. Create Client
        const clientUuid = uuidv4();
        const [cResult] = await pool.query(
            "INSERT INTO crm_tbl_clients (uuid, organisation_name, client_name, lead_id) VALUES (?, ?, ?, ?)",
            [clientUuid, `${data.name} Organisation`, data.name, leadId]
        );
        const clientId = cResult.insertId;

        // 4. Create Project
        const projectUuid = uuidv4();
        await pool.query(
            "INSERT INTO crm_tbl_projects (uuid, project_name, project_category, client_id, project_status, project_priority, project_budget, onboarding_date, deadline_date) VALUES (?, ?, ?, ?, 'In Progress', 'High', 1000, '2026-04-13', '2026-05-13')",
            [projectUuid, `${data.name} Project`, data.category, clientId]
        );
        
        console.log(`Successfully restored ${data.name} (Lead ID: ${leadId}, Project created)`);
    }

    console.log("--- DATA RESTORE COMPLETE ---");
    process.exit(0);
  } catch (err) {
    console.error("Restore Error:", err);
    process.exit(1);
  }
}
run();
