const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const { JWT_SECRET, JWT_EXPIRATION } = process.env;

// Generate JWT

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Helper: pick safe user fields
const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  profileImageUrl: user.profileImageUrl,
});

// =============================
// Register a new user
// =============================
exports.registerUser = async (req, res) => {
  const { fullName, email, password, profileImageUrl } = req.body;

  try {
    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Please fill in all fields" });
    }

    // Check if user exists (lean for performance)
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "User already exists" });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password, // hashed in User model pre-save hook
      profileImageUrl,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: sanitizeUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// =============================
// Login a user
// =============================
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Please fill in all fields" });
    }

    // explicitly select password for comparison
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }

    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user: user.toJSON(), // safe JSON (password excluded)
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};


// =============================
// Get user information
// =============================
exports.getUserInfo = async (req, res) => {
  try {
    // Use lean() for performance, exclude password
    const user = await User.findById(req.user.id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "User info retrieved", user });
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
