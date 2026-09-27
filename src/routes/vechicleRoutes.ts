import { Router } from "express";

import {
  getAvailableVehicles,
  createVehicle,
  getAllVehicles,
} from "../controllers/vehicleController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/requireAdmin.js";

import {
  uploadVehicleImage,
} from "../middleware/uploadVehicle.js";

const router = Router();

router.get(
  "/available",
  getAvailableVehicles
);

// View all vehicles — both Super Admin and Normal Admin
router.get(
  "/",
  authMiddleware,
  requireAdmin,
  getAllVehicles
);

router.post(
  "/",
  authMiddleware,
  requireAdmin,
  uploadVehicleImage.single("image"),
  createVehicle
);

export default router;