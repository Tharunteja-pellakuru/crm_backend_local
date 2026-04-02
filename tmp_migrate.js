const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "crm_db",
  port: process.env.DB_PORT || 3306,
});

const query = "ALTER TABLE crm_tbl_leads ADD COLUMN country_code VARCHAR(10) AFTER country;";

db.query(query, (err, result) => {
  if (err) {
    if (err.code === "ER_DUP_COLUMN_NAME") {
      console.log("Column country_code already exists.");
      process.exit(0);
    }
    console.error("Error adding column:", err.message);
    process.exit(1);
  }
  console.log("Column country_code added successfully!");
  process.exit(0);
});
