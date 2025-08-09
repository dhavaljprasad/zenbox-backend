const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    profileImage: {
      type: String,
    },
    provider: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    subscriptionTier: {
      type: String,
      default: "free",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
