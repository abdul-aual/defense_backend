import type { Request, Response } from "express";
import { pool } from "../config/db.js";

/* =========================================================
   CREATE VEHICLE
   ========================================================= */

export const createVehicle = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      vehicle_name,
      type,
      registration_number,
      ac_type,
      total_seats,
      fuel_type,
      suitcase_capacity,
      daily_rent_price,
      city,
    } = req.body;

    // Image is mandatory
    if (!req.file) {
      return res.status(400).json({
        message: "Vehicle image is required",
      });
    }

    // Required field validation
    if (
      !vehicle_name ||
      !type ||
      !registration_number ||
      !ac_type ||
      !total_seats ||
      !fuel_type ||
      suitcase_capacity === undefined ||
      !daily_rent_price ||
      !city
    ) {
      return res.status(400).json({
        message:
          "Vehicle name, type, registration number, AC type, total seats, fuel type, suitcase capacity, daily rent price and city are required",
      });
    }

    // Validate vehicle type
    if (!["car", "SUV", "HiAce"].includes(type)) {
      return res.status(400).json({
        message: "Invalid vehicle type",
      });
    }

    // Validate AC type
    if (!["AC", "Non-AC"].includes(ac_type)) {
      return res.status(400).json({
        message: "Invalid AC type",
      });
    }

    // Validate fuel type
    if (!["Petrol", "Diesel", "CNG", "Electric"].includes(fuel_type)) {
      return res.status(400).json({
        message: "Invalid fuel type",
      });
    }

    // Validate city
    if (!["Dhaka", "Rangpur", "Chattogram"].includes(city)) {
      return res.status(400).json({
        message: "Invalid city",
      });
    }

    // Check duplicate registration number
    const existingVehicle = await pool.query(
      `
      SELECT id
      FROM "Vehicle"
      WHERE registration_number = $1
      `,
      [registration_number]
    );

    if (existingVehicle.rows.length > 0) {
      return res.status(409).json({
        message: "This registration number is already registered",
      });
    }

    const image = `/uploads/vehicles/${req.file.filename}`;

    // Insert vehicle
    const result = await pool.query(
      `
      INSERT INTO "Vehicle" (
        vehicle_name,
        type,
        registration_number,
        ac_type,
        total_seats,
        fuel_type,
        suitcase_capacity,
        daily_rent_price,
        city,
        availability_status,
        image
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
        $9,
        'available',
        $10
      )
      RETURNING
        id,
        vehicle_name,
        type,
        registration_number,
        ac_type,
        total_seats,
        fuel_type,
        suitcase_capacity,
        daily_rent_price,
        city,
        availability_status,
        image,
        created_at
      `,
      [
        vehicle_name,
        type,
        registration_number,
        ac_type,
        total_seats,
        fuel_type,
        suitcase_capacity,
        daily_rent_price,
        city,
        image,
      ]
    );

    return res.status(201).json({
      message: "Vehicle added successfully",
      vehicle: result.rows[0],
    });
  } catch (error) {
    console.error("Create Vehicle Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


/* =========================================================
   GET AVAILABLE VEHICLES
   ---------------------------------------------------------
   Customer/Admin booking vehicle search.

   A maintenance vehicle must NEVER appear here.

   Availability is determined by the requested date range
   for normal vehicles.

   Maintenance vehicles are always excluded.
   ========================================================= */

export const getAvailableVehicles = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      start_date,
      end_date,
      type,
      city,
    } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        message: "Start date and end date are required",
      });
    }

    const startDate = String(start_date);
    const endDate = String(end_date);

    if (endDate < startDate) {
      return res.status(400).json({
        message: "End date cannot be earlier than start date",
      });
    }

    /*
      Optional filters:
      type = car / SUV / HiAce
      city = Dhaka / Rangpur / Chattogram
    */

    const queryParams: string[] = [startDate, endDate];

    let filterQuery = "";

    if (type) {
      if (!["car", "SUV", "HiAce"].includes(String(type))) {
        return res.status(400).json({
          message: "Invalid vehicle type",
        });
      }

      queryParams.push(String(type));
      filterQuery += ` AND v.type = $${queryParams.length}`;
    }

    if (city) {
      if (!["Dhaka", "Rangpur", "Chattogram"].includes(String(city))) {
        return res.status(400).json({
          message: "Invalid city",
        });
      }

      queryParams.push(String(city));
      filterQuery += ` AND v.city = $${queryParams.length}`;
    }

    const result = await pool.query(
      `
      SELECT
        v.id,
        v.vehicle_name,
        v.type,
        v.registration_number,
        v.ac_type,
        v.total_seats,
        v.fuel_type,
        v.suitcase_capacity,
        v.daily_rent_price,
        v.city,
        v.availability_status,
        v.image,
        v.created_at

      FROM "Vehicle" v

      WHERE v.availability_status != 'maintenance'

      AND NOT EXISTS (
        SELECT 1
        FROM "Booking" b
        WHERE b.vehicle_id = v.id
          AND b.status = 'Booked'
          AND b.start_date <= $2
          AND b.end_date >= $1
      )

      ${filterQuery}

      ORDER BY v.id ASC
      `,
      queryParams
    );

    return res.status(200).json({
      message: "Available vehicles fetched successfully",
      vehicles: result.rows,
    });
  } catch (error) {
    console.error("Get Available Vehicles Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


/* =========================================================
   GET ALL VEHICLES
   ---------------------------------------------------------
   Admin only.

   Shows all vehicles including maintenance vehicles.

   Maintenance status must be preserved.
   ========================================================= */

export const getAllVehicles = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await pool.query(
      `
      SELECT
        v.id,
        v.vehicle_name,
        v.type,
        v.registration_number,
        v.ac_type,
        v.total_seats,
        v.fuel_type,
        v.suitcase_capacity,
        v.daily_rent_price,
        v.city,

        CASE

          WHEN v.availability_status = 'maintenance'
          THEN 'maintenance'

          WHEN EXISTS (
            SELECT 1
            FROM "Booking" b
            WHERE b.vehicle_id = v.id
              AND b.status = 'Booked'
              AND b.start_date <= (
                CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'
              )::date
              AND b.end_date >= (
                CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'
              )::date
          )
          THEN 'booked'

          ELSE 'available'

        END AS availability_status,

        v.created_at

      FROM "Vehicle" v

      ORDER BY v.id ASC
      `
    );

    return res.status(200).json({
      message: "All vehicles fetched successfully",
      vehicles: result.rows,
    });
  } catch (error) {
    console.error("Get All Vehicles Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


/* =========================================================
   SEARCH VEHICLE FOR MAINTENANCE
   ---------------------------------------------------------
   Admin searches vehicle using registration number.

   Rule:
   - Vehicle must exist.
   - If vehicle is already in maintenance → reject.
   - Check active Booked bookings within the next 10 days.
   - If booking exists → maintenance is not allowed.
   - If no booking exists → vehicle is eligible.
   ========================================================= */

export const searchVehicleForMaintenance = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { registration_number } = req.query;

    if (!registration_number) {
      return res.status(400).json({
        message: "Registration number is required",
      });
    }

    const registrationNumber = String(registration_number).trim();

    if (!registrationNumber) {
      return res.status(400).json({
        message: "Registration number is required",
      });
    }

    // Find vehicle
    const vehicleResult = await pool.query(
      `
      SELECT
        id,
        vehicle_name,
        type,
        registration_number,
        ac_type,
        total_seats,
        fuel_type,
        suitcase_capacity,
        daily_rent_price,
        city,
        availability_status,
        image,
        created_at
      FROM "Vehicle"
      WHERE registration_number = $1
      `,
      [registrationNumber]
    );

    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        message: "No vehicle found with this registration number",
      });
    }

    const vehicle = vehicleResult.rows[0];

    // Already under maintenance
    if (vehicle.availability_status === "maintenance") {
      return res.status(409).json({
        message: "This vehicle is already under maintenance",
        vehicle,
      });
    }

    /*
      Check active bookings from today
      up to the next 10 days.

      Example:
      Today = 27 Sep
      Check = 27 Sep through 7 Oct
    */

    const bookingResult = await pool.query(
      `
      SELECT
        id,
        start_date,
        end_date,
        pickup_point
      FROM "Booking"
      WHERE vehicle_id = $1
        AND status = 'Booked'
        AND start_date <= (
          (
            CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'
          )::date + INTERVAL '10 days'
        )
        AND end_date >= (
          CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'
        )::date
      ORDER BY start_date ASC
      LIMIT 1
      `,
      [vehicle.id]
    );

    // Active booking exists within next 10 days
    if (bookingResult.rows.length > 0) {
      const booking = bookingResult.rows[0];

      return res.status(409).json({
        message:
          "Maintenance is not available because this vehicle has an active booking within the next 10 days",
        vehicle,
        booking,
        maintenance_allowed: false,
      });
    }

    // No booking within next 10 days
    return res.status(200).json({
      message:
        "Vehicle is eligible for maintenance. No active booking was found within the next 10 days.",
      vehicle,
      maintenance_allowed: true,
    });
  } catch (error) {
    console.error("Search Vehicle For Maintenance Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


/* =========================================================
   SET VEHICLE TO MAINTENANCE
   ---------------------------------------------------------
   Admin sends a vehicle to maintenance.

   IMPORTANT:
   Booking is checked AGAIN here.

   This prevents:
   Admin searches vehicle
        ↓
   No booking found
        ↓
   Another booking is created
        ↓
   First admin tries maintenance

   The second booking check prevents the conflict.
   ========================================================= */

export const setVehicleMaintenance = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const client = await pool.connect();

  try {
    const { registration_number } = req.body;

    if (!registration_number) {
      return res.status(400).json({
        message: "Registration number is required",
      });
    }

    const registrationNumber = String(registration_number).trim();

    if (!registrationNumber) {
      return res.status(400).json({
        message: "Registration number is required",
      });
    }

    await client.query("BEGIN");

    // Lock the vehicle row
    const vehicleResult = await client.query(
      `
      SELECT
        id,
        vehicle_name,
        type,
        registration_number,
        ac_type,
        total_seats,
        fuel_type,
        suitcase_capacity,
        daily_rent_price,
        city,
        availability_status,
        image,
        created_at
      FROM "Vehicle"
      WHERE registration_number = $1
      FOR UPDATE
      `,
      [registrationNumber]
    );

    if (vehicleResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "No vehicle found with this registration number",
      });
    }

    const vehicle = vehicleResult.rows[0];

    // Already under maintenance
    if (vehicle.availability_status === "maintenance") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message: "This vehicle is already under maintenance",
        vehicle,
      });
    }

    /*
      IMPORTANT:
      Check active booking again before changing status.
    */

    const bookingResult = await client.query(
      `
      SELECT
        id,
        start_date,
        end_date,
        pickup_point
      FROM "Booking"
      WHERE vehicle_id = $1
        AND status = 'Booked'
        AND start_date <= (
          (
            CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'
          )::date + INTERVAL '10 days'
        )
        AND end_date >= (
          CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'
        )::date
      ORDER BY start_date ASC
      LIMIT 1
      `,
      [vehicle.id]
    );

    if (bookingResult.rows.length > 0) {
      const booking = bookingResult.rows[0];

      await client.query("ROLLBACK");

      return res.status(409).json({
        message:
          "Maintenance cannot be completed because this vehicle has an active booking within the next 10 days",
        vehicle,
        booking,
        maintenance_allowed: false,
      });
    }

    // Set vehicle status to maintenance
    const updateResult = await client.query(
      `
      UPDATE "Vehicle"
      SET availability_status = 'maintenance'
      WHERE id = $1
      RETURNING
        id,
        vehicle_name,
        type,
        registration_number,
        ac_type,
        total_seats,
        fuel_type,
        suitcase_capacity,
        daily_rent_price,
        city,
        availability_status,
        image,
        created_at
      `,
      [vehicle.id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Vehicle sent to maintenance successfully",
      vehicle: updateResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Set Vehicle Maintenance Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};