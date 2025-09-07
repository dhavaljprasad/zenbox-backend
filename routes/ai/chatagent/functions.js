const { GoogleGenAI } = require("@google/genai");
const { ZenboxPrimaryPrompt } = require("./prompts");

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

const InterpretStepOne = async (summaryMessages, message) => {
  try {
    console.log(summaryMessages, message);
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [
        {
          text: `${ZenboxPrimaryPrompt} Here's the message: ${message}, and here's pastMessageSummary: ${summaryMessages}`,
        },
      ],
    });
    const rawResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    return rawResponse;
  } catch (error) {
    console.error(error);
  }
};

module.exports = { InterpretStepOne };
