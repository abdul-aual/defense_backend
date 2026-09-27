// import { Router } from "express";
// import {
//   createBooking,
//   cancelBooking,
//   completeBooking,
// } from "../controllers/bookingController.js";
// import authMiddleware from "../middleware/authMiddleware.js";

// const router = Router();

// router.post(
//   "/",
//   authMiddleware,
//   createBooking
// );

// router.patch(
//   "/:id/cancel",
//   authMiddleware,
//   cancelBooking
// );

// router.patch(
//   "/:id/complete",
//   authMiddleware,
//   completeBooking
// );

// export default router;

import { Router } from "express";

import {
  createBooking,
  getAllBookings,
  getMyBookings,
  getBookingsByCustomerPhone,
  cancelBooking,
  completeBooking,
} from "../controllers/bookingController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();

/* =========================================================
   CREATE BOOKING
   ---------------------------------------------------------
   Customer + Admin
   ========================================================= */

router.post(
  "/",
  authMiddleware,
  createBooking
);


/* =========================================================
   CUSTOMER BOOKINGS
   ---------------------------------------------------------
   Logged-in customer can view own bookings
   ========================================================= */

router.get(
  "/my-bookings",
  authMiddleware,
  getMyBookings
);


/* =========================================================
   ADMIN - VIEW ALL BOOKINGS
   ========================================================= */

router.get(
  "/",
  authMiddleware,
  requireAdmin,
  getAllBookings
);


/* =========================================================
   ADMIN - SEARCH CUSTOMER BOOKINGS BY PHONE
   ========================================================= */

router.get(
  "/customer/:phone",
  authMiddleware,
  requireAdmin,
  getBookingsByCustomerPhone
);


/* =========================================================
   CANCEL BOOKING
   ---------------------------------------------------------
   Customer → own booking
   Admin → any booking
   ========================================================= */

router.patch(
  "/:id/cancel",
  authMiddleware,
  cancelBooking
);


/* =========================================================
   COMPLETE BOOKING
   ---------------------------------------------------------
   Admin only
   ========================================================= */

router.patch(
  "/:id/complete",
  authMiddleware,
  completeBooking
);

export default router;