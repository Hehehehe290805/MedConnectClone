import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import adminRoutes from "./routes/admin.route.js";
import authRoutes from "./routes/auth.route.js";
import bookingRoutes from "./routes/booking.routes.js";
import chatRoutes from "./routes/chat.route.js";
import schedule from "./routes/schedule.route.js";
import gcashSetupRoutes from "./routes/gcashSetup.route.js";
import onboardingRoutes from "./routes/onboarding.route.js";
import pricingRoutes from "./routes/pricing.route.js";
import searchRoutes from "./routes/search.route.js";
import specialtyAndServiceRoutes from "./routes/specialtyAndService.route.js";
import userRoutes from "./routes/user.route.js";

import { connectDB } from "./lib/db.js";

const app = express();
const __dirname = path.resolve();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

// ✅ Mount all routes
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/doctor-schedule", schedule);
app.use("/api/gcash-setup", gcashSetupRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/specialties-and-services", specialtyAndServiceRoutes);
app.use("/api/users", userRoutes);

// ✅ Serve frontend only in production
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
    });
}

// ✅ Export app & DB connection for tests
export { app, connectDB };
