const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const mailRouter = express.Router();

dotenv.config();

const GOOGLE_GMAIL_ENDPOINT = process.env.GOOGLE_GMAIL_ENDPOINT;

// Helper function to fetch and process messages for a given query
const fetchAndProcessMessages = async (accessToken, pageToken, query) => {
  try {
    const listResponse = await axios.get(`${GOOGLE_GMAIL_ENDPOINT}/messages`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        maxResults: 20,
        pageToken: pageToken || "",
        q: query,
      },
    });

    let { messages, nextPageToken, resultSizeEstimate } = listResponse.data;

    if (!messages || messages.length === 0) {
      return {
        messages: [],
        nextPageToken: nextPageToken || "",
        resultSizeEstimate,
      };
    }

    // Fetch metadata for each message concurrently
    const messagePromises = messages.map((message) =>
      axios.get(`${GOOGLE_GMAIL_ENDPOINT}/messages/${message.id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          format: "metadata",
          metadataHeaders: ["Subject", "From"],
        },
      })
    );

    const messageResponses = await Promise.all(messagePromises);

    // Process the metadata into a clean, flat array
    const finalMessages = messageResponses.map((response) => {
      const message = response.data;
      const subjectHeader = message.payload.headers.find(
        (h) => h.name === "Subject"
      );
      const fromHeader = message.payload.headers.find((h) => h.name === "From");

      // Extract sender's name and email from the "From" header
      let senderName = "Unknown";
      let senderEmail = "";
      if (fromHeader) {
        const fromValue = fromHeader.value;
        const emailMatch = fromValue.match(/<(.*)>/);
        if (emailMatch) {
          senderEmail = emailMatch[1];
          senderName = fromValue.replace(/<.*>/, "").trim() || senderEmail;
        } else {
          senderEmail = fromValue;
          senderName = fromValue;
        }
      }

      return {
        messageId: message.id,
        threadId: message.threadId,
        time: message.internalDate,
        labelIds: message.labelIds,
        isRead: !message.labelIds.includes("UNREAD"),
        subject: subjectHeader ? subjectHeader.value : "(No Subject)",
        sender: {
          name: senderName,
          email: senderEmail,
        },
      };
    });

    return {
      messages: finalMessages,
      nextPageToken: nextPageToken || "",
      resultSizeEstimate,
    };
  } catch (error) {
    console.error(
      "Error fetching or processing messages:",
      error.response?.data || error.message
    );
    throw error;
  }
};

mailRouter.post("/allmail", async (req, res) => {
  try {
    const {
      accessToken,
      inboxPageToken,
      sentPageToken,
      draftsPageToken,
      archivePageToken,
      spamPageToken,
    } = req.body;
    if (!accessToken) {
      return res.status(401).json({ message: "Access token is missing." });
    }

    const [inbox, sent, drafts, archive, spam] = await Promise.all([
      fetchAndProcessMessages(accessToken, inboxPageToken, "in:inbox"),
      fetchAndProcessMessages(accessToken, sentPageToken, "in:sent"),
      fetchAndProcessMessages(accessToken, draftsPageToken, "in:drafts"),
      fetchAndProcessMessages(accessToken, archivePageToken, "in:archive"),
      fetchAndProcessMessages(accessToken, spamPageToken, "in:spam"),
    ]);

    res.status(200).json({
      inbox,
      sent,
      drafts,
      archive,
      spam,
    });
  } catch (error) {
    if (error.response) {
      res
        .status(error.response.status)
        .json({ message: "API error", details: error.response.data });
    } else if (error.request) {
      res.status(503).json({ message: "Service unavailable." });
    } else {
      res.status(500).json({ message: "An unexpected error occurred." });
    }
  }
});

module.exports = mailRouter;
