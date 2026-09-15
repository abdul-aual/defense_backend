import { Router } from "express";

import {
  getAvailableVehicles,
  createVehicle,
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

router.post(
  "/",
  authMiddleware,
  requireAdmin,
  uploadVehicleImage.single("image"),
  createVehicle
);

export default router;