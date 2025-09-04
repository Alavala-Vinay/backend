const mongoose = require('mongoose');


const incomeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    icon: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: 'No description'
    },
    source:{
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
},{timestamps: true});

const Income = mongoose.model('Income', incomeSchema);

module.exports = Income;