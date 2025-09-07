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
    const { accessToken, selectedPageId, selectedTab } = req.body;
    if (!accessToken) {
      return res.status(401).json({ message: "Access token is missing." });
    }

    const data = await fetchAndProcessMessages(
      accessToken,
      selectedPageId,
      `in:${selectedTab}`
    );

    res.status(200).json({
      data,
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

const processMessageParts = (parts) => {
  if (!parts) {
    return { type: "text", data: "No message content found." };
  }

  // Find the HTML part first
  const htmlPart = findPart(parts, "text/html");
  if (htmlPart) {
    const data = htmlPart.body.data
      ? Buffer.from(htmlPart.body.data, "base64").toString("utf-8")
      : "";

    // Regex to find the start of a quoted reply in Gmail
    const replyRegex = /<div[^>]*class="[^"]*\bgmail_quote\b[^"]*"/i;
    const match = data.match(replyRegex);

    if (match) {
      // Return only the content before the quoted reply
      return { type: "html", data: data.substring(0, match.index) };
    }

    return { type: "html", data: data };
  }

  // If no HTML is found, fall back to plain text
  const plainTextPart = findPart(parts, "text/plain");
  if (plainTextPart) {
    const data = plainTextPart.body.data
      ? Buffer.from(plainTextPart.body.data, "base64").toString("utf-8")
      : "";

    // Regex for plain text replies (e.g., "On [Date]... wrote:")
    const replyRegex = /^\s*On.*wrote:/im;
    const match = data.match(replyRegex);

    if (match) {
      // Return only the content before the separator
      return { type: "text", data: data.substring(0, match.index) };
    }

    return { type: "text", data: data };
  }

  // If neither is found, return a default message
  return { type: "text", data: "No renderable message content found." };
};

// HELPER 3: Parse headers like To, Cc, Bcc into a structured array
const parseEmailHeader = (headerString) => {
  if (!headerString) return [];
  // Split by comma, but not commas inside quotes
  return headerString.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((entry) => {
    const nameMatch = entry.match(/^(.*?)<.*>$/);
    const emailMatch = entry.match(/<(.*?)>/);

    return {
      name: nameMatch ? nameMatch[1].trim().replace(/"/g, "") : entry.trim(),
      email: emailMatch ? emailMatch[1].trim() : entry.trim(),
    };
  });
};

// MAIN ENDPOINT
mailRouter.post("/getMailData", async (req, res) => {
  try {
    const { messageId, accessToken, threadId } = req.body;
    const jwtToken = req.headers.authorization.split(" ")[1];
    const userEmail = jwt.decode(jwtToken).email;

    // Mark the specific message as read
    await axios.post(
      `${GOOGLE_GMAIL_ENDPOINT}/messages/${messageId}/modify`,
      { removeLabelIds: ["UNREAD"] },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // Fetch the entire thread
    const threadsResponse = await axios.get(
      `${GOOGLE_GMAIL_ENDPOINT}/threads/${threadId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const threadsData = threadsResponse.data;

    if (!threadsData || !threadsData.messages) {
      return res.status(404).json({ message: "Thread not found or is empty." });
    }

    const getHeader = (name, headers) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
      "";

    // Extract the subject from the first message in the thread
    const firstMessageHeaders = threadsData.messages[0].payload.headers;
    const subject = getHeader("Subject", firstMessageHeaders);

    const processedMessages = threadsData.messages.map((message) => {
      const headers = message.payload.headers;

      const fromHeader = getHeader("From", headers);
      const toHeader = getHeader("To", headers);
      const ccHeader = getHeader("Cc", headers);
      const bccHeader = getHeader("Bcc", headers); // Will only be present for sent mail

      const isSent = fromHeader.includes(userEmail);
      const senderInfo = parseEmailHeader(fromHeader)[0] || {};

      // Check if the current user received this email because they were on the BCC list
      const wasBcced = message.labelIds?.includes("BCC") || false;

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
        senderName: senderInfo.name,
        senderEmail: senderInfo.email,
        isSent,
        message: processMessageParts(
          message.payload.parts || [message.payload]
        ),
        to: parseEmailHeader(toHeader),
        cc: parseEmailHeader(ccHeader),
        bcc: parseEmailHeader(bccHeader), // Will be empty for received mail
        wasBcced: wasBcced, // True if you received it via BCC
        attachments,
        time: message.internalDate,
        labels: message.labelIds,
        isStarred,
      };
    });

    res.status(200).json({
      threadId: threadId,
      subject: subject,
      threads: processedMessages,
    });
  } catch (error) {
    if (error.response) {
      res
        .status(error.response.status)
        .json({ message: "API error", details: error.response.data });
    } else if (error.request) {
      res.status(503).json({ message: "Service unavailable." });
    } else {
      console.error("Unexpected error:", error); // Log the full error for debugging
      res.status(500).json({ message: "An unexpected error occurred." });
    }
  }
});

module.exports = mailRouter;

mailRouter.post("/nextMailSet", async (req, res) => {
  try {
    const { accessToken, type, nextPageToken } = req.body;
    if (!accessToken) {
      return res.status(401).json({ message: "Access token is missing." });
    }

    const fetchedData = await fetchAndProcessMessages(
      accessToken,
      nextPageToken,
      `in:${type}`
    );
    res.status(200).json(fetchedData);
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

// Helper function to recursively find the correct part by attachmentId
const findAttachmentPart = (parts, { attachmentId, mimeType, filename }) => {
  if (!parts) return null;

  for (const part of parts) {
    // Primary check: Find by attachmentId (most reliable for attachments)
    if (attachmentId && part.body && part.body.attachmentId === attachmentId) {
      console.log(attachmentId, "attachmentId");
      return part;
    }
    // Secondary check: Find by filename (useful for finding parts in the main message)
    if (filename && part.filename === filename) {
      return part;
    }
    // Tertiary check: Find by MIME type (useful for finding the text/html body)
    if (mimeType && part.mimeType === mimeType) {
      return part;
    }

    // Recursively check nested parts
    if (part.parts) {
      const found = findPart(part.parts, { attachmentId, mimeType, filename });
      if (found) return found;
    }
  }

  return null;
};

mailRouter.post("/getAttachment", async (req, res) => {
  try {
    const { accessToken, messageId, attachmentId, fileName } = req.body;

    if (!accessToken || !messageId || !attachmentId) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    const messageResponse = await axios.get(
      `${GOOGLE_GMAIL_ENDPOINT}/messages/${messageId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const messageData = messageResponse.data;
    const attachmentPart = findAttachmentPart(messageData.payload.parts, {
      attachmentId: attachmentId,
      filename: fileName,
    });

    if (!attachmentPart) {
      return res.status(404).json({ message: "Attachment not found." });
    }

    const mimeType = attachmentPart.mimeType;
    const filename = attachmentPart.filename || "attachment";

    const attachmentResponse = await axios.get(
      `${GOOGLE_GMAIL_ENDPOINT}/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const base64Data = attachmentResponse.data.data;
    const decodedData = Buffer.from(base64Data, "base64");

    // CRITICAL: Set the headers to trigger a download
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(decodedData);
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
