import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import adminRoutes from "./routes/admin.route.js";
import authRoutes from "./routes/auth.route.js";
import bookingRoutes from "./routes/booking.routes.js";
import chatRoutes from "./routes/chat.route.js";
import schedule from "./routes/schedule.route.js";
import onboardingRoutes from "./routes/onboarding.route.js";
import pricingRoutes from "./routes/pricing.route.js";
import permitsRoutes from "./routes/permits.route.js";
import searchRoutes from "./routes/search.route.js";
import specialtyRoutes from "./routes/specialty.route.js";
import serviceRoutes from "./routes/service.route.js";
import userRoutes from "./routes/user.route.js";
import uploadRoutes from "./routes/upload.route.js";
import notificationRoutes from "./routes/notification.route.js";
import gcashRoutes from "./routes/gcashSetup.route.js";
import appReportRoutes from "./routes/appReport.route.js";
import appointmentFileRoutes from "./routes/appointmentFile.route.js";


import { errorMiddleware } from "./middleware/error.middleware.js";
import { sanitizeBody } from "./middleware/sanitize.middleware.js";
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
app.use(sanitizeBody);

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/doctor-schedule", schedule);
app.use("/api/permits", permitsRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/specialties", specialtyRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/gcash", gcashRoutes);
app.use("/api/app-reports", appReportRoutes);
app.use("/api/appointment-files", appointmentFileRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));
    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
    });
}

// Centralized error handler — must be last
app.use(errorMiddleware);

export { app, connectDB };