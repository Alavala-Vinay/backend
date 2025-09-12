const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const jwtSign = promisify(jwt.sign);

const User = require("../models/User.js");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT (async + fast)
const generateToken = (userId) => {
  return jwtSign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Sanitize user object (safe fields only)
const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  profileImageUrl: user.profileImageUrl,
});

// =============================
// Google login/signup
// =============================
exports.googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    // ✅ Verify once against Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, picture } = ticket.getPayload();

    // ✅ Use lean() for faster lookup
    let user = await User.findOne({ email }).lean();

    if (!user) {
      user = await User.create({
        fullName: name,
        email,
        profileImageUrl: picture,
        password: Math.random().toString(36).slice(-8), // random temp password
      });
    }

    const jwtToken = await generateToken(user._id);

    res.json({
      success: true,
      message: "Google login successful",
      user: sanitizeUser(user),
      token: jwtToken,
    });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(401).json({ success: false, error: "Google authentication failed" });
  }
};

// =============================
// Register user
// =============================
exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, password, profileImageUrl } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, error: "Please fill in all fields" });
    }

    // ✅ Fast lookup with lean
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists" });
    }

    // ✅ Create user (argon2 hash handled in pre-save)
    const user = await User.create({ fullName, email, password, profileImageUrl });

    const jwtToken = await generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: sanitizeUser(user),
      token: jwtToken,
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// =============================
// Login user
// =============================
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Please fill in all fields" });
    }

    // ✅ Fetch with password explicitly
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }

    // ✅ Argon2 password verification
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }

    const jwtToken = await generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: sanitizeUser(user),
      token: jwtToken,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// =============================
// Get user info
// =============================
exports.getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("GetUserInfo Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// =============================
// Update user info
// =============================
exports.updateUserInfo = async (req, res) => {
  try {
    const { fullName, phone, profileImageUrl, currentPassword, newPassword } = req.body;

    if (currentPassword && newPassword) {
      const user = await User.findById(req.user.id).select("+password");
      if (!user) return res.status(404).json({ success: false, error: "User not found" });

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: "Current password incorrect" });
      }

      user.password = newPassword;
      if (fullName) user.fullName = fullName;
      if (phone) user.phone = phone;
      if (profileImageUrl) user.profileImageUrl = profileImageUrl;

      await user.save();

      return res.json({ success: true, message: "Password updated", user: sanitizeUser(user) });
    }

    // ✅ Partial update without password
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { fullName, phone, profileImageUrl },
      { new: true, runValidators: true, projection: "-password" }
    ).lean();

    res.json({ success: true, message: "User updated", user: updatedUser });
  } catch (err) {
    console.error("UpdateUserInfo Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
