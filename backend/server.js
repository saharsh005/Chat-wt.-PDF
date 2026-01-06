import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// ✅ dotenv.config() ONLY ONCE, at the very top
dotenv.config();

console.log("✅ Server startup - GOOGLE_API_KEY length:", process.env.GOOGLE_API_KEY?.length || 0);

// ✅ Pass apiKey explicitly
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY
});

async function main() {
  try {
    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash-lite",
      contents: [{ parts: [{ text: "hi" }] }]
    });

    for await (const chunk of response) {
      console.log("Gemini test:", chunk.text);
    }
  } catch (err) {
    console.error("Server AI test failed:", err.message);
  }
}

await main();

const app = express();
app.use(express.json());

// ✅ Import routes AFTER dotenv
import upload from "./routes/upload.js";
import chat from "./routes/chat.js";
import quiz from "./routes/quiz.js";
import explain from "./routes/explain.js";
import summary from "./routes/summary.js";

app.use("/chat", chat);
app.use("/quiz", quiz);
app.use("/explain", explain);
app.use("/summary", summary);
app.use("/upload", upload);

app.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
