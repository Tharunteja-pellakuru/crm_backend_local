const express = require("express");
const router = express.Router();

const {
  getAllAiModels,
  createAiModel,
  updateAiModel,
  deleteAiModel,
} = require("../controllers/aiModelController");

const {
  analyzeEnquiry,
  batchAnalyzeEnquiries,
} = require("../controllers/aiAnalysisController");

const { authenticateToken } = require("../middleware/authMiddleware");

// AI Models routes
router.get("/ai-models", authenticateToken, getAllAiModels);
router.post("/ai-models", authenticateToken, createAiModel);
router.put("/ai-models/:id", authenticateToken, updateAiModel);
router.delete("/ai-models/:id", authenticateToken, deleteAiModel);

// AI Analysis routes
router.post("/ai/analyze-enquiry", authenticateToken, analyzeEnquiry);
router.post("/ai/batch-analyze", authenticateToken, batchAnalyzeEnquiries);

module.exports = router;
