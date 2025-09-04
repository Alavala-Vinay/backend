const Trip = require("../models/Trip");

const mustBeTripMember = async (req, res, next) => {
  const tripId = req.params.tripId || req.body.tripId;
  if (!tripId) return res.status(400).json({ message: "tripId required" });

  const trip = await Trip.findById(tripId).select("userId participants visibility");
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const userId = String(req.user._id);
  const isCreator = String(trip.userId) === userId;
  const isParticipant = trip.participants.map(String).includes(userId);

  if ((trip.visibility === "private" && !isCreator) || (!isCreator && !isParticipant)) {
    return res.status(403).json({ message: "Access denied" });
  }

  req.trip = trip;
  next();
};

module.exports = { mustBeTripMember };
