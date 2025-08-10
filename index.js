// importing packages
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const googleAuthCallbackHandler = require("./auth/redirect");
const { authUrl } = require("./auth/client");
import authMiddleware from "./auth/middleware";

// configuring packages
dotenv.config();
const app = express();
app.use(cors());

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

// Create a new router for protected API endpoints
const apiRouter = express.Router();
// Apply the authentication middleware to all routes in apiRouter
apiRouter.use(authMiddleware);

// Define your protected API routes on the apiRouter
apiRouter.get("/profile", (req, res) => {
  // req.user contains the decoded JWT payload
  res.json({ user: req.user, message: "This is a protected route." });
});

apiRouter.post("/mails/send", (req, res) => {
  // Logic to send mail
  res.json({ message: "Mail sent successfully." });
});

apiRouter.put("/settings", (req, res) => {
  // Logic to update user settings
  res.json({ message: "Settings updated." });
});

// Mount the apiRouter at the /api endpoint
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
