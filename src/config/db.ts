import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

const initDB = async () => {
  try {
    // Check PostgreSQL connection
    await pool.query("SELECT 1");

    console.log("✅ PostgreSQL Connected Successfully!");

    // =========================
    // CREATE ALL ENUMS
    // =========================

    await pool.query(`
      DO $$
      BEGIN

        -- Admin Role ENUM
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'admin_role'
        ) THEN
          CREATE TYPE admin_role AS ENUM (
            'admin',
            'super admin'
          );
        END IF;

        -- Admin Status ENUM
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'admin_status'
        ) THEN
          CREATE TYPE admin_status AS ENUM (
            'active',
            'disabled'
          );
        END IF;

        -- Vehicle Type ENUM
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'vehicle_type'
        ) THEN
          CREATE TYPE vehicle_type AS ENUM (
            'car',
            'SUV',
            'motorcycle',
            'HiAce'
          );
        END IF;

        -- Vehicle Availability ENUM
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'vehicle_availability'
        ) THEN
          CREATE TYPE vehicle_availability AS ENUM (
            'available',
            'booked',
            'maintenance'
          );
        END IF;

        -- Booking Status ENUM
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'booking_status'
        ) THEN
          CREATE TYPE booking_status AS ENUM (
            'Booked',
            'Cancelled',
            'Completed'
          );
        END IF;

      END
      $$;
    `);

    // =========================
    // CREATE ADMIN TABLE
    // =========================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Admin" (
        id SERIAL PRIMARY KEY,

        name VARCHAR(100) NOT NULL,

        password VARCHAR(255) NOT NULL,

        phone VARCHAR(20) NOT NULL UNIQUE
          CHECK (phone ~ '^01[0-9]{9}$'),

        role admin_role NOT NULL,

        status admin_status NOT NULL DEFAULT 'active',

        disabled_by INTEGER REFERENCES "Admin"(id),

        disabled_at TIMESTAMP
      );
    `);

    console.log("✅ Admin table ready!");

    // =========================
    // CREATE CUSTOMER TABLE
    // =========================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Customer" (
        id SERIAL PRIMARY KEY,

        name VARCHAR(100) NOT NULL,

        email VARCHAR(255) UNIQUE,

        password VARCHAR(255) NOT NULL,

        phone VARCHAR(20) NOT NULL UNIQUE
          CHECK (phone ~ '^01[0-9]{9}$'),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Customer table ready!");

    // =========================
    // CREATE VEHICLE TABLE
    // =========================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Vehicle" (
        id SERIAL PRIMARY KEY,

        vehicle_name VARCHAR(100) NOT NULL,

        type vehicle_type NOT NULL,

        registration_number VARCHAR(30) NOT NULL UNIQUE,

        daily_rent_price NUMERIC(10,2) NOT NULL
          CHECK (daily_rent_price > 0),

        city VARCHAR(50) NOT NULL
          CHECK (city IN ('Dhaka', 'Rangpur', 'Chattogram')),

        availability_status vehicle_availability NOT NULL
          DEFAULT 'available',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Vehicle table ready!");

    // =========================
    // CREATE BOOKING TABLE
    // =========================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Booking" (
        id SERIAL PRIMARY KEY,

        customer_id INTEGER NOT NULL
          REFERENCES "Customer"(id),

        vehicle_id INTEGER NOT NULL
          REFERENCES "Vehicle"(id),

        start_date DATE NOT NULL,

        end_date DATE NOT NULL
          CHECK (end_date >= start_date),

        daily_rent_price NUMERIC(10,2) NOT NULL
          CHECK (daily_rent_price > 0),

        total_rent NUMERIC(10,2) NOT NULL
          CHECK (total_rent > 0),

        status booking_status NOT NULL
          DEFAULT 'Booked',

        booked_by_type VARCHAR(10) NOT NULL
          CHECK (booked_by_type IN ('own', 'admin')),

        booked_by_admin_id INTEGER
          REFERENCES "Admin"(id),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CHECK (
          (booked_by_type = 'own' AND booked_by_admin_id IS NULL)
          OR
          (booked_by_type = 'admin' AND booked_by_admin_id IS NOT NULL)
        )
      );
    `);

    console.log("✅ Booking table ready!");

  } catch (err: any) {
    console.error("❌ Database Error:", err.message);
  }
};

export default initDB;