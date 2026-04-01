// const mysql = require("mysql2");
// require("dotenv").config();

// const db = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT,
// });

// db.getConnection((err, connection) => {
//   if (err) {
//     console.error("Database connection failed:", err.message);
//   } else {
//     console.log("MySQL Database Connected Successfully");
//     connection.release();
//   }
// });

// module.exports = db;

const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "mysql-a0eed66-pellakurutharunteja-a60a.d.aivencloud.com",
  port: 26256,
  user: "avnadmin",
  password: "YOUR_NEW_PASSWORD",
  database: "defaultdb",
  ssl: {
    ca: require("fs").readFileSync("C:/xampp/htdocs/crm/ca.pem"),
  },
});

db.connect((err) => {
  if (err) {
    console.error("Connection failed:", err);
    return;
  }
  console.log("Connected to Aiven MySQL!");
});

module.exports = db;
