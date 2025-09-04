const mongoose = require('mongoose');
const dotenv = require('dotenv');

exports.connectDB = async () => {
  dotenv.config();
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}