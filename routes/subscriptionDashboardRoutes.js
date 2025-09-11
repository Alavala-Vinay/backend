const express = require('express');
const SubscriptionDashboardRoutes = express.Router();
const { getSubscriptionDashboard } = require('../controllers/RecurringDashboardController');
const { protect } = require('../middleware/authMiddleware');

SubscriptionDashboardRoutes.get('/dashboard', protect, getSubscriptionDashboard);

module.exports = SubscriptionDashboardRoutes;
