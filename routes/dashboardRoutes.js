const express = require('express');
const {protect} = require('../middleware/authMiddleware.js');
const {getDashboardData} = require('../controllers/dashboardController.js');
const dashboardRouter = express.Router();

dashboardRouter.get('/', protect, getDashboardData);

module.exports = dashboardRouter;