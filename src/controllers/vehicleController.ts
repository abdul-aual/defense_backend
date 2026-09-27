// import type { Request, Response } from "express";
// import { pool } from "../config/db.js";

// export const createVehicle = async (
//   req: Request,
//   res: Response
// ): Promise<Response> => {
//   try {
//     const {
//       vehicle_name,
//       type,
//       registration_number,
//       ac_type,
//       total_seats,
//       fuel_type,
//       suitcase_capacity,
//       daily_rent_price,
//       city,
//     } = req.body;

//     // Image is mandatory
//     if (!req.file) {
//       return res.status(400).json({
//         message: "Vehicle image is required",
//       });
//     }

//     const image = `/uploads/vehicles/${req.file.filename}`;

//     // Required field validation
//     if (
//       !vehicle_name ||
//       !type ||
//       !registration_number ||
//       !ac_type ||
//       !total_seats ||
//       !fuel_type ||
//       suitcase_capacity === undefined ||
//       !daily_rent_price ||
//       !city
//     ) {
//       return res.status(400).json({
//         message:
//           "Vehicle name, type, registration number, AC type, total seats, fuel type, suitcase capacity, daily rent price and city are required",
//       });
//     }

//     // Check duplicate registration number
//     const existingVehicle = await pool.query(
//       `
//       SELECT id
//       FROM "Vehicle"
//       WHERE registration_number = $1
//       `,
//       [registration_number]
//     );

//     if (existingVehicle.rows.length > 0) {
//       return res.status(409).json({
//         message: "This registration number is already registered",
//       });
//     }

//     // Insert vehicle
//     const result = await pool.query(
//       `
//       INSERT INTO "Vehicle" (
//         vehicle_name,
//         type,
//         registration_number,
//         ac_type,
//         total_seats,
//         fuel_type,
//         suitcase_capacity,
//         daily_rent_price,
//         city,
//         image
//       )
//       VALUES (
//         $1, $2, $3, $4, $5,
//         $6, $7, $8, $9, $10
//       )
//       RETURNING
//         id,
//         vehicle_name,
//         type,
//         registration_number,
//         ac_type,
//         total_seats,
//         fuel_type,
//         suitcase_capacity,
//         daily_rent_price,
//         city,
//         availability_status,
//         image,
//         created_at
//       `,
//       [
//         vehicle_name,
//         type,
//         registration_number,
//         ac_type,
//         total_seats,
//         fuel_type,
//         suitcase_capacity,
//         daily_rent_price,
//         city,
//         image,
//       ]
//     );

//     return res.status(201).json({
//       message: "Vehicle added successfully",
//       vehicle: result.rows[0],
//     });
//   } catch (error) {
//     console.error("Create Vehicle Error:", error);

//     return res.status(500).json({
//       message: "Internal server error",
//     });
//   }
// };

// export const getAvailableVehicles = async (
//   req: Request,
//   res: Response
// ): Promise<Response> => {
//   try {
//     const { start_date, end_date } = req.query;

//     if (!start_date || !end_date) {
//       return res.status(400).json({
//         message: "Start date and end date are required",
//       });
//     }

//     if (String(end_date) < String(start_date)) {
//       return res.status(400).json({
//         message: "End date cannot be earlier than start date",
//       });
//     }

//     const result = await pool.query(
//       `
//       SELECT
//         v.id,
//         v.vehicle_name,
//         v.type,
//         v.registration_number,
//         v.ac_type,
//         v.total_seats,
//         v.fuel_type,
//         v.suitcase_capacity,
//         v.daily_rent_price,
//         v.city,
//         v.availability_status,
//         v.image,
//         v.created_at

//       FROM "Vehicle" v

//       WHERE v.availability_status != 'maintenance'

//       AND NOT EXISTS (
//         SELECT 1
//         FROM "Booking" b
//         WHERE b.vehicle_id = v.id
//           AND b.status = 'Booked'
//           AND b.start_date <= $2
//           AND b.end_date >= $1
//       )

//       ORDER BY v.id ASC
//       `,
//       [start_date, end_date]
//     );

//     return res.status(200).json({
//       message: "Available vehicles fetched successfully",
//       vehicles: result.rows,
//     });
//   } catch (error) {
//     console.error("Get Available Vehicles Error:", error);

//     return res.status(500).json({
//       message: "Internal server error",
//     });
//   }
// };

// export const getAllVehicles = async (
//   req: Request,
//   res: Response
// ): Promise<Response> => {
//   try {
//     const result = await pool.query(
//       `
//       SELECT
//         id,
//         vehicle_name,
//         type,
//         registration_number,
//         ac_type,
//         total_seats,
//         fuel_type,
//         suitcase_capacity,
//         daily_rent_price,
//         city,
//         availability_status,
//         created_at
//       FROM "Vehicle"
//       ORDER BY id ASC
//       `
//     );

//     return res.status(200).json({
//       message: "All vehicles fetched successfully",
//       vehicles: result.rows,
//     });
//   } catch (error) {
//     console.error("Get All Vehicles Error:", error);

//     return res.status(500).json({
//       message: "Internal server error",
//     });
//   }
// };

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
   Customer vehicle search.

   Availability is determined by the requested date range,
   NOT by Vehicle.availability_status.

   Example:
   Existing booking: 15-17 Dec
   Search: 4-10 Dec
   → Vehicle is available

   Search: 15-17 Dec
   → Vehicle is not available
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

      WHERE NOT EXISTS (
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

   Shows all vehicles regardless of current booking status.
   Image is intentionally excluded.
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

