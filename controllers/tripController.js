const Expense = require("../models/Expense");
const Income = require("../models/Income");
const Trip = require("../models/Trip");
const TripMessage = require("../models/TripMessage");
const User = require("../models/User"); 

// Helpers
const isCreator = (trip, userId) => String(trip.userId) === String(userId);
const isParticipant = (trip, userId) =>
  trip.participants.map(String).includes(String(userId));

// Create trip (creator + ensure creator in participants)
exports.createTrip = async (req, res) => {
  try {
    const {
      name,
      destination,
      startDate,
      endDate,
      description = "",
      plannedBudget = 0,
      visibility = "group",
      participants = [],
      currency = "INR",
    } = req.body;

    const set = new Set(participants.map(String));
    set.add(String(req.user._id));

    const trip = await Trip.create({
      userId: req.user._id,
      name,
      destination,
      startDate,
      endDate,
      description,
      plannedBudget,
      visibility,
      currency,
      participants: Array.from(set),
    });

    res.status(201).json({ data: trip });
  } catch (err) {
    console.error("createTrip error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// Get all trips
exports.getMyTrips = async (req, res) => {
  try {
    const userId = req.user._id;
    const trips = await Trip.find({
      $or: [{ userId }, { participants: userId }],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: trips });
  } catch (err) {
    console.error("getMyTrips error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get single trip
exports.getTripById = async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate("userId", "fullName email profileImageUrl")
      .populate("participants", "fullName email profileImageUrl")
      .populate("expenses")
      .populate("incomes");

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const isCreator = trip.userId._id.toString() === req.user._id.toString();
    const isParticipant = trip.participants.some(
      (p) => p._id.toString() === req.user._id.toString()
    );

    if (!isCreator && !isParticipant) {
      return res.status(403).json({ message: "Not authorized to view this trip" });
    }

    res.json(trip);
  } catch (err) {
    console.error("Error fetching trip:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add Expense
exports.addExpenseToTrip = async (req, res) => {
  try {
    const { category, amount, date, description, icon } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user._id) && !isParticipant(trip, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if(!icon) {
      icon = "💸";
    }

    if(!category || !amount || !date ) {
      return res.status(400).json({ message: "category, amount and date are required" });
    }

    const expense = await Expense.create({
      userId: req.user.id,
      tripId: trip._id,
      category,
      amount,
      date,
      description: description || "No description",
      icon: icon || "💸",
    });

    trip.expenses.push(expense._id);
    await trip.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`trip:${trip._id}`).emit("trip-notification", {
        type: "expense",
        tripId: trip._id,
        data: expense,
        message: `${req.user.fullName} added an expense: ${expense.description} (${expense.amount})`
      });
    }

    res.json({ data: expense });
  } catch (err) {
    console.error("Add Expense to Trip Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add Income
exports.addIncomeToTrip = async (req, res) => {
  try {
    const { source, amount, date, description, icon } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!icon) {
      icon = "💰";
    }

    if(!source || !amount || !date) {
      return res.status(400).json({ message: "source, amount and date are required" });
    }

    if (!isCreator(trip, req.user._id) && !isParticipant(trip, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const income = await Income.create({
      userId: req.user.id,
      tripId: trip._id,
      source,
      amount,
      date,
      description: description || "No description",
      icon: icon || "💰",
    });

    trip.incomes.push(income._id);
    await trip.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`trip:${trip._id}`).emit("trip-notification", {
        type: "income",
        tripId: trip._id,
        data: income,
        message: `${req.user.fullName} added an income: ${income.source} (${income.amount})`
      });
    }

    res.json({ data: income });
  } catch (err) {
    console.error("Add Income to Trip Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add participants
exports.addParticipants = async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "emails must be a non-empty array" });
    }

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if(trip.visibility === "private" && emails && emails.length > 0) {
      return res.status(400).json({ message: "Cannot add participants to a private trip" });
    }

    if (!isCreator(trip, req.user._id)) {
      return res.status(403).json({ message: "Only the creator can add participants" });
    }

    if(emails.map(e => e.toLowerCase()).includes(req.user.email.toLowerCase())) {
      return res.status(400).json({ message: "Creator is already a participant" });
    }

    const users = await User.find(
      { email: { $in: emails.map((e) => e.toLowerCase()) } },
      "_id fullName email"
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No matching users found for given emails" });
    }

    const newIds = users.map((u) => String(u._id));
    const set = new Set(trip.participants.map(String));
    newIds.forEach((id) => set.add(id));

    trip.participants = Array.from(set);
    await trip.save();
    await trip.populate("participants", "fullName email");

    const io = req.app.get("io");
    if (io) {
      io.to(`trip:${trip._id}`).emit("trip-notification", {
        type: "participant-added",
        tripId: trip._id,
        data: users,
        message: `${req.user.fullName} added new participants`
      });
    }

    res.json({ data: trip });
  } catch (err) {
    console.error("Add Participants Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove participant
exports.removeParticipant = async (req, res) => {
  try {
    const { tripId, userId } = req.params;
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user.id)) {
      return res.status(403).json({ message: "Only the creator can remove participants" });
    }

    if (String(userId) === String(trip.userId)) {
      return res.status(400).json({ message: "Cannot remove the trip creator" });
    }

    await Trip.findByIdAndUpdate(tripId, { $pull: { participants: userId } });
    const updatedTrip = await Trip.findById(tripId).populate("participants", "fullName email");

    const io = req.app.get("io");
    if (io) {
      io.to(`trip:${trip._id}`).emit("trip-notification", {
        type: "participant-removed",
        tripId: trip._id,
        data: { removedUserId: userId },
        message: `${req.user.fullName} removed a participant`
      });
    }

    res.json({ message: "Participant removed successfully", data: updatedTrip });
  } catch (err) {
    console.error("Remove participant error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add place
exports.addPlace = async (req, res) => {
  try {
    const { name, location, plannedCost, notes } = req.body;
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user._id)) {
      return res.status(403).json({ message: "Only creator can add places" });
    }

    trip.places.push({ name, location, plannedCost, notes });
    await trip.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`trip:${trip._id}`).emit("trip-notification", {
        type: "place",
        tripId: trip._id,
        data: { name, location, plannedCost, notes },
        message: `${req.user.fullName} added a new place: ${name}`
      });
    }

    res.json({ data: trip });
  } catch (err) {
    console.error("addPlace error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update place
exports.updatePlace = async (req, res) => {
  try {
    const { tripId, placeId } = req.params;
    const { name, location, plannedCost, notes } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user._id)) {
      return res.status(403).json({ message: "Only creator can update places" });
    }

    const place = trip.places.id(placeId);
    if (!place) return res.status(404).json({ message: "Place not found" });

    if (name !== undefined) place.name = name;
    if (location !== undefined) place.location = location;
    if (plannedCost !== undefined) place.plannedCost = plannedCost;
    if (notes !== undefined) place.notes = notes;

    await trip.save();

    res.json({ message: "Place updated successfully", data: place });
  } catch (error) {
    console.error("Error in updatePlace:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Mark place visited
exports.markPlaceVisited = async (req, res) => {
  try {
    const { tripId, placeId } = req.params;
    const { visited } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user._id)) {
      return res.status(403).json({ message: "Only creator can update places" });
    }

    const place = trip.places.id(placeId);
    if (!place) return res.status(404).json({ message: "Place not found" });

    place.visited = !!visited;
    await trip.save();

    res.json({ message: "Place updated successfully", data: place });
  } catch (error) {
    console.error("Error in markPlaceVisited:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Stats
exports.getTripStats = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId).populate("expenses");
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user._id) && !isParticipant(trip, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const actualTotal = trip.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    trip.realBudget = actualTotal;
    await trip.save();

    const plannedPlacesTotal = trip.places.reduce((sum, p) => sum + (p.plannedCost || 0), 0);

    res.json({
      data: {
        plannedBudget: trip.plannedBudget,
        plannedPlacesTotal,
        actualTotal,
        difference: (Number(trip.plannedBudget) || 0) - actualTotal,
      },
    });
  } catch (err) {
    console.error("getTripStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Save + emit message
exports.postMessage = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user._id) && !isParticipant(trip, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });

    let msg = await TripMessage.create({
      trip: req.params.tripId,
      user: req.user._id,
      message,
    });

    msg = await msg.populate("user", "fullName email");

    const io = req.app.get("io");
    if (io) {
      io.to(`trip:${req.params.tripId}`).emit("trip-message", msg);
      io.to(`trip:${req.params.tripId}`).emit("trip-notification", {
        type: "message",
        tripId: req.params.tripId,
        data: msg,
        message: `${req.user.fullName}: ${msg.message}`
      });
    }

    res.status(201).json(msg);
  } catch (err) {
    console.error("postMessage error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get chat history
exports.getChat = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user._id) && !isParticipant(trip, req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const msgs = await TripMessage.find({ trip: req.params.tripId })
      .populate("user", "fullName email")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(msgs.reverse());
  } catch (err) {
    console.error("getChat error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update trip visibility
exports.updateTripVisibility = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { visibility } = req.body;

    if (!["group", "private"].includes(visibility)) {
      return res.status(400).json({ message: "Invalid visibility option" });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (!isCreator(trip, req.user._id)) {
      return res.status(403).json({ message: "Only the creator can update visibility" });
    }

    trip.visibility = visibility;
    await trip.save();

    res.json({ message: "Visibility updated successfully", visibility });
  } catch (error) {
    console.error("Error in updateTripVisibility:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
