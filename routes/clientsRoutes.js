const express = require("express");
const router = express.Router();
const { uploadPdf, handleMulterError } = require("../middleware/upload");

const { createClient, getClients, updateClient, convertLead, deleteClient } = require("../controllers/clientsController");

const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/add-client", authenticateToken, createClient);
router.post("/convert-lead", authenticateToken, uploadPdf.single("scope_document"), handleMulterError, convertLead);
router.get("/get-clients", authenticateToken, getClients);
router.put("/update-client/:id", authenticateToken, updateClient);
router.delete("/delete-client/:id", authenticateToken, deleteClient);

module.exports = router;
