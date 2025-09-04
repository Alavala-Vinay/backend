const mongoose = require("mongoose");

const placeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    plannedCost: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    visited: { type: Boolean, default: false },
  },
  { _id: true }
);

const tripSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // creator

    // original fields
    name: { type: String, required: true },
    destination: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String, default: "" },
    expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Expense" }],
    incomes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Income" }],

    // new fields
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // friends
    visibility: { type: String, enum: ["group", "private"], default: "group" },
    plannedBudget: { type: Number, default: 0 },
    realBudget: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    places: [placeSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);
