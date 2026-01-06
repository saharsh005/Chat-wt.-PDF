import express from "express";
import { ChatOpenAI } from "@langchain/openai";

const router = express.Router();
const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

router.post("/", async (req, res) => {
  const { text, style } = req.body;

  const prompt = `
Explain the following text.

Style: ${style}
Include a simple Mermaid diagram if possible.

TEXT:
${text}
`;

  const result = await llm.predict(prompt);
  res.json({ explanation: result });
});

export default router;
