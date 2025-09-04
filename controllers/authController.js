const jwt = require('jsonwebtoken');
const User = require('../models/User.js');
const { JWT_SECRET,JWT_EXPIRATION } = process.env;

const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: JWT_EXPIRATION,
    });
}

// Register a new user

exports.registerUser = async (req, res) => {
  const { fullName, email, password, profileImageUrl } = req.body;

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all fields' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      profileImageUrl,
    });

    res.status(201).json({
      message: 'User registered successfully',
      id: user._id,
      user,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Login a user
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
    try {
        if (!email || !password) {
        return res.status(400).json({ message: 'Please fill in all fields' });
        }
    
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        res.status(200).json({
            message: 'User logged in successfully',
            id: user._id,
            user,
            token: generateToken(user._id),
        });
    }
    catch (error) {
        console.error('Error logging in user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }

}


// Get user information
exports.getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if(!user){
        return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({message: 'User info retrieved successfully', user});
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}