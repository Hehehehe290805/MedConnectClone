import User from "../models/User.js";
import jwt from "jsonwebtoken";

// ✅ Signup
export const signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered." });
    }

    // Create user with raw password (pre-save hook will hash it)
    const user = new User({
      email,
      password,
      role,
      isOnboarded: "notOnBoarded",
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(201).json({
      message: "Account created successfully",
      userId: user._id
    });

  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Use the model method for password comparison
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({
      message: "Login successful",
      role: user.role,
      userId: user._id,
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ Logout
export const logout = (req, res) => {
  res.clearCookie("jwt");
  res.status(200).json({ success: true, message: "Logout successful" });
};

// ✅ Get Current User
export const getMe = async (req, res) => {
  try {
    const userId = req.user?.id; // use id from authenticated JWT

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Return selected fields only
    const { firstName, lastName, email, role, profilePic } = req.user;

    return res.status(200).json({
      success: true,
      user: {
        id: userId,
        firstName,
        lastName,
        email,
        role,
        profilePic,
      },
    });
  } catch (error) {
    console.error("Get Current User Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// ✅ Delete Account
export const deleteMe = async (req, res) => {
  try {
    const userId = req.user?.id; // ID from authenticated JWT

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Delete the user directly
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Clear the JWT cookie
    res.clearCookie("jwt");

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete Account Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
