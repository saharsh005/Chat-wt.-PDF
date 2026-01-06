import express from "express";
import { ChatOpenAI } from "@langchain/openai";

const router = express.Router();
const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

router.post("/", async (req, res) => {
  const { chatHistory } = req.body;
  const summary = await llm.predict(`
Summarize what the user learned:
${chatHistory}
`);
  res.json({ summary });
});

export default router;
