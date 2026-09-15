import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../config/db.js";
import { generateToken } from "../utils/jwt.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";

export const createCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message: "Name and phone are required",
      });
    }

    const existingCustomer = await pool.query(
      `
      SELECT id
      FROM "Customer"
      WHERE phone = $1
      `,
      [phone]
    );

    if (existingCustomer.rows.length > 0) {
      return res.status(409).json({
        message: "This phone number is already registered as a Customer",
      });
    }

    const existingAdmin = await pool.query(
      `
      SELECT id
      FROM "Admin"
      WHERE phone = $1
      `,
      [phone]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({
        message: "This phone number is already registered as an Admin",
      });
    }

    const defaultPassword = "1234";

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const result = await pool.query(
      `
      INSERT INTO "Customer" (
        name,
        phone,
        password
      )
      VALUES ($1, $2, $3)
      RETURNING id, name, email, phone, created_at
      `,
      [name, phone, hashedPassword]
    );

    return res.status(201).json({
      message: "Customer account created successfully",
      defaultPassword,
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Create Customer Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const registerCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { name, phone, password, email } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        message: "Name, phone and password are required",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        message: "Password must be at least 4 characters",
      });
    }

    const existingCustomer = await pool.query(
      `
      SELECT id
      FROM "Customer"
      WHERE phone = $1
      `,
      [phone]
    );

    if (existingCustomer.rows.length > 0) {
      return res.status(409).json({
        message: "This phone number is already registered",
      });
    }

    const existingAdmin = await pool.query(
      `
      SELECT id
      FROM "Admin"
      WHERE phone = $1
      `,
      [phone]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({
        message: "This phone number is already registered as an Admin",
      });
    }

    if (email) {
      const existingEmail = await pool.query(
        `
        SELECT id
        FROM "Customer"
        WHERE email = $1
        `,
        [email]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(409).json({
          message: "This email is already registered",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO "Customer" (
        name,
        email,
        phone,
        password
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, phone, created_at
      `,
      [name, email || null, phone, hashedPassword]
    );

    return res.status(201).json({
      message: "Customer account created successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Customer Registration Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};



export const customerLogin = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { phone, password } = req.body;
  
      if (!phone || !password) {
        return res.status(400).json({
          message: "Phone and password are required",
        });
      }
  
      const result = await pool.query(
        `
        SELECT id, name, phone, password
        FROM "Customer"
        WHERE phone = $1
        `,
        [phone]
      );
  
      if (result.rows.length === 0) {
        return res.status(401).json({
          message: "Invalid phone number or password",
        });
      }
  
      const customer = result.rows[0];
  
      const isPasswordCorrect = await bcrypt.compare(
        password,
        customer.password
      );
  
      if (!isPasswordCorrect) {
        return res.status(401).json({
          message: "Invalid phone number or password",
        });
      }


      const token = generateToken({
        id: customer.id,
        name: customer.name,
        role: "customer",
      });
  
      return res.status(200).json({
        message: "Customer login successful",
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
        },
      });
    } catch (error) {
      console.error("Customer Login Error:", error);
  
      return res.status(500).json({
        message: "Internal server error",
      });
    }
  };

  export const getCustomerProfile = async (
    req: AuthRequest,
    res: Response
  ): Promise<Response> => {
    try {
      const customerId = req.user?.id;
  
      if (!customerId) {
        return res.status(401).json({
          message: "Authentication required",
        });
      }
  
      const result = await pool.query(
        `
        SELECT id, name, email, phone, created_at
        FROM "Customer"
        WHERE id = $1
        `,
        [customerId]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }
  
      return res.status(200).json({
        customer: result.rows[0],
      });
    } catch (error) {
      console.error("Get Customer Profile Error:", error);
  
      return res.status(500).json({
        message: "Internal server error",
      });
    }
  };



  export const updateCustomerProfile = async (
    req: AuthRequest,
    res: Response
  ): Promise<Response> => {
    try {
      const customerId = req.user?.id;
  
      const {
        email,
        currentPassword,
        newPassword,
      } = req.body;
  
      if (!customerId) {
        return res.status(401).json({
          message: "Authentication required",
        });
      }
  
  
      /* ================= EMAIL ================= */
  
      const trimmedEmail =
        typeof email === "string"
          ? email.trim()
          : "";
  
  
      /* ================= PASSWORD ================= */
  
      const hasNewPassword =
        typeof newPassword === "string" &&
        newPassword.length > 0;
  
      const hasCurrentPassword =
        typeof currentPassword === "string" &&
        currentPassword.length > 0;
  
  
      /* ================= NOTHING TO UPDATE ================= */
  
      if (!trimmedEmail && !hasNewPassword) {
        return res.status(400).json({
          message: "Please enter something to update.",
        });
      }
  
  
      /* ================= EMAIL VALIDATION ================= */
  
      if (trimmedEmail) {
        const emailRegex =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
        if (!emailRegex.test(trimmedEmail)) {
          return res.status(400).json({
            message: "Please provide a valid email address.",
          });
        }
      }
  
  
      /* ================= PASSWORD VALIDATION ================= */
  
      if (hasNewPassword) {
  
        if (!hasCurrentPassword) {
          return res.status(400).json({
            message:
              "Old password is required to change password.",
          });
        }
  
        if (newPassword.length < 4) {
          return res.status(400).json({
            message:
              "New password must be at least 4 characters.",
          });
        }
      }
  
  
      /* ================= GET CUSTOMER ================= */
  
      const customerResult = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          phone,
          password,
          created_at
        FROM "Customer"
        WHERE id = $1
        `,
        [customerId]
      );
  
  
      if (customerResult.rows.length === 0) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }
  
  
      const customer =
        customerResult.rows[0];
  
  
      /* ================= EMAIL DUPLICATE CHECK ================= */
  
      if (trimmedEmail) {
  
        const existingEmail =
          await pool.query(
            `
            SELECT id
            FROM "Customer"
            WHERE email = $1
            AND id != $2
            `,
            [
              trimmedEmail,
              customerId,
            ]
          );
  
  
        if (existingEmail.rows.length > 0) {
          return res.status(409).json({
            message:
              "This email is already registered.",
          });
        }
      }
  
  
      /* ================= PASSWORD CHECK ================= */
  
      let hashedPassword =
        customer.password;
  
  
      if (hasNewPassword) {
  
        const isPasswordCorrect =
          await bcrypt.compare(
            currentPassword,
            customer.password
          );
  
  
        if (!isPasswordCorrect) {
          return res.status(401).json({
            message:
              "Old password doesn't match.",
          });
        }
  
  
        hashedPassword =
          await bcrypt.hash(
            newPassword,
            10
          );
      }
  
  
      /* ================= UPDATE ================= */
  
      const result = await pool.query(
        `
        UPDATE "Customer"
        SET
          email = CASE
            WHEN $1 = '' THEN email
            ELSE $1
          END,
          password = $2
        WHERE id = $3
        RETURNING
          id,
          name,
          email,
          phone,
          created_at
        `,
        [
          trimmedEmail,
          hashedPassword,
          customerId,
        ]
      );
  
  
      return res.status(200).json({
        message:
          "Customer profile updated successfully",
        customer: result.rows[0],
      });
  
    } catch (error) {
  
      console.error(
        "Update Customer Profile Error:",
        error
      );
  
      return res.status(500).json({
        message: "Internal server error",
      });
    }
  };






