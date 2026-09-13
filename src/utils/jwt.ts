import jwt from "jsonwebtoken";

interface JwtPayload {
  id: number;
  name: string;
  role: string;
}

export const generateToken = (payload: JwtPayload): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined in .env");
  }

  return jwt.sign(payload, secret, {
    expiresIn: "1d",
  });
};