const Income = require("../models/Income.js");
const Expense = require("../models/Expense.js");
const RecurringPayment = require("../models/RecurringPayment.js");
const { isValidObjectId, Types } = require("mongoose");

exports.getSubscriptionDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isValidObjectId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const userObjectId = new Types.ObjectId(String(userId));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    // =======================
    // Parallel queries
    // =======================
    const [
      totalIncomeAgg,
      totalExpenseAgg,
      last60DaysIncomeTransactions,
      last30DaysExpenseTransactions,
      recentIncome,
      recentExpense,
      monthlyIncomeAgg,
      monthlyExpenseAgg,
      activeRecurringPayments,
      allRecurringPayments,
    ] = await Promise.all([
      // Total Income
      Income.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Total Expense
      Expense.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Last 60 Days Income
      Income.find({
        userId,
        date: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      })
        .sort({ date: -1 })
        .lean(),

      // Last 30 Days Expenses
      Expense.find({
        userId,
        date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      })
        .sort({ date: -1 })
        .lean(),

      // Recent Income (latest 5)
      Income.find({ userId }).sort({ date: -1 }).limit(5).lean(),

      // Recent Expense (latest 5)
      Expense.find({ userId }).sort({ date: -1 }).limit(5).lean(),

      // Current Month Income
      Income.aggregate([
        {
          $match: {
            userId: userObjectId,
            date: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Current Month Expense
      Expense.aggregate([
        {
          $match: {
            userId: userObjectId,
            date: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Active Recurring Payments
      RecurringPayment.find({ userId, status: "active" }).lean(),

      // All Recurring Payments (for upcoming check)
      RecurringPayment.find({
        userId,
        status: "active",
        $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }],
      }).lean(),
    ]);

    // =======================
    // Process results
    // =======================
    const totalIncome = totalIncomeAgg[0]?.total || 0;
    const totalExpense = totalExpenseAgg[0]?.total || 0;

    const incomeLast60Days = last60DaysIncomeTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );
    const expensesLast30Days = last30DaysExpenseTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );

    const enrichedExpenses = last30DaysExpenseTransactions.map((txn) => ({
      ...txn,
      type: "expense",
    }));

    const lastTransactions = [
      ...recentIncome.map((txn) => ({ ...txn, type: "income" })),
      ...recentExpense.map((txn) => ({ ...txn, type: "expense" })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const monthlyIncome = monthlyIncomeAgg[0]?.total || 0;
    const monthlyExpense = monthlyExpenseAgg[0]?.total || 0;
    const monthlyBalance = monthlyIncome - monthlyExpense;

    // Total active recurring payments
    const totalRecurringAmount = activeRecurringPayments.reduce(
      (sum, sub) => sum + sub.amount,
      0
    );

    // =======================
    // Upcoming payments within 3 days
    // =======================
    const upcomingPayments = [];

    allRecurringPayments.forEach((sub) => {
      const today = new Date();

      // Base = lastGenerated OR startDate
      let baseDate = sub.lastGenerated
        ? new Date(sub.lastGenerated)
        : sub.startDate
        ? new Date(sub.startDate)
        : null;
      if (!baseDate) return;

      let nextDate = new Date(baseDate);

      switch (sub.frequency) {
        case "daily":
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case "weekly":
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case "monthly":
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case "yearly":
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        case "custom":
          if (sub.customInterval && sub.customInterval > 0) {
            nextDate.setDate(nextDate.getDate() + sub.customInterval);
          } else {
            return;
          }
          break;
        default:
          return;
      }

      // Skip expired
      if (sub.endDate && new Date(sub.endDate) < nextDate) return;

      // Only include if within 3 days
      const diffDays = Math.ceil(
        (nextDate - today) / (1000 * 60 * 60 * 24)
      );
      if (diffDays >= 0 && diffDays <= 3) {
        upcomingPayments.push({
          _id: sub._id,
          name: sub.name,
          amount: sub.amount,
          nextPaymentDate: nextDate,
        });
      }
    });

    // =======================
    // Response
    // =======================
    res.json({
      success: true,
      data: {
        totalBalance: totalIncome - totalExpense,
        totalIncome,
        totalExpense,
        last30DaysExpenses: {
          total: expensesLast30Days,
          transactions: enrichedExpenses,
        },
        last60DaysIncome: {
          total: incomeLast60Days,
          transactions: last60DaysIncomeTransactions.map((txn) => ({
            ...txn,
            type: "income",
          })),
        },
        recentTransactions: lastTransactions,
        currentMonth: {
          income: monthlyIncome,
          expense: monthlyExpense,
          balance: monthlyBalance,
          start: monthStart,
          end: monthEnd,
        },
        subscriptions: {
          totalActive: activeRecurringPayments.length,
          totalAmount: totalRecurringAmount,
          upcoming: upcomingPayments,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
