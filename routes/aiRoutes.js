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

// AI Models routes
router.get("/ai-models", getAllAiModels);
router.post("/ai-models", createAiModel);
router.put("/ai-models/:id", updateAiModel);
router.delete("/ai-models/:id", deleteAiModel);

// AI Analysis routes
router.post("/ai/analyze-enquiry", analyzeEnquiry);
router.post("/ai/batch-analyze", batchAnalyzeEnquiries);

module.exports = router;
