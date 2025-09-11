const express = require('express');
const recurringPaymentRoutes = express.Router();
const controller = require('../controllers/RecurringPaymentController');
const { protect } = require('../middleware/authMiddleware');

// Create
recurringPaymentRoutes.post('/', protect, controller.addRecurringPayment);

// Read
recurringPaymentRoutes.get('/', protect, controller.getRecurringPayments);
recurringPaymentRoutes.get('/upcoming', protect, controller.getUpcomingPayments);

// Update
recurringPaymentRoutes.put('/:id/update-date', protect, controller.updateNextDate);
recurringPaymentRoutes.put('/:id/pause', protect, controller.pauseSubscription);
recurringPaymentRoutes.put('/:id/resume', protect, controller.resumeSubscription);

// Delete
recurringPaymentRoutes.delete('/:id', protect, controller.deleteRecurringPayment);

// Undo last generated expense
recurringPaymentRoutes.post('/undo', protect, controller.undoPayment);

module.exports = recurringPaymentRoutes;
