const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  getAllAdminUsers,
  createAdminUser,
  updateAdminUser,
  updatePassword,
  deleteAdminUser,
} = require("../controllers/adminUserController");

// Get all admin users (excluding logged-in user via query param)
router.get("/admin-users", getAllAdminUsers);

// Create new admin user
router.post("/admin-users", upload.single("image"), createAdminUser);

// Update admin user
router.post(
  "/admin-users/update/:uuid",
  upload.single("image"),
  updateAdminUser,
);

// Update password
router.post("/admin-users/update-password/:uuid", updatePassword);

// Delete admin user
router.delete("/admin-users/:uuid", deleteAdminUser);

module.exports = router;
