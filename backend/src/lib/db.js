import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    // One-time cleanup: drop stale friendrequests collection if it still exists
    const collections = await conn.connection.db.listCollections({ name: "friendrequests" }).toArray();
    if (collections.length > 0) {
      await conn.connection.db.dropCollection("friendrequests");
      console.log("[DB] Dropped stale friendrequests collection");
    }
  } catch (error) {
    console.log("Error in connecting to MongoDB", error);
    process.exit(1); // 1 means failure
  }
};