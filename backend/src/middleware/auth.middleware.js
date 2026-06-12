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
    const PresenceModel = user.constructor.modelName === "Admin" ? Admin : User;
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    PresenceModel.updateOne(
      { _id: user._id, $or: [{ lastSeen: null }, { lastSeen: { $lt: oneMinuteAgo } }] },
      { $set: { lastSeen: new Date() } }
    ).catch(() => {});

    next();
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
