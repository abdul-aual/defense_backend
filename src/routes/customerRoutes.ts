import { Router } from "express";
import {
  createCustomer,
  registerCustomer,
  customerLogin,
  getCustomerProfile,
  updateCustomerProfile
} from "../controllers/customerController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requireAdmin,
  createCustomer
);

router.post(
  "/register",
  registerCustomer
);

router.post(
  "/login",
  customerLogin
);

router.get(
  "/profile",
  authMiddleware,
  getCustomerProfile
);

router.patch(
  "/profile",
  authMiddleware,
  updateCustomerProfile
);

export default router;