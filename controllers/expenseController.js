const User = require('../models/User.js');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const Expense = require('../models/Expense.js');
//add expense
exports.addExpense = async (req, res) => {
  try {
    const { icon, description, category, amount } = req.body;

    if (!icon || !description || !category || !amount) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const expense = new Expense({
      userId: req.user._id, // from auth middleware
      icon,
      description,
      category,
      amount,
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    console.error("Error adding expense:", err);
    res.status(500).json({ message: "Server error" });
  }
};
//get all expenses
exports.getAllExpenses = async (req, res) => {
    const userId = req.user.id;
    try {
        const expenses = await Expense.find({ userId }).sort({ date: -1 });
        return res.status(200).json({ message: 'expenses fetched successfully', data: expenses });
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
}

//delete expense
exports.deleteExpense = async (req, res) => {
    try {
        const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
    
        if (!deletedExpense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
    
        return res.status(200).json({ message: 'Expense deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
    
};


//download expenses excel

exports.downloadExpenseExcel = async (req, res) => {
    const userId = req.user.id;

    try {
        const expenses = await Expense.find({ userId }).sort({ date: -1 });

        if (expenses.length === 0) {
            return res.status(404).json({ message: 'No expense found' });
        }

        const data = expenses.map(expense => ({
            Category: expense.category,
            Icon: expense.icon,
            Amount: expense.amount,
            Description: expense.description,
            Date: expense.date.toISOString().split('T')[0]
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Expenses');

        const filePath = path.join(__dirname, '..', 'Expenses.xlsx');
        xlsx.writeFile(wb, filePath);

        res.download(filePath, 'Expenses.xlsx', (err) => {
            if (err) {
                console.error('Download error:', err);
                return res.status(500).json({ message: 'File download error' });
            }

            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Failed to delete file:', unlinkErr);
                }
            });
        });
    } catch (error) {
        console.error('Excel generation error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
