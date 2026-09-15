import type { Response } from "express";
import { pool } from "../config/db.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";

export const createBooking = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const client = await pool.connect();

  try {
    const {
      vehicle_id,
      city,
      pickup_point,
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

    if (
      !vehicle_id ||
      !city ||
      !pickup_point ||
      !start_date ||
      !end_date
    ) {
      return res.status(400).json({
        message:
          "Vehicle ID, city, pickup point, start date and end date are required",
      });
    }

    if (!["Dhaka", "Rangpur", "Chattogram"].includes(city)) {
      return res.status(400).json({
        message: "Invalid city",
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

    if (userRole !== "admin" && userRole !== "super admin") {
      customerId = userId;
      bookedByType = "own";
    } else {
      if (!customer_phone) {
        return res.status(400).json({
          message: "Customer phone is required for admin booking",
        });
      }

      const customerResult = await client.query(
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

    await client.query("BEGIN");

    const vehicleResult = await client.query(
      `
      SELECT
        id,
        vehicle_name,
        city,
        daily_rent_price,
        availability_status
      FROM "Vehicle"
      WHERE id = $1
      FOR UPDATE
      `,
      [vehicle_id]
    );

    if (vehicleResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    const vehicle = vehicleResult.rows[0];

    if (vehicle.city !== city) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message:
          "Selected city does not match the city of the selected vehicle",
      });
    }

    if (vehicle.availability_status === "maintenance") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "This vehicle is currently under maintenance",
      });
    }

    if (vehicle.availability_status !== "available") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message: "This vehicle is currently not available",
      });
    }

    const overlapResult = await client.query(
      `
      SELECT id
      FROM "Booking"
      WHERE vehicle_id = $1
        AND status = 'Booked'
        AND start_date <= $3
        AND end_date >= $2
      LIMIT 1
      `,
      [vehicle_id, start_date, end_date]
    );

    if (overlapResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message:
          "This vehicle is already booked for the selected date range",
      });
    }

    const start = new Date(`${start_date}T00:00:00+06:00`);
    const end = new Date(`${end_date}T00:00:00+06:00`);

    const timeDifference = end.getTime() - start.getTime();

    const numberOfDays =
      Math.floor(timeDifference / (1000 * 60 * 60 * 24)) + 1;

    const dailyRentPrice = Number(vehicle.daily_rent_price);
    const totalRent = dailyRentPrice * numberOfDays;

    const bookingResult = await client.query(
      `
      INSERT INTO "Booking" (
        customer_id,
        vehicle_id,
        city,
        pickup_point,
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
        $7,
        $8,
        'Booked',
        $9,
        $10
      )
      RETURNING
        id,
        customer_id,
        vehicle_id,
        city,
        pickup_point,
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
        city,
        pickup_point,
        start_date,
        end_date,
        dailyRentPrice,
        totalRent,
        bookedByType,
        bookedByAdminId,
      ]
    );

    await client.query(
      `
      UPDATE "Vehicle"
      SET availability_status = 'booked'
      WHERE id = $1
      `,
      [vehicle_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Booking created successfully",
      booking: bookingResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create Booking Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};

export const cancelBooking = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const client = await pool.connect();

  try {
    const bookingId = Number(req.params.id);

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!bookingId || Number.isNaN(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
      SELECT
        id,
        customer_id,
        vehicle_id,
        status
      FROM "Booking"
      WHERE id = $1
      FOR UPDATE
      `,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Booking not found",
      });
    }

    const booking = bookingResult.rows[0];

    const isAdmin =
      userRole === "admin" || userRole === "super admin";

    if (!isAdmin && booking.customer_id !== userId) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        message: "You can only cancel your own booking",
      });
    }

    if (booking.status !== "Booked") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Only active bookings can be cancelled",
      });
    }

    const updateBookingResult = await client.query(
      `
      UPDATE "Booking"
      SET status = 'Cancelled'
      WHERE id = $1
      RETURNING
        id,
        customer_id,
        vehicle_id,
        city,
        pickup_point,
        start_date,
        end_date,
        daily_rent_price,
        total_rent,
        status,
        booked_by_type,
        booked_by_admin_id,
        created_at
      `,
      [bookingId]
    );

    const activeBookingResult = await client.query(
      `
      SELECT id
      FROM "Booking"
      WHERE vehicle_id = $1
        AND status = 'Booked'
      LIMIT 1
      `,
      [booking.vehicle_id]
    );

    if (activeBookingResult.rows.length === 0) {
      await client.query(
        `
        UPDATE "Vehicle"
        SET availability_status = 'available'
        WHERE id = $1
          AND availability_status = 'booked'
        `,
        [booking.vehicle_id]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Booking cancelled successfully",
      booking: updateBookingResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Cancel Booking Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};

export const completeBooking = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const client = await pool.connect();

  try {
    const bookingId = Number(req.params.id);

    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const isAdmin =
      userRole === "admin" || userRole === "super admin";

    if (!isAdmin) {
      return res.status(403).json({
        message: "Only admin can complete a booking",
      });
    }

    if (!bookingId || Number.isNaN(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    await client.query("BEGIN");

    const bookingResult = await client.query(
      `
      SELECT
        id,
        customer_id,
        vehicle_id,
        status
      FROM "Booking"
      WHERE id = $1
      FOR UPDATE
      `,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Booking not found",
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== "Booked") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Only active bookings can be completed",
      });
    }

    const updateBookingResult = await client.query(
      `
      UPDATE "Booking"
      SET status = 'Completed'
      WHERE id = $1
      RETURNING
        id,
        customer_id,
        vehicle_id,
        city,
        pickup_point,
        start_date,
        end_date,
        daily_rent_price,
        total_rent,
        status,
        booked_by_type,
        booked_by_admin_id,
        created_at
      `,
      [bookingId]
    );

    const activeBookingResult = await client.query(
      `
      SELECT id
      FROM "Booking"
      WHERE vehicle_id = $1
        AND status = 'Booked'
      LIMIT 1
      `,
      [booking.vehicle_id]
    );

    if (activeBookingResult.rows.length === 0) {
      await client.query(
        `
        UPDATE "Vehicle"
        SET availability_status = 'available'
        WHERE id = $1
          AND availability_status = 'booked'
        `,
        [booking.vehicle_id]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Booking completed successfully",
      booking: updateBookingResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Complete Booking Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};

export const autoCompleteBookings = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const completedBookingsResult = await client.query(
      `
      UPDATE "Booking"
      SET status = 'Completed'
      WHERE status = 'Booked'
        AND end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date
      RETURNING id, vehicle_id
      `
    );

    for (const booking of completedBookingsResult.rows) {
      const activeBookingResult = await client.query(
        `
        SELECT id
        FROM "Booking"
        WHERE vehicle_id = $1
          AND status = 'Booked'
        LIMIT 1
        `,
        [booking.vehicle_id]
      );

      if (activeBookingResult.rows.length === 0) {
        await client.query(
          `
          UPDATE "Vehicle"
          SET availability_status = 'available'
          WHERE id = $1
            AND availability_status = 'booked'
          `,
          [booking.vehicle_id]
        );
      }
    }

    await client.query("COMMIT");

    if (completedBookingsResult.rows.length > 0) {
      console.log(
        `${completedBookingsResult.rows.length} booking(s) automatically completed`
      );
    }
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Auto Complete Booking Error:", error);
  } finally {
    client.release();
  }
};
