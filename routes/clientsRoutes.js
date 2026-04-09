const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const { createClient, getClients, updateClient, convertLead } = require("../controllers/clientsController");

// Multer configuration for file uploads (PDF only)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `scope-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/add-client", authenticateToken, createClient);
router.post("/convert-lead", authenticateToken, upload.single("scope_document"), convertLead);
router.get("/get-clients", authenticateToken, getClients);
router.put("/update-client/:id", authenticateToken, updateClient);

module.exports = router;
