const express = require("express");
const router = express.Router();

const {
  exportEnquiries,
  exportLeads,
  exportFollowups,
  exportClients,
  exportProjects,
  exportAllCRMData,
} = require("../controllers/exportController");

// Export routes
router.get("/enquiries", exportEnquiries);
router.get("/leads", exportLeads);
router.get("/followups", exportFollowups);
router.get("/clients", exportClients);
router.get("/projects", exportProjects);
router.get("/all-crm-data", exportAllCRMData);

module.exports = router;
