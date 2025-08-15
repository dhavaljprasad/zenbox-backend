const express = require("express");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

const { SummarizeThreadPrompt } = require("./prompts");

const aiRouter = express.Router();

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

aiRouter.post("/threadSummary", async (req, res) => {
  try {
    const { dataArray } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [
        {
          text: `${SummarizeThreadPrompt} here's your array of html strings: ${dataArray}`,
        },
      ],
    });
    const rawResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    res.json(rawResponse);
  } catch (error) {
    console.error("Error generating summary:", error);
    res
      .status(500)
      .json({ message: "An error occurred while generating the summary." });
  }
});

module.exports = aiRouter;
