const { oauth2Client } = require("./client");
const { google } = require("googleapis");

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

    console.log("User Info:", userInfo);

    // res.redirect(
    //   `http://localhost:3000/dashboard?accessToken=${tokens.access_token}`
    // );
  } catch (error) {
    console.error("Error getting tokens or user info:", error);
    res.status(500).send("Authentication failed");
  }
}

module.exports = googleAuthCallbackHandler;
