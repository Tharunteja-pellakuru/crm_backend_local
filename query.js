const db = require("./config/db");
async function run() {
  const [projects] = await db.promise.query("SELECT * FROM crm_tbl_projects");
  const [clients] = await db.promise.query("SELECT c.*, c.client_id as id FROM crm_tbl_clients c");
  console.log("Projects:", JSON.stringify(projects, null, 2));
  console.log("Clients:", JSON.stringify(clients, null, 2));
  process.exit(0);
}
run();
