const express = require("express");
const router = express.Router();
const { getEnquiries, addEnquiry, updateEnquiryStatus, deleteEnquiry } = require("../controllers/enquiriesController");

router.get("/get-enquiries", getEnquiries);
router.post("/add-enquiry", addEnquiry);
router.put("/update-enquiry-status/:id", updateEnquiryStatus);
router.delete("/delete-enquiry/:id", deleteEnquiry);

module.exports = router;
