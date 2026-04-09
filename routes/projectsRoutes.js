const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const { createProject, getProjects, updateProject, updateProjectStatus, deleteProject } = require("../controllers/projectsController");

// Multer configuration for file uploads
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

router.post("/add-project", authenticateToken, upload.single("scope_document"), createProject);
router.get("/get-projects", authenticateToken, getProjects);
router.put("/update-project/:id", authenticateToken, upload.single("scope_document"), updateProject);
router.put("/update-project-status/:id", authenticateToken, updateProjectStatus);
router.delete("/delete-project/:id", authenticateToken, deleteProject);

module.exports = router;
