import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    let user = await User.findById(decoded.userId).select("-password");
    if (!user) {
        user = await Admin.findById(decoded.userId).select("-password");
      }
    if (!user) {
        return res.status(401).json({ message: "Unauthorized - User not found" });
      }

    req.user = user;

    // Update lastSeen non-fatally for regular users (not admins — Admin model is separate)
    if (user.constructor.modelName !== "Admin") {
        User.findByIdAndUpdate(user._id, { lastSeen: new Date() }).catch(() => {});
    }

    next();
  } catch (error) {
    console.log("Error in protectRoute middleware", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};