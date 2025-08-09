// importing packages
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const googleAuthCallbackHandler = require("./auth/redirect");
const { authUrl } = require("./auth/client");

// configuring packages
dotenv.config();
const app = express();
app.use(cors());

// defining the port from environment variables
const port = process.env.PORT;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// New route to handle the Google login initiation
app.get("/auth/google", (req, res) => {
  res.redirect(authUrl);
});

app.get("/auth/google/callback", googleAuthCallbackHandler);

// Create a function to connect to the database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1); // Exit the process on connection failure
  }
};

// Call connectDB before starting the server
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
