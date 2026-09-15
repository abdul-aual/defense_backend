import { Router } from "express";

import {
  createCustomer,
  registerCustomer,
  customerLogin,
  getCustomerProfile,
  updateCustomerProfile,
  getAllCustomers,
  getCustomerById,
} from "../controllers/customerController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();

// Admin can create a customer
router.post(
  "/",
  authMiddleware,
  requireAdmin,
  createCustomer
);

// Customer self-registration
router.post(
  "/register",
  registerCustomer
);

// Customer login
router.post(
  "/login",
  customerLogin
);

// Admin can view all customers
router.get(
  "/",
  authMiddleware,
  requireAdmin,
  getAllCustomers
);

// Logged-in customer can view own profile
router.get(
  "/profile",
  authMiddleware,
  getCustomerProfile
);

// Admin can view a specific customer's details
router.get(
  "/:id",
  authMiddleware,
  requireAdmin,
  getCustomerById
);

// Logged-in customer can update own profile
router.patch(
  "/profile",
  authMiddleware,
  updateCustomerProfile
);

export default router;