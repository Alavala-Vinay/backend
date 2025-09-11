const RecurringPayment = require('../models/RecurringPayment');
const Expense = require('../models/Expense');

// Icon mapping based on name
const iconMapping = {
  apple: "🍎",
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
    const { name, amount, frequency, customInterval, startDate, endDate, category, description } = req.body;

    if (!name || !amount) return res.status(400).json({ success: false, message: "Name and amount required" });

    const payment = new RecurringPayment({
      userId: req.user.id,
      name,
      amount,
      frequency: frequency || 'monthly',
      customInterval: customInterval || 1,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      category,
      description,
      icon: getIcon(name)
    });

    await payment.save();
    return res.status(201).json({ success: true, message: "Recurring payment added", data: payment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all recurring payments
exports.getRecurringPayments = async (req, res) => {
  try {
    const payments = await RecurringPayment.find({ userId: req.user.id }).sort({ startDate: -1 }).lean();
    return res.json({ success: true, data: payments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete recurring payment
exports.deleteRecurringPayment = async (req, res) => {
  try {
    const deleted = await RecurringPayment.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Recurring payment not found' });
    return res.json({ success: true, message: 'Recurring payment deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Pause subscription
exports.pauseSubscription = async (req, res) => {
  try {
    const subscription = await RecurringPayment.findOne({ _id: req.params.id, userId: req.user.id });
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });

    subscription.status = 'paused';
    await subscription.save();
    return res.json({ success: true, message: 'Subscription paused', data: subscription });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Resume subscription
exports.resumeSubscription = async (req, res) => {
  try {
    const subscription = await RecurringPayment.findOne({ _id: req.params.id, userId: req.user.id });
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });

    subscription.status = 'active';
    await subscription.save();
    return res.json({ success: true, message: 'Subscription resumed', data: subscription });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update start date (prepone/postpone)
exports.updateNextDate = async (req, res) => {
  try {
    const { newStartDate } = req.body;
    if (!newStartDate) return res.status(400).json({ success: false, message: 'New start date required' });

    const payment = await RecurringPayment.findOne({ _id: req.params.id, userId: req.user.id });
    if (!payment) return res.status(404).json({ success: false, message: 'Recurring payment not found' });

    payment.startDate = new Date(newStartDate);
    await payment.save();
    return res.json({ success: true, message: 'Start date updated', data: payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Undo last generated expense
exports.undoPayment = async (req, res) => {
  try {
    const { expenseId } = req.body;
    if (!expenseId) return res.status(400).json({ success: false, message: 'Expense ID required' });

    const expense = await Expense.findOne({ _id: expenseId, userId: req.user.id });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

    const recurringPayment = await RecurringPayment.findOne({
      userId: req.user.id,
      name: expense.description
    });

    await expense.remove();

    if (recurringPayment && new Date(expense.date).getTime() === new Date(recurringPayment.lastGenerated).getTime()) {
      recurringPayment.lastGenerated = getPreviousDate(recurringPayment.frequency, recurringPayment.lastGenerated, recurringPayment.customInterval);
      await recurringPayment.save();
    }

    return res.json({ success: true, message: 'Payment undone successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Generate expenses automatically
exports.generateExpenses = async () => {
  try {
    const today = new Date();
    const payments = await RecurringPayment.find({
      status: 'active',
      startDate: { $lte: today },
      $or: [{ endDate: { $exists: false } }, { endDate: { $gte: today } }]
    });

    for (const payment of payments) {
      let last = payment.lastGenerated ? new Date(payment.lastGenerated) : new Date(payment.startDate);
      let nextDate = getNextDate(payment.frequency, last, payment.customInterval);

      while (nextDate <= today) {
        const expense = new Expense({
          userId: payment.userId,
          icon: payment.icon || "🔁",
          description: payment.description || payment.name,
          category: payment.category || "Recurring",
          amount: payment.amount,
          date: nextDate
        });

        await expense.save();

        payment.lastGenerated = nextDate;
        await payment.save();

        last = nextDate;
        nextDate = getNextDate(payment.frequency, last, payment.customInterval);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

// Upcoming payments (1–3 days)
exports.getUpcomingPayments = async (req, res) => {
  try {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    const upcoming = await RecurringPayment.find({
      userId: req.user.id,
      status: 'active',
      $or: [{ endDate: { $exists: false } }, { endDate: { $gte: today } }]
    }).lean();

    const notifications = upcoming.filter(sub => {
      const nextDue = sub.lastGenerated ? getNextDate(sub.frequency, new Date(sub.lastGenerated), sub.customInterval) : new Date(sub.startDate);
      return nextDue >= today && nextDue <= threeDaysLater;
    });

    return res.json({ success: true, data: notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
