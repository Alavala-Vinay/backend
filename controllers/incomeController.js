const User = require('../models/User.js');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const Income = require('../models/Income.js');
//add income
exports.addIncome = async (req, res) => {
    const userId = req.user.id;
    try {
        const {icon, source, amount, date,description} = req.body;

        if( !source || !amount || !date) {
            return res.status(400).json({ message: 'Please fill all fields' });
        }

        const newIncome = new Income({
            userId,
            icon,
            source,
            description,
            amount,
            date:new Date(date)
        });

        await newIncome.save();

        return res.status(201).json({  data: newIncome });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }
}

//get all incomes
exports.getAllIncomes = async (req, res) => {
    const userId = req.user.id;
    try {
        const income = await Income.find({ userId }).sort({ date: -1 });
        return res.status(200).json({data: income });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }
}

//delete income
exports.deleteIncome = async (req, res) => {
    try {
        const deletedIncome = await Income.findByIdAndDelete(req.params.id);
    
        if (!deletedIncome) {
            return res.status(404).json({ message: 'Income not found' });
        }
    
        return res.status(200).json({ message: 'Income deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }
    
};


//download income excel

exports.downloadIncomeExcel = async (req, res) => {
    const userId = req.user.id;

    try {
        const incomes = await Income.find({ userId }).sort({ date: -1 });

        if (incomes.length === 0) {
            return res.status(404).json({ message: 'No incomes found' });
        }

        const data = incomes.map((income) => ({
            Source: income.source,
            Amount: income.amount,
            Date: income.date.toISOString().split('T')[0]
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Incomes');

        const filePath = path.join(__dirname, '..', 'Income.xlsx');
        xlsx.writeFile(wb, filePath);

        res.download(filePath, 'Income.xlsx', (err) => {
            if (err) {
                console.error('Download error:', err);
                return res.status(500).json({ message: 'File download error' });
            }
        });
    } catch (error) {
        console.error('Excel generation error:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
};
