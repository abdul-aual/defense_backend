import type { Request, Response } from "express";
import { pool } from "../config/db.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";

export const createBooking = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const {
      vehicle_id,
      start_date,
      end_date,
      customer_phone,
    } = req.body;

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!vehicle_id || !start_date || !end_date) {
      return res.status(400).json({
        message: "Vehicle ID, start date and end date are required",
      });
    }

    if (end_date < start_date) {
      return res.status(400).json({
        message: "End date cannot be earlier than start date",
      });
    }

    let customerId: number;
    let bookedByType: "own" | "admin";
    let bookedByAdminId: number | null = null;

    // Customer নিজে booking করলে
    if (userRole !== "admin" && userRole !== "super admin") {
      customerId = userId;
      bookedByType = "own";
    }

    // Admin customer-এর জন্য booking করলে
    else {
      if (!customer_phone) {
        return res.status(400).json({
          message: "Customer phone is required for admin booking",
        });
      }

      const customerResult = await pool.query(
        `
        SELECT id
        FROM "Customer"
        WHERE phone = $1
        `,
        [customer_phone]
      );

      if (customerResult.rows.length === 0) {
        return res.status(404).json({
          message:
            "Customer not found. Please create a Customer account first.",
        });
      }

      customerId = customerResult.rows[0].id;
      bookedByType = "admin";
      bookedByAdminId = userId;
    }

    // Vehicle আছে কিনা check
    const vehicleResult = await pool.query(
      `
      SELECT
        id,
        vehicle_name,
        daily_rent_price,
        availability_status
      FROM "Vehicle"
      WHERE id = $1
      `,
      [vehicle_id]
    );

    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    const vehicle = vehicleResult.rows[0];

    // Maintenance vehicle book করা যাবে না
    if (vehicle.availability_status === "maintenance") {
      return res.status(400).json({
        message: "This vehicle is currently under maintenance",
      });
    }

    // Date overlap check
    const overlapResult = await pool.query(
      `
      SELECT id
      FROM "Booking"
      WHERE vehicle_id = $1
        AND status = 'Booked'
        AND start_date <= $3
        AND end_date >= $2
      LIMIT 1
      `,
      [
        vehicle_id,
        start_date,
        end_date,
      ]
    );

    if (overlapResult.rows.length > 0) {
      return res.status(409).json({
        message:
          "This vehicle is already booked for the selected date range",
      });
    }

    // Date difference + 1
    const start = new Date(start_date);
    const end = new Date(end_date);

    const timeDifference =
      end.getTime() - start.getTime();

    const numberOfDays =
      Math.floor(
        timeDifference / (1000 * 60 * 60 * 24)
      ) + 1;

    const dailyRentPrice = Number(
      vehicle.daily_rent_price
    );

    const totalRent =
      dailyRentPrice * numberOfDays;

    // Booking create
    const bookingResult = await pool.query(
      `
      INSERT INTO "Booking" (
        customer_id,
        vehicle_id,
        start_date,
        end_date,
        daily_rent_price,
        total_rent,
        status,
        booked_by_type,
        booked_by_admin_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'Booked',
        $7,
        $8
      )
      RETURNING
        id,
        customer_id,
        vehicle_id,
        start_date,
        end_date,
        daily_rent_price,
        total_rent,
        status,
        booked_by_type,
        booked_by_admin_id,
        created_at
      `,
      [
        customerId,
        vehicle_id,
        start_date,
        end_date,
        dailyRentPrice,
        totalRent,
        bookedByType,
        bookedByAdminId,
      ]
    );

    return res.status(201).json({
      message: "Booking created successfully",
      booking: bookingResult.rows[0],
    });
  } catch (error) {
    console.error("Create Booking Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};