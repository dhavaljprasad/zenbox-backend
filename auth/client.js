const { OAuth2Client } = require("google-auth-library");
const dotenv = require("dotenv");
dotenv.config();

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:8080/auth/google/callback" // The redirect URI you configured
);

// This URL will be sent to the frontend for the user to initiate login
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline", // crucial for getting a refresh token
  prompt: "consent", // <-- Add this line
  scope: [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "openid",
    "profile",
  ],
});

module.exports = { oauth2Client, authUrl };
