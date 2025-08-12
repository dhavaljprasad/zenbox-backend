const express = require("express");
const gmailRouter = express.Router();
const User = require("../../models/user");
const { oauth2Client } = require("../../auth/client");

gmailRouter.get("/accessToken", async (req, res) => {
  try {
    // You need to get the user ID from your JWT payload
    const userId = req.user.id;
    // Find the user to get their refresh token
    const user = await User.findById(userId);

    if (!user || !user.refreshToken) {
      return res
        .status(401)
        .json({ message: "User or refresh token not found." });
    }

    // Set the user's refresh token on the OAuth2 client
    oauth2Client.setCredentials({
      refresh_token: user.refreshToken,
    });

    // Request a new access token from Google
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Send the new access token back to the client
    res.status(200).json({ accessToken: credentials.access_token });
  } catch (error) {
    console.error("Error refreshing access token:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve a new Google access token." });
  }
});

module.exports = gmailRouter;
