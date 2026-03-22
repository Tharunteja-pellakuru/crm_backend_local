const express = require("express");
const router = express.Router();

const {
  createLead,
  updateLead,
  getLeads,
  deleteLead,
} = require("../controllers/leadsController");

router.post("/add-lead", createLead);
router.put("/update-lead/:id", updateLead);
router.get("/get-leads", getLeads);
router.delete("/delete-lead/:id", deleteLead);

module.exports = router;
