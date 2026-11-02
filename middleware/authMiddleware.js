const jwt = require("jsonwebtoken");
const User = require("../models/User.js");

exports.protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.trim().split(/\s+/, 2) ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return res.status(401).json({ message: "Not authorized: token missing" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured");
    return res.status(500).json({ message: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id;

    if (!userId) {
      return res.status(401).json({ message: "Not authorized: invalid token" });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Not authorized: user not found" });
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Not authorized: token invalid or expired" });
  }
};
