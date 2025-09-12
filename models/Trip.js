const mongoose = require("mongoose");

const placeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    plannedCost: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    visited: { type: Boolean, default: false },
    dateVisited: { type: Date },
    photos: [{ type: String, trim: true }],
    rating: { type: Number, min: 1, max: 5 },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    index: true
  },
  { _id: true }
);

const tripSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true // ✅ fast "get trips by creator"
    },

    name: { type: String, required: true, trim: true, maxlength: 100, index: true },
    destination: { type: String, required: true, trim: true, maxlength: 100, index: true  },
    startDate: { type: Date, required: true, index: true }, // ✅ fast range queries
    endDate: { type: Date, required: true },
    description: { type: String, default: "", trim: true, maxlength: 1000 },

    expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Expense", index: true }],
    incomes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Income", index: true }],

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    visibility: { type: String, enum: ["group", "private"], default: "group", index: true },
    plannedBudget: { type: Number, default: 0,index: true },
    realBudget: { type: Number, default: 0 },
    currency: { type: String, default: "INR", maxlength: 10 },

    places: [placeSchema],
  },
  { timestamps: true }
);

// ✅ Compound indexes for fast lookups
tripSchema.index({ userId: 1, createdAt: -1 }); // trips by creator, newest first
tripSchema.index({ participants: 1, createdAt: -1 }); // trips where user is participant
tripSchema.index({ destination: 1, startDate: 1 }); // trips to destination in a date range
tripSchema.index({ userId: 1, visibility: 1 }); // filter by visibility
tripSchema.index({ userId: 1, plannedBudget: -1 }); // sort by planned budget
tripSchema.index({ userId: 1, currency: 1 }); // filter by currency
tripSchema.index({ userId: 1, name: 1 }); // lookup by trip name
tripSchema.index({ userId: 1, startDate: -1 }); // sort by start date
tripSchema.index({ userId: 1, endDate: -1 }); // sort by end date
tripSchema.index({ userId: 1, destination: 1 }); // filter by destination


// ✅ Hide internal fields (__v) in API responses
tripSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Trip", tripSchema);
