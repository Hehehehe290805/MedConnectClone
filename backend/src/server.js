import { app, connectDB } from "./app.js";
import { startCronJobs } from "./services/cronJobs.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Verify environment variables
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }
    if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
      throw new Error("Stream API configuration is missing");
    }

    // 1️⃣ Connect to MongoDB first
    await connectDB();
    console.log("✅ MongoDB connected");

    // 2️⃣ Start cron jobs after DB is ready
    startCronJobs();

    // 3️⃣ Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

startServer();