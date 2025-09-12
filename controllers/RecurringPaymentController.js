const RecurringPayment = require('../models/RecurringPayment');
const Expense = require('../models/Expense');

// Icon mapping based on name
const iconMapping = {
  apple: "",
  zoom: "🔍",
  youtube: "▶️",
  google: "🔎",
  netflix: "🎬",
  spotify: "🎧",
  amazon: "🛒"
};

function getIcon(name) {
  name = name.toLowerCase();
  for (const key in iconMapping) {
    if (name.includes(key)) return iconMapping[key];
  }
  return "🔁"; // default
}

// Helper to calculate next date based on frequency & custom interval
function getNextDate(frequency, date, interval = 1) {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + interval);
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7 * interval);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + interval);
  else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + interval);
  return next;
}

// Helper to calculate previous date
function getPreviousDate(frequency, date, interval = 1) {
  const prev = new Date(date);
  if (frequency === 'daily') prev.setDate(prev.getDate() - interval);
  else if (frequency === 'weekly') prev.setDate(prev.getDate() - 7 * interval);
  else if (frequency === 'monthly') prev.setMonth(prev.getMonth() - interval);
  else if (frequency === 'yearly') prev.setFullYear(prev.getFullYear() - interval);
  return prev;
}

// Add recurring payment
exports.addRecurringPayment = async (req, res) => {
  try {
    const { name, amount, frequency = "monthly", customInterval = 1, startDate, endDate, category, description } = req.body;
    if (!name || !amount) return res.status(400).json({ success: false, message: "Name and amount required" });

    const payment = await RecurringPayment.create({
      userId: req.user.id,
      name,
      amount,
      frequency,
      customInterval,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      category,
      description,
      icon: getIcon(name)
    });

    res.status(201).json({ success: true, message: "Recurring payment added", data: payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Get all recurring payments
exports.getRecurringPayments = async (req, res) => {
  try {
    const payments = await RecurringPayment
      .find({ userId: req.user.id })
      .sort("-startDate") // shorthand for { startDate: -1 }
      .lean();

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Delete recurring payment
const mongoose = require("mongoose");

exports.deleteRecurringPayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    const deleted = await RecurringPayment.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Recurring payment not found" });
    }

    res.json({ success: true, message: "Recurring payment deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Pause subscription
exports.pauseSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid subscription ID" });
    }

    const subscription = await RecurringPayment.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { status: "paused" },
      { new: true } // return updated doc
    );

    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    res.json({ success: true, message: "Subscription paused", data: subscription });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Resume subscription
exports.resumeSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid subscription ID" });
    }

    const subscription = await RecurringPayment.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { status: "active" },
      { new: true } // return updated doc
    );

    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    res.json({ success: true, message: "Subscription resumed", data: subscription });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update start date (prepone/postpone)

exports.updateNextDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStartDate } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    if (!newStartDate) {
      return res.status(400).json({ success: false, message: "New start date required" });
    }

    const payment = await RecurringPayment.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { startDate: new Date(newStartDate) },
      { new: true } // return updated doc
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: "Recurring payment not found" });
    }

    res.json({ success: true, message: "Start date updated", data: payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Undo last generated expense

exports.undoPayment = async (req, res) => {
  try {
    const { expenseId } = req.body;

    if (!expenseId) {
      return res.status(400).json({ success: false, message: "Expense ID required" });
    }

    if (!mongoose.isValidObjectId(expenseId)) {
      return res.status(400).json({ success: false, message: "Invalid expense ID" });
    }

    const expense = await Expense.findOne({ _id: expenseId, userId: req.user.id });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    // find related recurring payment by matching description
    const recurringPayment = await RecurringPayment.findOne({
      userId: req.user.id,
      name: expense.description
    });

    await expense.deleteOne(); // safer than .remove()

    if (
      recurringPayment &&
      new Date(expense.date).getTime() === new Date(recurringPayment.lastGenerated).getTime()
    ) {
      recurringPayment.lastGenerated = getPreviousDate(
        recurringPayment.frequency,
        recurringPayment.lastGenerated,
        recurringPayment.customInterval
      );
      await recurringPayment.save();
    }

    res.json({ success: true, message: "Payment undone successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Generate expenses automatically
exports.generateExpenses = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payments = await RecurringPayment.find({
      status: "active",
      startDate: { $lte: today },
      $or: [{ endDate: { $exists: false } }, { endDate: { $gte: today } }]
    });

    const expensesToInsert = [];
    const paymentUpdates = [];

    for (const payment of payments) {
      let last = payment.lastGenerated ? new Date(payment.lastGenerated) : new Date(payment.startDate);
      let nextDate = getNextDate(payment.frequency, last, payment.customInterval);

      while (nextDate <= today) {
        expensesToInsert.push({
          userId: payment.userId,
          icon: payment.icon || "🔁",
          description: payment.description || payment.name,
          category: payment.category || "Recurring",
          amount: payment.amount,
          date: nextDate
        });

        paymentUpdates.push({
          updateOne: {
            filter: { _id: payment._id },
            update: { $set: { lastGenerated: nextDate } }
          }
        });

        last = nextDate;
        nextDate = getNextDate(payment.frequency, last, payment.customInterval);
      }
    }

    if (expensesToInsert.length) {
      await Expense.insertMany(expensesToInsert, { ordered: false }); // batch insert
    }

    if (paymentUpdates.length) {
      await RecurringPayment.bulkWrite(paymentUpdates); // batch update
    }
  } catch (error) {
    console.error("Error generating expenses:", error);
  }
};


// Upcoming payments (1–3 days)
exports.getUpcomingPayments = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to midnight

    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    const upcoming = await RecurringPayment.find({
      userId: req.user.id,
      status: "active",
      $or: [{ endDate: { $exists: false } }, { endDate: { $gte: today } }]
    }).lean();

    const notifications = upcoming.filter((sub) => {
      const lastGenerated = sub.lastGenerated ? new Date(sub.lastGenerated) : null;
      const nextDue = lastGenerated
        ? getNextDate(sub.frequency, lastGenerated, sub.customInterval)
        : new Date(sub.startDate);

      return nextDue >= today && nextDue <= threeDaysLater;
    });

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error("Error fetching upcoming payments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
