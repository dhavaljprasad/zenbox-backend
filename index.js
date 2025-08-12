// importing packages
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const googleAuthCallbackHandler = require("./auth/redirect");
const { authUrl } = require("./auth/client");
const apiRouter = require("./routes/api");

// configuring packages
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// defining the port from environment variables
const port = process.env.PORT;

// open routes
app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.get("/auth/google", (req, res) => {
  res.redirect(authUrl);
});
app.get("/auth/google/callback", googleAuthCallbackHandler);

/// Mount the apiRouter at the /api endpoint
// All routes defined in routes/api.js will now be available under /api
app.use("/api", apiRouter);

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
