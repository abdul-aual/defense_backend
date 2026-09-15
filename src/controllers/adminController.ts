import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../config/db.js";
import { generateToken } from "../utils/jwt.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";


export const adminLogin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { phone, password } = req.body;

    // Check required fields
    if (!phone || !password) {
      return res.status(400).json({
        message: "Phone and password are required",
      });
    }

    // Find admin by phone
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        password,
        phone,
        role,
        status,
        disabled_by
      FROM "Admin"
      WHERE phone = $1
      `,
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid phone number or password",
      });
    }

    const admin = result.rows[0];

    // Check if account is disabled
    if (admin.status === "disabled") {
      let disabledByName = "Super Admin";

      if (admin.disabled_by) {
        const disabledByResult = await pool.query(
          `
          SELECT name
          FROM "Admin"
          WHERE id = $1
          `,
          [admin.disabled_by]
        );

        if (disabledByResult.rows.length > 0) {
          disabledByName = disabledByResult.rows[0].name;
        }
      }

      return res.status(403).json({
        message: `Your account is frozen by Super Admin ${disabledByName}.`,
      });
    }

    // Compare entered password with bcrypt hash
    const isPasswordCorrect = await bcrypt.compare(
      password,
      admin.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid phone number or password",
      });
    }

    // Generate JWT
    const token = generateToken({
      id: admin.id,
      name: admin.name,
      role: admin.role,
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getAdmins = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.name,
        a.phone,
        a.role,
        a.status,
        a.disabled_by,
        a.disabled_at,
        d.name AS disabled_by_name
      FROM "Admin" a
      LEFT JOIN "Admin" d
        ON a.disabled_by = d.id
      WHERE a.role = 'admin'
      ORDER BY a.id ASC
    `);

    return res.status(200).json({
      message: "Admin list fetched successfully",
      admins: result.rows,
    });
  } catch (error) {
    console.error("Get Admins Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const createAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message: "Name, phone and password are required",
      });
    }

    // Check phone in Admin table
    const adminPhoneCheck = await pool.query(
      `
      SELECT id
      FROM "Admin"
      WHERE phone = $1
      `,
      [phone]
    );

    if (adminPhoneCheck.rows.length > 0) {
      return res.status(409).json({
        message: "This phone number is already registered as an Admin",
      });
    }

    // Check phone in Customer table
    const customerPhoneCheck = await pool.query(
      `
      SELECT id
      FROM "Customer"
      WHERE phone = $1
      `,
      [phone]
    );

    if (customerPhoneCheck.rows.length > 0) {
      return res.status(409).json({
        message: "This phone number is already registered as a Customer",
      });
    }

    const defaultPassword = "1234";

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const result = await pool.query(
      `
      INSERT INTO "Admin"
      (name, password, phone, role, status)
      VALUES ($1, $2, $3, 'admin', 'active')
      RETURNING id, name, phone, role, status
      `,
      [name, hashedPassword, phone]
    );

    return res.status(201).json({
      message: "Admin created successfully",
      admin: result.rows[0],
      defaultPasswordMessage:
        "Your default password is 1234. Please change it after your first login."
    });
  } catch (error) {
    console.error("Create Admin Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const changePassword = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const result = await pool.query(
      `
      SELECT password
      FROM "Admin"
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      result.rows[0].password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE "Admin"
      SET password = $1
      WHERE id = $2
      `,
      [hashedPassword, req.user.id]
    );

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const updateOwnProfile = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const { name, phone } = req.body;

    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // At least one field must be provided
    if (!name && !phone) {
      return res.status(400).json({
        message: "At least name or phone is required",
      });
    }

    // If phone is being changed, check uniqueness
    if (phone) {
      const adminPhoneCheck = await pool.query(
        `
        SELECT id
        FROM "Admin"
        WHERE phone = $1
        AND id != $2
        `,
        [phone, req.user.id]
      );

      if (adminPhoneCheck.rows.length > 0) {
        return res.status(409).json({
          message: "This phone number is already registered as an Admin",
        });
      }

      const customerPhoneCheck = await pool.query(
        `
        SELECT id
        FROM "Customer"
        WHERE phone = $1
        `,
        [phone]
      );

      if (customerPhoneCheck.rows.length > 0) {
        return res.status(409).json({
          message: "This phone number is already registered as a Customer",
        });
      }
    }

    // Dynamic update
    const fields: string[] = [];
    const values: string[] = [];
    let parameterIndex = 1;

    if (name) {
      fields.push(`name = $${parameterIndex}`);
      values.push(name);
      parameterIndex++;
    }

    if (phone) {
      fields.push(`phone = $${parameterIndex}`);
      values.push(phone);
      parameterIndex++;
    }

    values.push(String(req.user.id));

    const result = await pool.query(
      `
      UPDATE "Admin"
      SET ${fields.join(", ")}
      WHERE id = $${parameterIndex}
      RETURNING id, name, phone, role, status
      `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      admin: result.rows[0],
    });
  } catch (error) {
    console.error("Update Own Profile Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const toggleAdminStatus = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const adminId = Number(id);

    if (Number.isNaN(adminId)) {
      return res.status(400).json({
        message: "Invalid admin ID",
      });
    }

    // Find target admin
    const adminResult = await pool.query(
      `
      SELECT id, name, role, status
      FROM "Admin"
      WHERE id = $1
      `,
      [adminId]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const targetAdmin = adminResult.rows[0];

    // Super Admin cannot disable/enable another Super Admin
    if (targetAdmin.role === "super admin") {
      return res.status(403).json({
        message: "Super Admin accounts cannot be disabled or enabled.",
      });
    }

    // Toggle status
    if (targetAdmin.status === "active") {
      const result = await pool.query(
        `
        UPDATE "Admin"
        SET status = 'disabled',
            disabled_by = $1,
            disabled_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, name, phone, role, status, disabled_by, disabled_at
        `,
        [req.user.id, adminId]
      );

      return res.status(200).json({
        message: "Admin disabled successfully",
        admin: result.rows[0],
      });
    }

    // Enable disabled admin
    const result = await pool.query(
      `
      UPDATE "Admin"
      SET status = 'active',
          disabled_by = NULL,
          disabled_at = NULL
      WHERE id = $1
      RETURNING id, name, phone, role, status, disabled_by, disabled_at
      `,
      [adminId]
    );

    return res.status(200).json({
      message: "Admin enabled successfully",
      admin: result.rows[0],
    });
  } catch (error) {
    console.error("Toggle Admin Status Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

