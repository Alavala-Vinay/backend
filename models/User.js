const mongoose = require('mongoose');
const argon2 = require('argon2');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true, select: false },
  profileImageUrl: { type: String, default: null }
}, { timestamps: true });

// ⚡ Argon2 hashing
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await argon2.hash(this.password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    parallelism: 1,
    timeCost: 3
  });
  next();
});

// ⚡ Compare password
userSchema.methods.comparePassword = function (candidatePassword) {
  return argon2.verify(this.password, candidatePassword);
};

// ⚡ Safe JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// ⚡ Extra index for login lookups
userSchema.index({ email: 1, password: 1 });

module.exports = mongoose.model('User', userSchema);
