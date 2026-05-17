import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

const cookieOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
};

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });

export const signup = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return sendError(res, 400, "Email already registered.");

  const user = new User({ email, password, role, isOnboarded: "notOnBoarded" });
  await user.save();

  const token = generateToken(user._id);
  res.cookie("jwt", token, cookieOptions);

  return sendSuccess(res, 201, "Account created successfully", { userId: user._id });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return sendError(res, 404, "User not found.");

  const isPasswordValid = await user.matchPassword(password);
  if (!isPasswordValid) return sendError(res, 401, "Invalid credentials.");

  const token = generateToken(user._id);
  res.cookie("jwt", token, cookieOptions);

  return sendSuccess(res, 200, "Login successful", {
    role: user.role,
    userId: user._id,
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("jwt");
  return sendSuccess(res, 200, "Logout successful");
});

export const getMe = asyncHandler(async (req, res) => {
  const { _id: id, firstName, lastName, email, role, profilePic } = req.user;
  return sendSuccess(res, 200, "User fetched successfully", {
    id,
    firstName,
    lastName,
    email,
    role,
    profilePic,
  });
});

export const deleteMe = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, "Unauthorized");

  const deletedUser = await User.findByIdAndDelete(userId);
  if (!deletedUser) return sendError(res, 404, "User not found");

  res.clearCookie("jwt");
  return sendSuccess(res, 200, "Account deleted successfully");
});