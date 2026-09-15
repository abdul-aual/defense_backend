import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/uploads/vehicles
const uploadDir = path.join(
  __dirname,
  "../../uploads/vehicles"
);

// Folder না থাকলে automatically create হবে
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const fileName = `vehicle-${Date.now()}-${Math.round(
      Math.random() * 1_000_000_000
    )}${extension}`;

    cb(null, fileName);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPG, PNG and WEBP images are allowed."
      )
    );
  }
};

export const uploadVehicleImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});