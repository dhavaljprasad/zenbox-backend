const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
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
    const { accessToken, selectedPageId } = req.body;
    if (!accessToken) {
      return res.status(401).json({ message: "Access token is missing." });
    }

    const [inbox, sent, drafts, archive, spam] = await Promise.all([
      fetchAndProcessMessages(accessToken, selectedPageId, "in:inbox"),
      fetchAndProcessMessages(accessToken, selectedPageId, "in:sent"),
      fetchAndProcessMessages(accessToken, selectedPageId, "in:drafts"),
      fetchAndProcessMessages(accessToken, selectedPageId, "in:archive"),
      fetchAndProcessMessages(accessToken, selectedPageId, "in:spam"),
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

// Helper to recursively find and process all message parts
const processMessageParts = (parts) => {
  let processed = [];
  if (!parts) return processed;

  // First, check for an HTML part
  const htmlPart = findPart(parts, "text/html");
  if (htmlPart) {
    const data = htmlPart.body.data
      ? Buffer.from(htmlPart.body.data, "base64").toString("utf-8")
      : "";
    processed.push({ type: htmlPart.mimeType, data: data });
    return processed; // Return immediately with just the HTML part
  }

  // If no HTML is found, fall back to plain text
  const plainTextPart = findPart(parts, "text/plain");
  if (plainTextPart) {
    const data = plainTextPart.body.data
      ? Buffer.from(plainTextPart.body.data, "base64").toString("utf-8")
      : "";
    processed.push({ type: plainTextPart.mimeType, data: data });
    return processed; // Return with just the plain text part
  }

  // If neither is found, return other parts
  // (This handles cases where the message is just an attachment, for example)
  for (const part of parts) {
    if (part.body.data) {
      processed.push({ type: part.mimeType, data: part.body.data });
    }
    if (part.parts) {
      processed = processed.concat(processMessageParts(part.parts));
    }
  }

  return processed;
};

// You will also need this helper function to find a specific part recursively
const findPart = (parts, mimeType) => {
  if (!parts) return null;
  for (const part of parts) {
    if (part.mimeType === mimeType) {
      return part;
    }
    if (part.parts) {
      const found = findPart(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
};

mailRouter.post("/getMailData", async (req, res) => {
  try {
    const { accessToken, threadId } = req.body;
    const jwtToken = req.headers.authorization.split(" ")[1];
    const userEmail = jwt.decode(jwtToken).email;

    const threadsResponse = await axios.get(
      `${GOOGLE_GMAIL_ENDPOINT}/threads/${threadId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const threadsData = threadsResponse.data;

    if (!threadsData || !threadsData.messages) {
      return res.status(404).json({ message: "Thread not found or is empty." });
    }

    const processedMessages = threadsData.messages.map((message) => {
      const headers = message.payload.headers;

      const getHeader = (name) =>
        headers.find((h) => h.name === name)?.value || "";

      const fromHeader = getHeader("From");
      const toHeader = getHeader("To");

      const isSent = fromHeader.includes(userEmail);
      const senderName = fromHeader.replace(/<.*?>/, "").trim() || fromHeader;

      // Extract sender's email using a regular expression
      const senderEmail = /<(.*?)>/.exec(fromHeader)?.[1] || "";

      const receiverName = toHeader.replace(/<.*?>/, "").trim() || toHeader;

      const attachments = (message.payload.parts || [])
        .filter((part) => part.filename && part.filename.length > 0)
        .map((part) => ({
          filename: part.filename,
          attachmentId: part.body.attachmentId,
          size: part.body.size,
        }));

      const isStarred = message.labelIds?.includes("STARRED") || false;

      return {
        id: message.id,
        senderName,
        senderEmail,
        receiverName,
        isSent,
        message: processMessageParts(
          message.payload.parts || [message.payload]
        ),
        attachments,
        time: message.internalDate,
        labels: message.labelIds,
        isStarred,
      };
    });

    res.status(200).json(processedMessages);
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
