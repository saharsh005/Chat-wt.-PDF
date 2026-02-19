import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔴 FORCE dotenv to load from backend/.env
dotenv.config({ path: path.join(__dirname, ".env") });

console.log("SERVER ENV CHECK:", process.env.SUPABASE_URL);

import express from "express";
// import dotenv from "dotenv";
import cors from "cors";
import Groq from "groq-sdk";

// ✅ 1. Load env FIRST
// dotenv.config();

// ✅ 2. Create app BEFORE using it
const app = express();

// ✅ 3. Core middleware
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Optional but safe
//app.options("*", cors());

// ✅ 4. Gemini sanity check (optional, safe to keep)

// const groq = new Groq({
//   apiKey: process.env.GROQ_API_KEY,
// });

// (async () => {
//   try {
//     const stream = await groq.chat.completions.create({
//       model: "llama-3.1-8b-instant",
//       messages: [
//         { role: "user", content: "hi" }
//       ],
//       stream: true,
//     });

//     for await (const chunk of stream) {
//       const text = chunk.choices[0]?.delta?.content || "";
//       if (text) {
//         console.log("Groq test:", text);
//       }
//     }
//   } catch (err) {
//     console.error("Server AI test failed:", err.message);
//   }
// })();


// ✅ 5. Import routes AFTER dotenv
import upload from "./routes/upload.js";
import chat from "./routes/chat.js";
import quiz from "./routes/quiz.js";
import explain from "./routes/explain.js";
import summary from "./routes/summary.js";
import { clerkAuth } from "./middleware/auth.js";
import pdfRoutes from "./routes/pdf.js";

// ✅ 6. Routes
app.use("/pdf", pdfRoutes);
app.use("/chat",  chat);
app.use("/quiz", clerkAuth, quiz);
app.use("/explain", explain);
app.use("/summary", summary);
app.use("/upload", clerkAuth,  upload);

// ✅ 7. Health check (IMPORTANT for debugging)
app.get("/", (req, res) => {
  res.json({ status: "Backend running 🚀" });
});

// ✅ 8. Start server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
