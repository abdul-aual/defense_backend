import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./authMiddleware.js";

const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (req.user.role !== "super admin") {
    return res.status(403).json({
      message: "Access denied. Super Admin permission required.",
    });
  }

  next();
};

export default requireSuperAdmin;