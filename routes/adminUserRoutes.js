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

const { authenticateToken } = require("../middleware/authMiddleware");

// Get all admin users (excluding logged-in user via query param)
router.get("/admin-users", authenticateToken, getAllAdminUsers);

// Create new admin user
router.post("/admin-users", authenticateToken, upload.single("image"), createAdminUser);

// Update admin user
router.post(
  "/admin-users/update/:uuid",
  authenticateToken,
  upload.single("image"),
  updateAdminUser,
);

// Update password
router.post("/admin-users/update-password/:uuid", authenticateToken, updatePassword);

// Delete admin user
router.delete("/admin-users/:uuid", authenticateToken, deleteAdminUser);

module.exports = router;
