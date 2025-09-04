const express = require('express');
const authRouter = express.Router();
const { protect } = require('../middleware/authMiddleware.js');
const { registerUser, loginUser, getUserInfo } = require('../controllers/authController.js');
const upload = require('../middleware/uploadMiddleware.js');

authRouter.post('/register', registerUser);
authRouter.post('/login', loginUser);
authRouter.get('/getuser',protect, getUserInfo);
authRouter.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    // Cloudinary stores the URL in req.file.path
    res.json({ imageUrl: req.file.path });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Image upload failed" });
  }
});


module.exports = authRouter;