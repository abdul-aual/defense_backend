import type { Response } from "express";
import bcrypt from "bcrypt";

import { pool } from "../config/db.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";


/* =========================================================
   HELPER: CHECK DATE FORMAT
   ========================================================= */

const isValidDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return parsedDate.toISOString().slice(0, 10) === date;
};


/* =========================================================
   HELPER: CALCULATE RENTAL DAYS
   ---------------------------------------------------------
   Example:
   15 Dec - 17 Dec = 3 days
   ========================================================= */

const calculateNumberOfDays = (
  startDate: string,
  endDate: string
): number => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  const difference =
    end.getTime() - start.getTime();

  return Math.floor(
    difference / (1000 * 60 * 60 * 24)
  ) + 1;
};


/* =========================================================
   HELPER: UPDATE VEHICLE CURRENT STATUS
   ---------------------------------------------------------
   Vehicle status represents TODAY'S availability.

   Rules:

   1. If vehicle is under maintenance:
        maintenance

   2. Else if there is a Booked booking covering today:
        booked

   3. Otherwise:
        available

   Important:
   A future booking does NOT make the vehicle currently booked.

   Important:
   Maintenance status is preserved.
   ========================================================= */

const syncVehicleCurrentStatus = async (
  client: any,
  vehicleId: number
): Promise<void> => {
  await client.query(
    `
    UPDATE "Vehicle" v
    SET availability_status =
      CASE

        WHEN v.availability_status = 'maintenance'::vehicle_availability
        THEN 'maintenance'::vehicle_availability

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
        THEN 'booked'::vehicle_availability

        ELSE 'available'::vehicle_availability

      END
    WHERE v.id = $1
    `,
    [vehicleId]
  );
};


/* =========================================================
   CREATE BOOKING
   ---------------------------------------------------------
   Customer:
      - Must be logged in
      - Booking belongs to logged-in customer

   Admin:
      - customer_phone required
      - Existing customer is used if phone exists
      - New customer is created with password 1234

   Maintenance:
      - Vehicle cannot be booked by customer or admin.
   ========================================================= */

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
      customer_name,
    } = req.body;

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    /* -----------------------------------------------------
       BASIC VALIDATION
       ----------------------------------------------------- */

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

    const startDate = String(start_date);
    const endDate = String(end_date);

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        message:
          "Invalid date format. Date must be in YYYY-MM-DD format",
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        message:
          "End date cannot be earlier than start date",
      });
    }

    if (
      !["Dhaka", "Rangpur", "Chattogram"].includes(
        String(city)
      )
    ) {
      return res.status(400).json({
        message: "Invalid city",
      });
    }

    const vehicleId = Number(vehicle_id);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return res.status(400).json({
        message: "Invalid vehicle ID",
      });
    }


    /* -----------------------------------------------------
       DETERMINE CUSTOMER
       ----------------------------------------------------- */

    let customerId: number;
    let bookedByType: "own" | "admin";
    let bookedByAdminId: number | null = null;

    const isAdmin =
      userRole === "admin" ||
      userRole === "super admin";


    /* =====================================================
       CUSTOMER BOOKING
       ===================================================== */

    if (!isAdmin) {
      if (userRole !== "customer") {
        return res.status(403).json({
          message: "Only customers can create their own bookings",
        });
      }

      customerId = userId;
      bookedByType = "own";
    }


    /* =====================================================
       ADMIN BOOKING
       ===================================================== */

    else {
      if (!customer_phone) {
        return res.status(400).json({
          message:
            "Customer phone is required for admin booking",
        });
      }

      const phone = String(customer_phone).trim();

      if (!/^01[0-9]{9}$/.test(phone)) {
        return res.status(400).json({
          message:
            "Invalid customer phone number",
        });
      }

      await client.query("BEGIN");


      /* ---------------------------------------------------
         FIND EXISTING CUSTOMER
         --------------------------------------------------- */

      const existingCustomerResult =
        await client.query(
          `
          SELECT
            id,
            name,
            phone
          FROM "Customer"
          WHERE phone = $1
          `,
          [phone]
        );


      if (existingCustomerResult.rows.length > 0) {
        customerId =
          existingCustomerResult.rows[0].id;
      }


      /* ---------------------------------------------------
         CREATE NEW CUSTOMER
         --------------------------------------------------- */

      else {
        if (!customer_name) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            message:
              "Customer name is required when creating a new customer",
          });
        }


        /* Check whether phone belongs to an Admin */

        const adminPhoneResult =
          await client.query(
            `
            SELECT id
            FROM "Admin"
            WHERE phone = $1
            `,
            [phone]
          );

        if (adminPhoneResult.rows.length > 0) {
          await client.query("ROLLBACK");

          return res.status(409).json({
            message:
              "This phone number is already registered as an admin",
          });
        }


        /* Default password */

        const hashedPassword =
          await bcrypt.hash("1234", 10);


        const newCustomerResult =
          await client.query(
            `
            INSERT INTO "Customer" (
              name,
              phone,
              password
            )
            VALUES (
              $1,
              $2,
              $3
            )
            RETURNING
              id,
              name,
              phone
            `,
            [
              String(customer_name).trim(),
              phone,
              hashedPassword,
            ]
          );

        customerId =
          newCustomerResult.rows[0].id;
      }

      bookedByType = "admin";
      bookedByAdminId = userId;
    }


    /* -----------------------------------------------------
       FOR CUSTOMER BOOKING START TRANSACTION
       ----------------------------------------------------- */

    if (!isAdmin) {
      await client.query("BEGIN");
    }


    /* =====================================================
       GET VEHICLE
       ===================================================== */

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
      [vehicleId]
    );

    if (vehicleResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    const vehicle = vehicleResult.rows[0];


    /* =====================================================
       MAINTENANCE CHECK
       -----------------------------------------------------
       A vehicle under maintenance cannot be booked by:

          - Customer
          - Admin
          - Super Admin
       ===================================================== */

    if (vehicle.availability_status === "maintenance") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message:
          "This vehicle is currently under maintenance and cannot be booked",
      });
    }


    /* =====================================================
       CITY CHECK
       ===================================================== */

    if (vehicle.city !== city) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message:
          "Selected city does not match the city of the selected vehicle",
      });
    }


    /* =====================================================
       CHECK DATE-RANGE OVERLAP
       -----------------------------------------------------
       Existing:
          15-17

       New:
          16-18

       Overlap → reject

       Existing:
          15-17

       New:
          18-20

       No overlap → allow
       ===================================================== */

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
      [
        vehicleId,
        startDate,
        endDate,
      ]
    );

    if (overlapResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message:
          "This vehicle is already booked for the selected date range",
      });
    }


    /* =====================================================
       CALCULATE RENT
       ===================================================== */

    const numberOfDays =
      calculateNumberOfDays(
        startDate,
        endDate
      );

    const dailyRentPrice =
      Number(vehicle.daily_rent_price);

    const totalRent =
      dailyRentPrice * numberOfDays;


    /* =====================================================
       INSERT BOOKING
       ===================================================== */

    const bookingResult =
      await client.query(
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
          vehicleId,
          city,
          pickup_point,
          startDate,
          endDate,
          dailyRentPrice,
          totalRent,
          bookedByType,
          bookedByAdminId,
        ]
      );


    /* =====================================================
       UPDATE CURRENT VEHICLE STATUS
       -----------------------------------------------------
       Important:
       If booking is in the future, vehicle stays available.

       If booking includes today, vehicle becomes booked.

       If vehicle is under maintenance, maintenance is
       preserved.
       ===================================================== */

    await syncVehicleCurrentStatus(
      client,
      vehicleId
    );


    await client.query("COMMIT");


    /* =====================================================
       RESPONSE
       ===================================================== */

    const responseData: any = {
      message: "Booking created successfully",
      booking: bookingResult.rows[0],
    };


    /*
      Inform admin when a new customer was created.
      We detect this by checking whether customer_name
      was supplied and admin booking was performed.
    */

    if (
      isAdmin &&
      customer_name &&
      customer_phone
    ) {
      const customerCheck =
        await pool.query(
          `
          SELECT
            id,
            name,
            phone
          FROM "Customer"
          WHERE id = $1
          `,
          [customerId]
        );

      if (customerCheck.rows.length > 0) {
        responseData.customer =
          customerCheck.rows[0];
      }
    }

    return res.status(201).json(
      responseData
    );

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback error
    }

    console.error(
      "Create Booking Error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
};


/* =========================================================
   GET ALL BOOKINGS
   ---------------------------------------------------------
   ADMIN ONLY

   Sorted by:
      start_date ASC
      id ASC
   ========================================================= */

export const getAllBookings = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const userRole = req.user?.role;

    const isAdmin =
      userRole === "admin" ||
      userRole === "super admin";

    if (!isAdmin) {
      return res.status(403).json({
        message:
          "Only admin can view all bookings",
      });
    }

    /*
      Automatically complete expired bookings
      before showing the list.
    */

    await autoCompleteBookings();


    const result = await pool.query(
      `
      SELECT
        b.id,

        b.customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,

        b.vehicle_id,
        v.vehicle_name,
        v.registration_number,
        v.type AS vehicle_type,

        b.city,
        b.pickup_point,
        b.start_date,
        b.end_date,
        b.daily_rent_price,
        b.total_rent,
        b.status,

        b.booked_by_type,
        b.booked_by_admin_id,

        a.name AS booked_by_admin_name,

        b.created_at

      FROM "Booking" b

      INNER JOIN "Customer" c
        ON c.id = b.customer_id

      INNER JOIN "Vehicle" v
        ON v.id = b.vehicle_id

      LEFT JOIN "Admin" a
        ON a.id = b.booked_by_admin_id

      ORDER BY
        b.start_date ASC,
        b.id ASC
      `
    );


    return res.status(200).json({
      message:
        "All bookings fetched successfully",
      bookings: result.rows,
    });

  } catch (error) {
    console.error(
      "Get All Bookings Error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


/* =========================================================
   GET MY BOOKINGS
   ---------------------------------------------------------
   CUSTOMER ONLY
   ========================================================= */

export const getMyBookings = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        message:
          "Authentication required",
      });
    }

    if (userRole !== "customer") {
      return res.status(403).json({
        message:
          "Only customers can view their own bookings",
      });
    }


    await autoCompleteBookings();


    const result = await pool.query(
      `
      SELECT
        b.id,

        b.customer_id,

        b.vehicle_id,
        v.vehicle_name,
        v.registration_number,
        v.type AS vehicle_type,

        b.city,
        b.pickup_point,
        b.start_date,
        b.end_date,
        b.daily_rent_price,
        b.total_rent,
        b.status,

        b.booked_by_type,
        b.created_at

      FROM "Booking" b

      INNER JOIN "Vehicle" v
        ON v.id = b.vehicle_id

      WHERE b.customer_id = $1

      ORDER BY
        b.start_date DESC,
        b.id DESC
      `,
      [userId]
    );


    return res.status(200).json({
      message:
        "Your bookings fetched successfully",
      bookings: result.rows,
    });

  } catch (error) {
    console.error(
      "Get My Bookings Error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


/* =========================================================
   GET BOOKINGS BY CUSTOMER PHONE
   ---------------------------------------------------------
   ADMIN ONLY

   Returns:
      Booked
      Cancelled
      Completed

   All history is included.
   ========================================================= */

export const getBookingsByCustomerPhone = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const userRole = req.user?.role;

    const isAdmin =
      userRole === "admin" ||
      userRole === "super admin";

    if (!isAdmin) {
      return res.status(403).json({
        message:
          "Only admin can search customer bookings",
      });
    }

    const phone = String(
      req.params.phone
    ).trim();

    if (!phone) {
      return res.status(400).json({
        message:
          "Customer phone is required",
      });
    }

    if (!/^01[0-9]{9}$/.test(phone)) {
      return res.status(400).json({
        message:
          "Invalid customer phone number",
      });
    }


    await autoCompleteBookings();


    const customerResult =
      await pool.query(
        `
        SELECT
          id,
          name,
          phone
        FROM "Customer"
        WHERE phone = $1
        `,
        [phone]
      );


    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        message:
          "Customer not found",
      });
    }


    const customer =
      customerResult.rows[0];


    const bookingResult =
      await pool.query(
        `
        SELECT
          b.id,

          b.customer_id,

          b.vehicle_id,
          v.vehicle_name,
          v.registration_number,
          v.type AS vehicle_type,

          b.city,
          b.pickup_point,
          b.start_date,
          b.end_date,
          b.daily_rent_price,
          b.total_rent,
          b.status,

          b.booked_by_type,
          b.booked_by_admin_id,

          a.name AS booked_by_admin_name,

          b.created_at

        FROM "Booking" b

        INNER JOIN "Vehicle" v
          ON v.id = b.vehicle_id

        LEFT JOIN "Admin" a
          ON a.id = b.booked_by_admin_id

        WHERE b.customer_id = $1

        ORDER BY
          b.start_date ASC,
          b.id ASC
        `,
        [customer.id]
      );


    return res.status(200).json({
      message:
        "Customer bookings fetched successfully",

      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      },

      bookings:
        bookingResult.rows,
    });

  } catch (error) {
    console.error(
      "Get Customer Bookings Error:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


/* =========================================================
   CANCEL BOOKING
   ---------------------------------------------------------
   CUSTOMER:
      Can cancel ONLY own Booked booking.

   ADMIN:
      Can cancel ANY Booked booking.
   ========================================================= */

export const cancelBooking = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const client = await pool.connect();

  try {
    const bookingId =
      Number(req.params.id);

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        message:
          "Authentication required",
      });
    }

    if (
      !Number.isInteger(bookingId) ||
      bookingId <= 0
    ) {
      return res.status(400).json({
        message:
          "Invalid booking ID",
      });
    }


    const isAdmin =
      userRole === "admin" ||
      userRole === "super admin";


    await client.query("BEGIN");


    const bookingResult =
      await client.query(
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
        message:
          "Booking not found",
      });
    }


    const booking =
      bookingResult.rows[0];


    /* -----------------------------------------------------
       CUSTOMER OWNERSHIP CHECK
       ----------------------------------------------------- */

    if (
      !isAdmin &&
      booking.customer_id !== userId
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        message:
          "You can only cancel your own booking",
      });
    }


    /* -----------------------------------------------------
       STATUS CHECK
       ----------------------------------------------------- */

    if (booking.status !== "Booked") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message:
          "Only active bookings can be cancelled",
      });
    }


    /* -----------------------------------------------------
       CANCEL BOOKING
       ----------------------------------------------------- */

    const updateBookingResult =
      await client.query(
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


    /* -----------------------------------------------------
       UPDATE VEHICLE CURRENT STATUS
       ----------------------------------------------------- */

    await syncVehicleCurrentStatus(
      client,
      booking.vehicle_id
    );


    await client.query("COMMIT");


    return res.status(200).json({
      message:
        "Booking cancelled successfully",
      booking:
        updateBookingResult.rows[0],
    });

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback error
    }

    console.error(
      "Cancel Booking Error:",
      error
    );

    return res.status(500).json({
      message:
        "Internal server error",
    });
  } finally {
    client.release();
  }
};


/* =========================================================
   COMPLETE BOOKING
   ---------------------------------------------------------
   ADMIN ONLY

   Customer cannot manually complete a booking.
   ========================================================= */

export const completeBooking = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const client = await pool.connect();

  try {
    const bookingId =
      Number(req.params.id);

    const userRole =
      req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        message:
          "Authentication required",
      });
    }


    const isAdmin =
      userRole === "admin" ||
      userRole === "super admin";

    if (!isAdmin) {
      return res.status(403).json({
        message:
          "Only admin can complete a booking",
      });
    }


    if (
      !Number.isInteger(bookingId) ||
      bookingId <= 0
    ) {
      return res.status(400).json({
        message:
          "Invalid booking ID",
      });
    }


    await client.query("BEGIN");


    const bookingResult =
      await client.query(
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
        message:
          "Booking not found",
      });
    }


    const booking =
      bookingResult.rows[0];


    if (booking.status !== "Booked") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message:
          "Only active bookings can be completed",
      });
    }


    /* -----------------------------------------------------
       COMPLETE BOOKING
       ----------------------------------------------------- */

    const updateBookingResult =
      await client.query(
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


    /* -----------------------------------------------------
       UPDATE VEHICLE CURRENT STATUS
       ----------------------------------------------------- */

    await syncVehicleCurrentStatus(
      client,
      booking.vehicle_id
    );


    await client.query("COMMIT");


    return res.status(200).json({
      message:
        "Booking completed successfully",
      booking:
        updateBookingResult.rows[0],
    });

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback error
    }

    console.error(
      "Complete Booking Error:",
      error
    );

    return res.status(500).json({
      message:
        "Internal server error",
    });
  } finally {
    client.release();
  }
};


/* =========================================================
   AUTO COMPLETE BOOKINGS
   ---------------------------------------------------------
   If:

      status = Booked
      AND end_date < TODAY (Bangladesh)

   Then:

      status = Completed

   Example:
      15 Dec - 17 Dec
      On 18 Dec → automatically Completed
   ========================================================= */

export const autoCompleteBookings =
  async (): Promise<void> => {
    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");


      /* ---------------------------------------------------
         AUTO COMPLETE EXPIRED BOOKINGS
         --------------------------------------------------- */

      const completedBookingsResult =
        await client.query(
          `
          UPDATE "Booking"
          SET status = 'Completed'

          WHERE status = 'Booked'

            AND end_date <
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'Asia/Dhaka'
              )::date

          RETURNING
            id,
            vehicle_id
          `
        );


      /* ---------------------------------------------------
         UPDATE VEHICLE STATUS
         FOR AFFECTED VEHICLES
         --------------------------------------------------- */

      const affectedVehicleIds =
        [
          ...new Set(
            completedBookingsResult.rows.map(
              (booking) =>
                booking.vehicle_id
            )
          ),
        ];


      for (
        const vehicleId
        of affectedVehicleIds
      ) {
        await syncVehicleCurrentStatus(
          client,
          vehicleId
        );
      }


      await client.query("COMMIT");


      if (
        completedBookingsResult.rows.length >
        0
      ) {
        console.log(
          `${completedBookingsResult.rows.length} booking(s) automatically completed`
        );
      }

    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback error
      }

      console.error(
        "Auto Complete Booking Error:",
        error
      );
    } finally {
      client.release();
    }
  };