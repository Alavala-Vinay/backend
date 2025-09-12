const mongoose = require('mongoose');

const recurringPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index:true
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      index: true
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      default: 'monthly',
      required: true,
      index: true
    },
    customInterval: { type: Number, default: 1 }, // For "every 2 weeks" etc.
    startDate: {
      type: Date,
      default: () => new Date(),
      index: true
    },
    endDate: {
      type: Date
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true
    },
    description: {
      type: String,
      trim: true,
      index: true,
      maxlength: 500
    },
    icon: {
      type: String,
      trim: true,
      maxlength: 50
    },
    lastGenerated: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active',
      index: true
    },
    lastGeneratedExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      default: null
    }
  },
  { timestamps: true }
);

recurringPaymentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Compound indexes
recurringPaymentSchema.index({ userId: 1, status: 1 }); // Fast "get my active subscriptions"
recurringPaymentSchema.index({ userId: 1, name: 1 }); // Fast lookup by name
recurringPaymentSchema.index({ userId: 1, frequency: 1 }); // Filter by frequency
recurringPaymentSchema.index({ userId: 1, startDate: -1 }); // Sort by start date
recurringPaymentSchema.index({ userId: 1, endDate: 1 }); // Filter by end date
recurringPaymentSchema.index({ userId: 1, category: 1 }); // Filter by category
recurringPaymentSchema.index({ userId: 1, lastGenerated: -1 }); // Sort by last generated
const RecurringPayment = mongoose.model('RecurringPayment', recurringPaymentSchema);
module.exports = RecurringPayment;
