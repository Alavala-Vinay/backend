const express = require('express');
const {addIncome, getAllIncomes, deleteIncome,downloadIncomeExcel} = require('../controllers/incomeController.js');

const { protect } = require('../middleware/authMiddleware.js');

const incomeRouter = express.Router();

incomeRouter.post('/add', protect, addIncome);
incomeRouter.get('/get', protect, getAllIncomes);
incomeRouter.delete('/:id', protect, deleteIncome);
incomeRouter.get('/download', protect, downloadIncomeExcel);

module.exports = incomeRouter;