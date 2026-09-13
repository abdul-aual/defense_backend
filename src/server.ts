import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import initDB from "./config/db.js";
import adminRoutes from "./routes/adminRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import vehicleRoutes from "./routes/vechicleRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/admin", adminRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/booking", bookingRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Defense Project Backend is Alive!");
});

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  await initDB();
});