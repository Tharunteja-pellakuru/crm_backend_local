const express = require("express");
const router = express.Router();
const followupsController = require("../controllers/followupsController");

const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/add-followup", authenticateToken, followupsController.createNewFollowup);
router.get("/get-followups", authenticateToken, followupsController.getAllFollowups);
router.get("/client-followups/:clientId", authenticateToken, followupsController.getClientFollowups);
router.put("/update-followup/:id", authenticateToken, followupsController.updateFollowup);
router.delete("/delete-followup/:id", authenticateToken, followupsController.deleteFollowup);
router.put(
  "/toggle-followup-status/:id",
  authenticateToken,
  followupsController.toggleFollowupStatus,
);

module.exports = router;
