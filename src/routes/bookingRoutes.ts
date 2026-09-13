import { Router } from "express";
import { createBooking } from "../controllers/bookingController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  createBooking
);

export default router;