const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// ✅ Cloudinary config (make sure .env is set properly)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Cloudinary storage setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "uploads", // Cloudinary folder
      format: file.mimetype.split("/")[1], // auto-detect format (jpg, png, etc.)
      public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
      transformation: [{ quality: "auto", fetch_format: "auto" }], // optimize images
    };
  },
});

// ✅ File filter validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/dng",
    "image/heic",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("❌ Only .jpeg, .jpg, .png, .dng, .heic formats are allowed"), false);
  }
};

// ✅ Multer middleware
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

module.exports = upload;
