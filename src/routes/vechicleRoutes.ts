import { Router } from "express";

import {
  getAvailableVehicles,
  createVehicle,
  getAllVehicles,
  searchVehicleForMaintenance,
  setVehicleMaintenance,
} from "../controllers/vehicleController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import requireAdmin from "../middleware/requireAdmin.js";

import {
  uploadVehicleImage,
} from "../middleware/uploadVehicle.js";

const router = Router();

// =========================================================
// GET AVAILABLE VEHICLES
// ---------------------------------------------------------
// Used for customer/admin booking.
// Maintenance vehicles are excluded in controller.
// =========================================================

router.get(
  "/available",
  getAvailableVehicles
);


// =========================================================
// MAINTENANCE - SEARCH VEHICLE
// ---------------------------------------------------------
// Search vehicle by registration number.
// Admin only.
// =========================================================

router.get(
  "/maintenance/check",
  authMiddleware,
  requireAdmin,
  searchVehicleForMaintenance
);


// =========================================================
// SEND VEHICLE TO MAINTENANCE
// ---------------------------------------------------------
// Admin only.
// Backend checks booking again before changing status.
// =========================================================

router.patch(
  "/maintenance",
  authMiddleware,
  requireAdmin,
  setVehicleMaintenance
);


// =========================================================
// VIEW ALL VEHICLES
// ---------------------------------------------------------
// Both Super Admin and Normal Admin.
// Maintenance vehicles are also visible here.
// =========================================================

router.get(
  "/",
  authMiddleware,
  requireAdmin,
  getAllVehicles
);


// =========================================================
// CREATE VEHICLE
// =========================================================

router.post(
  "/",
  authMiddleware,
  requireAdmin,
  uploadVehicleImage.single("image"),
  createVehicle
);

export default router;