const express = require("express");
const dashboardRouter = express.Router();

const { protect } = require("../middleware/authMiddleware.js");
const { getDashboardData } = require("../controllers/dashboardController.js");

// --- Dashboard Route ---
dashboardRouter.get("/", protect, getDashboardData);

module.exports = dashboardRouter;
