const express = require("express");
const router = express.Router();
const followupsController = require("../controllers/followupsController");

router.post("/add-followup", followupsController.createNewFollowup);
router.get("/get-followups", followupsController.getAllFollowups);
router.get("/client-followups/:clientId", followupsController.getClientFollowups);
router.put("/update-followup/:id", followupsController.updateFollowup);
router.delete("/delete-followup/:id", followupsController.deleteFollowup);
router.put(
  "/toggle-followup-status/:id",
  followupsController.toggleFollowupStatus,
);

module.exports = router;
