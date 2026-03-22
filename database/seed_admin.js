const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "crm_db",
});

const seed = async () => {
  const email = "chaitanya@parivartan.crm";
  const password = "Password@123";
  const hashedPassword = await bcrypt.hash(password, 10);
  const uuid = uuidv4();

  connection.query(
    "SELECT * FROM crm_tbl_admins WHERE email = ?",
    [email],
    (err, results) => {
      if (err) {
        console.error("Error checking user:", err);
        process.exit(1);
      }

      if (results.length === 0) {
        connection.query(
          "INSERT INTO crm_tbl_admins (uuid, full_name, email, password, role, privileges, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [uuid, "Chaitanya Admin", email, hashedPassword, "Root Admin", 3, 1],
          (err) => {
            if (err) {
              console.error("Error seeding user:", err);
            } else {
              console.log("Admin user seeded successfully!");
            }
            process.exit(0);
          }
        );
      } else {
        console.log("Admin user already exists.");
        process.exit(0);
      }
    }
  );
};

seed();
