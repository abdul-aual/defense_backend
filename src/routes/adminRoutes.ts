import { Router } from "express";

import {
  adminLogin,
  getAdmins,
  createAdmin,
  changePassword,
  updateOwnProfile,
  toggleAdminStatus,
  getDashboardStats
} from "../controllers/adminController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import requireSuperAdmin from "../middleware/roleMiddleware.js";

const router = Router();

router.post("/login", adminLogin);

router.get(
  "/",
  authMiddleware,
  requireSuperAdmin,
  getAdmins
);

router.post(
  "/",
  authMiddleware,
  requireSuperAdmin,
  createAdmin
);

router.patch(
  "/change-password",
  authMiddleware,
  changePassword
);

router.patch(
  "/profile",
  authMiddleware,
  updateOwnProfile
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireSuperAdmin,
  toggleAdminStatus
);

// Dashboard Statistics
router.get(
  "/dashboard/stats",
  authMiddleware,
  getDashboardStats
);

export default router;