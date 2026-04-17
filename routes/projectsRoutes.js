const express = require("express");
const router = express.Router();
const { uploadPdf, handleMulterError } = require("../middleware/upload");

const { createProject, getProjects, updateProject, updateProjectStatus, deleteProject } = require("../controllers/projectsController");

const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/add-project", authenticateToken, uploadPdf.single("scope_document"), handleMulterError, createProject);
router.get("/get-projects", authenticateToken, getProjects);
router.put("/update-project/:id", authenticateToken, uploadPdf.single("scope_document"), handleMulterError, updateProject);
router.put("/update-project-status/:id", authenticateToken, updateProjectStatus);
router.delete("/delete-project/:id", authenticateToken, deleteProject);

module.exports = router;
