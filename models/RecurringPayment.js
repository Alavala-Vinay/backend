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
      maxlength: 100
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      default: 'monthly'
    },
    customInterval: { type: Number, default: 1 }, // For "every 2 weeks" etc.
    startDate: {
      type: Date,
      default: () => new Date()
    },
    endDate: {
      type: Date
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
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
      default: 'active'
    }
  },
  { timestamps: true }
);

recurringPaymentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const RecurringPayment = mongoose.model('RecurringPayment', recurringPaymentSchema);
module.exports = RecurringPayment;
