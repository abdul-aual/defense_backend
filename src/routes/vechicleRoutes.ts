import { Router } from "express";
import {
  getAvailableVehicles,
  createVehicle,
} from "../controllers/vehicleController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();

router.get(
  "/available",
  getAvailableVehicles
);

router.post(
  "/",
  authMiddleware,
  requireAdmin,
  createVehicle
);

export default router;