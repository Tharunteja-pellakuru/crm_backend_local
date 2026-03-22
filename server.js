const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Tables
const { createAllTables } = require("./database/createTables");

// Route Imports
const adminUserRoutes = require("./routes/adminUserRoutes");
const authRoutes = require("./routes/authRoutes");
const aiRoutes = require("./routes/aiRoutes");
const leadsRoutes = require("./routes/leadsRoutes");
const followUpsRoutes = require("./routes/followUpsRoutes");
const clientsRoutes = require("./routes/clientsRoutes");
const projectsRoutes = require("./routes/projectsRoutes");
const enquiriesRoutes = require("./routes/enquiriesRoutes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
/* Serve uploaded images with absolute path */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  /* Create tables when server starts — sequential to respect foreign keys */
  await createAllTables();
});

const { authenticateToken } = require("./middleware/authMiddleware");

/* Public Routes */
app.use("/api", authRoutes); // /api/login

// Test route to verify AI routes are working
app.get("/api/test-routes", (req, res) => {
  res.json({
    message: "API is working",
    aiRoutesLoaded: true,
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.send("CRM Backend Running");
});

/* Protected Routes (require token) */
app.use("/api", authenticateToken);

app.use("/api", adminUserRoutes);
app.use("/api", aiRoutes);
app.use("/api", leadsRoutes);
app.use("/api", followUpsRoutes);
app.use("/api", clientsRoutes);
app.use("/api", projectsRoutes);
app.use("/api", enquiriesRoutes);
