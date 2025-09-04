const express = require("express");
const {
  createTrip,
  getMyTrips,
  getTripById,
  addExpenseToTrip,
  addIncomeToTrip,
  addParticipants,
  removeParticipant,
  addPlace,
  markPlaceVisited,
  getTripStats,
  postMessage,
  getChat,
  updateTripVisibility,
} = require("../controllers/tripController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Trips
router.post("/", protect, createTrip);
router.get("/", protect, getMyTrips);
router.get("/:tripId", protect, getTripById);

// Expenses & incomes linked to trip
router.post("/:id/expenses", protect, addExpenseToTrip);
router.post("/:id/incomes", protect, addIncomeToTrip);

// Participants (creator only)
router.post("/:tripId/participants", protect, addParticipants);
router.delete("/:tripId/participants/:userId", protect, removeParticipant);

// Places (creator only)
router.post("/:tripId/places", protect, addPlace);
router.put("/:tripId/places/:placeId", protect, markPlaceVisited);

// Stats
router.get("/:tripId/stats", protect, getTripStats);

// Chat
router.post("/:tripId/messages", protect, postMessage);
router.get("/:tripId/messages", protect, getChat);

// Visibility (creator only)
router.patch("/:tripId/visibility", protect, updateTripVisibility);

module.exports = router;
