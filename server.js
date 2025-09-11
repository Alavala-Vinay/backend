const dotenv = require("dotenv");
const express = require("express");
const cron = require("node-cron");
const cors = require("cors");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const compression = require("compression");
dotenv.config();

const { Server: SocketIOServer } = require("socket.io");

const authRoutes = require("./routes/authRoutes.js");
const incomeRoutes = require("./routes/incomeRoutes.js");
const expenseRoutes = require("./routes/expenseRoutes.js");
const dashboardRoutes = require("./routes/dashboardRoutes.js");
const tripRoutes = require("./routes/tripRoutes.js");

const Trip = require("./models/Trip.js");
const TripMessage = require("./models/TripMessage.js");
const { connectDB } = require("./config/db.js");
const recurringPaymentRoutes = require("./routes/recurringPaymentRoutes.js");
const SubscriptionDashboardRoutes = require("./routes/subscriptionDashboardRoutes.js");

// Import recurring payment controller
const { generateExpenses } = require("./controllers/RecurringPaymentController.js");

const app = express();
const server = http.createServer(app);

// --- Security + Performance ---
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://expensia-xi.vercel.app",
    credentials: true,
  })
);
app.set("trust proxy", 1);

// --- Disable caching for APIs ---
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// --- Body parsing ---
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// --- DB ---
connectDB();

// --- Routes ---
app.get("/", (req, res) => res.send("API is running..."));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/expense", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/trips", tripRoutes);
app.use("/api/v1/recurring-payments", recurringPaymentRoutes);
app.use("/api/v1/subscriptions", SubscriptionDashboardRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Socket.IO ---
const allowedOrigin = process.env.FRONTEND_URL || "https://expensia-xi.vercel.app";
const io = new SocketIOServer(server, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"] },
});
app.set("io", io);

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");

  if (!token) return next(new Error("unauthorized"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: payload.id || payload._id };
    next();
  } catch (err) {
    console.error("Socket auth failed:", err.message);
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.user.id}`);

  socket.on("join-trip", async (tripId) => {
    try {
      const trip = await Trip.findById(tripId).select("userId participants visibility");
      if (!trip) return socket.emit("error", "Trip not found");

      const uid = String(socket.user.id);
      const isCreator = String(trip.userId) === uid;
      const isParticipant = trip.participants.map(String).includes(uid);

      if ((trip.visibility === "private" && !isCreator) || (!isCreator && !isParticipant)) {
        return socket.emit("error", "Access denied");
      }

      socket.join(`trip:${tripId}`);
      socket.emit("joined", tripId);
    } catch (err) {
      console.error("Join trip error:", err);
      socket.emit("error", "Server error");
    }
  });

  socket.on("trip-message", async ({ tripId, message }) => {
    if (!tripId || !message) return;

    try {
      const msg = await TripMessage.create({
        trip: tripId,
        user: socket.user.id,
        message,
      });

      const populated = await msg.populate("user", "fullName email");

      io.to(`trip:${tripId}`).emit("trip-message", populated);

      io.to(`trip:${tripId}`).emit("trip-notification", {
        type: "message",
        tripId,
        data: populated,
        message: `${populated.user.fullName}: ${populated.message}`,
      });
    } catch (err) {
      console.error("Trip message error:", err);
      socket.emit("error", "Message not sent");
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.user.id}`);
  });
});

// --- Cron Job: run daily at 3:30 PM IST ---
const cronExpression = "38 17 * * *";

cron.schedule(
  cronExpression,
  async () => {
    console.log("🚀 [CRON] Triggered at", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
    try {
      await generateExpenses();
      console.log("[CRON] generateExpenses() completed successfully.");
    } catch (err) {
      console.error("CRON] Error running generateExpenses:", err.message);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);

// --- Start server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📅 [CRON] Job scheduled daily at 3:30 PM IST`);
});
