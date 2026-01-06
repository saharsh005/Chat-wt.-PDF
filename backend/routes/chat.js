import express from "express";
import { GoogleGenAI } from "@google/genai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { clerkAuth } from "../middleware/clerkAuth.js"; // your Clerk middleware

const router = express.Router();

// In‑memory chat sessions: Map<chatId, { userId, messages: [{role, content}] }>
const sessions = new Map();

let ai = null;
function getAiClient() {
  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY
    });
  }
  return ai;
}

const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

router.post("/", clerkAuth, async (req, res) => {
  try {
    const { userId } = req.user;        // From Clerk JWT
    const { pdfId, question, chatId } = req.body;

    console.log("🚀 Chat:", { pdfId, question: question.substring(0, 50) + "..." });

    if (!pdfId || !question) {
      return res.status(400).json({ error: "pdfId and question required" });
    }

    // 1) Get or init session memory
    let sessionKey = chatId;
    if (!sessionKey) {
      // If no chatId sent, create one using pdf+user combo
      sessionKey = `${userId}:${pdfId}`;
    }

    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, {
        userId,
        messages: []   // { role: 'user'|'assistant', content: string }
      });
    }

    const session = sessions.get(sessionKey);

    // 2) Add current user question to memory (will be used for RAG + prompt)
    session.messages.push({ role: "user", content: question });

    // 3) Build short chat history text (last N messages)
    const historyWindow = 8; // last 8 messages
    const recentMessages = session.messages.slice(-historyWindow);
    const historyText = recentMessages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    // 4) User-specific collection
    const collectionName = `pdfs_${userId}`;

    // 5) Search relevant chunks from Qdrant
    const queryVector = await getEmbedding(question);
    const hits = await qdrant.search(collectionName, {
      vector: queryVector,
      limit: 12,
      with_payload: true,
      filter: {
        must: [{ key: "pdfId", match: { value: pdfId } }]
      }
    });

    console.log("📊 Found", hits.length, "chunks");

    if (!hits.length) {
      return res.json({ answer: "No relevant content found in document.", chatId: sessionKey });
    }

    // 6) Build context from chunks
    const context = hits.map(h => h.payload.text).join("\n\n---\n\n");
    console.log("📄 Context:", context.length, "chars");

    // 7) Build final prompt: history + document context
    const finalPrompt = `You are an EXPERT TECHNICAL TUTOR teaching from this EXACT document.

Below is the recent conversation between you and the user:

${historyText}

Use ONLY the DOCUMENT CHUNKS (SOURCE MATERIAL) below to answer the latest user question at the end.

**MANDATORY REQUIREMENTS:**
1. Write 600-1200 WORDS minimum (count them)
2. Use H1/H2 HEADINGS, BULLETS, NUMBERED LISTS
3. QUOTE 5+ phrases DIRECTLY from chunks below
4. Break down EVERY concept into beginner → advanced
5. Include code examples, explanations, comparisons
6. End with SUMMARY + KEY TAKEAWAYS
7. NO external knowledge - ONLY chunks provided

**DOCUMENT CHUNKS (SOURCE MATERIAL ONLY):**
${context.substring(0, 18000)}

**LATEST USER QUESTION:** ${question}

---

**${"=".repeat(20)} FULL TUTORIAL (${600}+ WORDS) ${"=".repeat(20)}**

Write comprehensive tutorial now:`;

    // 8) Call Gemini with your existing detailed config
    const client = getAiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.3,        // Creative but focused
        maxOutputTokens: 6000,   // MAXIMUM length
        topP: 0.9,
        topK: 50,
        responseMimicPreset: "PROFESSIONAL"  // Formal tutor style
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }
      ],
      contents: [{
        role: "user",
        parts: [{ text: finalPrompt }]
      }]
    });

    const answer = response.text || "No response generated";

    // 9) Save assistant reply to memory
    session.messages.push({ role: "assistant", content: answer });

    res.json({
      chatId: sessionKey,
      answer,
      sources: hits.map(h => ({
        page: h.payload.page,
        score: Math.round(h.score * 100),
        preview: h.payload.text.substring(0, 100) + "..."
      })),
      chunkCount: hits.length,
      historyMessages: session.messages.length
    });

  } catch (err) {
    console.error("❌ Chat error:", err.message);
    res.status(500).json({ error: "Chat failed", debug: err.message });
  }
});

export default router;
