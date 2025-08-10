const { oauth2Client } = require("./client");
const { google } = require("googleapis");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

async function googleAuthCallbackHandler(req, res) {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Initialize the Google People API client
    const people = google.people({ version: "v1", auth: oauth2Client });

    // Fetch the user's profile info
    const profile = await people.people.get({
      resourceName: "people/me",
      personFields: "emailAddresses,names,photos",
    });

    const userInfo = {
      name: profile.data.names?.[0]?.displayName,
      email: profile.data.emailAddresses?.[0]?.value,
      profileImage: profile.data.photos?.[0]?.url,
      provider: "google",
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
    };

    // Hash the refresh token before saving
    const salt = await bcrypt.genSalt(10);
    const hashedRefreshToken = await bcrypt.hash(userInfo.refreshToken, salt);

    // 1. Find the user by their email
    let user = await User.findOne({ email: userInfo.email });
    // 2. Check if the user exists
    if (user) {
      // User found, update the document
      user.name = userInfo.name;
      user.profileImage = userInfo.profileImage;
      user.refreshToken = hashedRefreshToken;
      user.provider = userInfo.provider;
      await user.save(); // This will also update the 'updatedAt' timestamp
    } else {
      // User not found, create a new document
      user = new User({
        ...userInfo,
        refreshToken: hashedRefreshToken,
      });
      await user.save();
    }

    // Prepare the payload for the JWT
    const jwtPayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      provider: user.provider,
      profileImage: user.profileImage,
      subscriptionTier: user.subscriptionTier,
      accessToken: tokens.access_token, // Include the short-lived access token
    };

    const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: "180d",
    });

    res.cookie("jwtToken", jwtToken, {
      // httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 180 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
    });
    res.cookie("accessToken", tokens.access_token, {
      // httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000,
      sameSite: "strict",
    });

    res.redirect(`http://localhost:3000/zenbox`);

    // Redirect with the JWT and accessToken
    res.redirect(
      `http://localhost:3000/mail?jwtToken=${jwtToken}&accessToken=${tokens.access_token}`
    );
  } catch (error) {
    console.error("Error getting tokens or user info:", error);
    res.status(500).send("Authentication failed");
  }
}

module.exports = googleAuthCallbackHandler;
