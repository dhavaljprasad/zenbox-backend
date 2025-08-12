// auth/redirect.js
const { oauth2Client } = require("./client");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

async function googleAuthCallbackHandler(req, res) {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const people = google.people({ version: "v1", auth: oauth2Client });

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

    // 1. Find the user by their email
    let user = await User.findOne({ email: userInfo.email });

    // 2. Check if the user exists
    if (user) {
      // User found, update the document with the raw refresh token
      user.name = userInfo.name;
      user.profileImage = userInfo.profileImage;
      user.refreshToken = userInfo.refreshToken; // <-- FIX: Save the raw token
      user.provider = userInfo.provider;
      await user.save();
    } else {
      // User not found, create a new document
      user = new User({
        ...userInfo,
        refreshToken: userInfo.refreshToken, // <-- FIX: Save the raw token
      });
      await user.save();
    }

    const jwtPayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      provider: user.provider,
      profileImage: user.profileImage,
      subscriptionTier: user.subscriptionTier,
      accessToken: tokens.access_token,
    };

    const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: "180d",
    });

    res.cookie("jwtToken", jwtToken, {
      secure: process.env.NODE_ENV === "production",
      maxAge: 180 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
    });
    res.cookie("accessToken", tokens.access_token, {
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000,
      sameSite: "strict",
    });

    res.redirect(`http://localhost:3000/mail`);
  } catch (error) {
    console.error("Error getting tokens or user info:", error);
    res.status(500).send("Authentication failed");
  }
}

module.exports = googleAuthCallbackHandler;
