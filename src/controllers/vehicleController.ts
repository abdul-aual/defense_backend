import type { Request, Response } from "express";
import { pool } from "../config/db.js";

export const createVehicle = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const {
        vehicle_name,
        type,
        registration_number,
        daily_rent_price,
        city,
      } = req.body;
  
      if (
        !vehicle_name ||
        !type ||
        !registration_number ||
        !daily_rent_price ||
        !city
      ) {
        return res.status(400).json({
          message:
            "Vehicle name, type, registration number, daily rent price and city are required",
        });
      }
  
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
  
      const result = await pool.query(
        `
        INSERT INTO "Vehicle" (
          vehicle_name,
          type,
          registration_number,
          daily_rent_price,
          city
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          vehicle_name,
          type,
          registration_number,
          daily_rent_price,
          city,
          availability_status,
          created_at
        `,
        [
          vehicle_name,
          type,
          registration_number,
          daily_rent_price,
          city,
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

export const getAvailableVehicles = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        message: "Start date and end date are required",
      });
    }

    if (String(end_date) < String(start_date)) {
      return res.status(400).json({
        message: "End date cannot be earlier than start date",
      });
    }

    const result = await pool.query(
      `
      SELECT
        v.id,
        v.vehicle_name,
        v.type,
        v.registration_number,
        v.daily_rent_price,
        v.city,
        v.availability_status,
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

      ORDER BY v.id ASC
      `,
      [start_date, end_date]
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