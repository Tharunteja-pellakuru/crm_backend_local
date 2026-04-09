const express = require("express");
const router = express.Router();

const {
  createLead,
  updateLead,
  getLeads,
  deleteLead,
} = require("../controllers/leadsController");

const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/add-lead", authenticateToken, createLead);
router.put("/update-lead/:id", authenticateToken, updateLead);
router.get("/get-leads", authenticateToken, getLeads);
router.delete("/delete-lead/:id", authenticateToken, deleteLead);

module.exports = router;
