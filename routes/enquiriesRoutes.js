const express = require("express");
const router = express.Router();
const { getEnquiries, addEnquiry, updateEnquiryStatus, deleteEnquiry } = require("../controllers/enquiriesController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.get("/get-enquiries", authenticateToken, getEnquiries);
router.post("/add-enquiry", authenticateToken, addEnquiry);
router.put("/update-enquiry-status/:id", authenticateToken, updateEnquiryStatus);
router.delete("/delete-enquiry/:id", authenticateToken, deleteEnquiry);

module.exports = router;
