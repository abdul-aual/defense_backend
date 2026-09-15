import { Router } from "express";
import {
  createBooking,
  cancelBooking,
  completeBooking,
} from "../controllers/bookingController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  createBooking
);

router.patch(
  "/:id/cancel",
  authMiddleware,
  cancelBooking
);

router.patch(
  "/:id/complete",
  authMiddleware,
  completeBooking
);

export default router;

