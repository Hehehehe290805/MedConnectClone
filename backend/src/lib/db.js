import mongoose from "mongoose";
import Schedule from "../models/Schedule.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    // One-time cleanup: drop stale friendrequests collection if it still exists
    const collections = await conn.connection.db.listCollections({ name: "friendrequests" }).toArray();
    if (collections.length > 0) {
      await conn.connection.db.dropCollection("friendrequests");
    }
    await Schedule.syncIndexes();
  } catch (error) {
    console.error("[DB] Connection failed:", error.message);
    process.exit(1);
  }
};
