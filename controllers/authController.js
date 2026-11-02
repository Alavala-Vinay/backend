const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User.js");
const { OAuth2Client } = require("google-auth-library");

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new Promise((resolve, reject) => {
    jwt.sign(
      { id: userId.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
      (err, token) => {
        if (err) return reject(err);
        resolve(token);
      }
    );
  });
};

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  phone: user.phone || "",
  profileImageUrl: user.profileImageUrl || null,
});

// Google login/signup
exports.googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Google token is required",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error("GOOGLE_CLIENT_ID is not configured");
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();

    if (!email || !payload.email_verified) {
      return res.status(401).json({
        success: false,
        error: "Google account email is not verified",
      });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Generate a random password for accounts created through Google.
      const randomPassword = crypto.randomBytes(32).toString("hex");

      user = await User.create({
        fullName: payload.name || email,
        email,
        profileImageUrl: payload.picture || null,
        password: randomPassword,
      });
    }

    const jwtToken = await generateToken(user._id);

    return res.json({
      success: true,
      message: "Google login successful",
      user: sanitizeUser(user),
      token: jwtToken,
    });
  } catch (err) {
    console.error("Google Auth Error:", err);

    return res.status(401).json({
      success: false,
      error: "Google authentication failed",
    });
  }
};

// Signup
exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, password, profileImageUrl } = req.body;

    if (!fullName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        error: "Please fill in all required fields",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "User already exists",
      });
    }

    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password,
      profileImageUrl: profileImageUrl || null,
    });

    const token = await generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    console.error("Register Error:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "User already exists",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Signin
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const token = await generateToken(user._id);

    return res.json({
      success: true,
      message: "Login successful",
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    console.error("Login Error:", err);

    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

// Get signed-in user's information
exports.getUserInfo = async (req, res) => {
  try {
    // protect middleware has already loaded this user.
    return res.json({
      success: true,
      user: sanitizeUser(req.user),
    });
  } catch (err) {
    console.error("GetUserInfo Error:", err);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Update signed-in user's information
exports.updateUserInfo = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      profileImageUrl,
      currentPassword,
      newPassword,
    } = req.body;

    const wantsPasswordChange = Boolean(currentPassword || newPassword);

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "Enter both currentPassword and newPassword",
        });
      }

      const user = await User.findById(req.user._id).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const passwordMatches = await user.comparePassword(currentPassword);

      if (!passwordMatches) {
        return res.status(400).json({
          success: false,
          error: "Current password is incorrect",
        });
      }

      user.password = newPassword;

      if (fullName !== undefined) user.fullName = fullName;
      if (phone !== undefined) user.phone = phone;
      if (profileImageUrl !== undefined) {
        user.profileImageUrl = profileImageUrl;
      }

      await user.save();

      return res.json({
        success: true,
        message: "Password updated",
        user: sanitizeUser(user),
      });
    }

    const updates = {};

    if (fullName !== undefined) updates.fullName = fullName;
    if (phone !== undefined) updates.phone = phone;
    if (profileImageUrl !== undefined) {
      updates.profileImageUrl = profileImageUrl;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields provided to update",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "User updated",
      user: sanitizeUser(updatedUser),
    });
  } catch (err) {
    console.error("UpdateUserInfo Error:", err);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
