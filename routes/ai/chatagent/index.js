const express = require("express");
const dotenv = require("dotenv");
const { InterpretStepOne } = require("./functions.js");

const aiAgentChat = express.Router();

dotenv.config();

aiAgentChat.post("/", async (req, res) => {
  try {
    const { accessToken, chatSummary, message } = req.body;

    // Interpreting Step One
    const interpret_res = await InterpretStepOne(chatSummary, message);

    res.json({ interpret_res });
  } catch (error) {
    console.error("Error generating summary:", error);
    res
      .status(500)
      .json({ message: "An error occurred while generating the summary." });
  }
});

module.exports = aiAgentChat;
