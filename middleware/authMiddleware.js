const jwt = require('jsonwebtoken');
const User = require('../models/User.js');


exports.protect = async (req, res, next) => {
    let token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
  
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
  
      req.user = user;
      next();
    } catch (error) {
      console.error("Auth error:", error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  };
  