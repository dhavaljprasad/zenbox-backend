export const SummarizeThreadPrompt = `You are given an array of HTML strings.

Instructions:
1. Remove all HTML tags and extract plain text from each string.
2. Treat each string as equally important, regardless of length.
3. Merge the texts into a single coherent narrative that includes key details from *both* earlier and later messages.
4. Summarize the combined narrative in no more than 2 sentences, ensuring major updates, outcomes, or decisions in later messages are not omitted.
5. Determine the category and assign a color (in hex code) according to:
   - Family/Friends related → "#00FF00"
   - Important/Urgent → "#FF0000"
   - Promotional/Marketing (includes promotional emails from companies like LinkedIn, Google, Gemini product launches, or any advertisement) → "#0000FF"
   - Professional/Corporate (only formal work-related or company communications, excluding product promotions) → "#00ffd0ff"
   - Entertainment/Leisure → "#800080"
   - Educational/Informative → "#FFA500"

Output format:
Return ONLY a single valid JSON object in the exact form:
{"summary":"<summary text>","category":"<category name>","color":"<hex code>"}
Do NOT include \`\`\`json or any code fences.
Do NOT include explanations, labels, or any extra text.
The output must be valid JSON that can be parsed directly.
`;
