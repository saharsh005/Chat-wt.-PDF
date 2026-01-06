import express from "express";
import { GoogleGenAI } from "@google/genai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";

const router = express.Router();

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

router.post("/", async (req, res) => {
  try {
    const { pdfId, question } = req.body;
    
    console.log("🚀 Chat:", { pdfId, question: question.substring(0, 50) + "..." });

    if (!pdfId || !question) {
      return res.status(400).json({ error: "pdfId and question required" });
    }

    // Search relevant chunks
    const queryVector = await getEmbedding(question);
    const hits = await qdrant.search("pdf_chunks", {
      vector: queryVector,
      limit: 12,
      with_payload: true,
      filter: {
        must: [{ key: "pdfId", match: { value: pdfId } }]
      }
    });

    console.log("📊 Found", hits.length, "chunks");

    if (!hits.length) {
      return res.json({ answer: "No relevant content found in document." });
    }

    // Build context
    const context = hits.map(h => h.payload.text).join("\n\n---\n\n");
    console.log("📄 Context:", context.length, "chars");

    // Generate answer
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
      safetySettings: [  // Disable length truncation
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }
      ],
      contents: [{
        role: "user",
        parts: [{
          text: `You are an EXPERT TECHNICAL TUTOR teaching from this EXACT document.

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

**USER QUESTION:** ${question}

---

**${"=".repeat(20)} FULL TUTORIAL (${600}+ WORDS) ${"=".repeat(20)}**

Write comprehensive tutorial now:` 
        }]
      }]
    });

    const answer = response.text || "No response generated";

    res.json({
      answer,
      sources: hits.map(h => ({
        page: h.payload.page,
        score: Math.round(h.score * 100),
        preview: h.payload.text.substring(0, 100) + "..."
      })),
      chunkCount: hits.length
    });

  } catch (err) {
    console.error("❌ Chat error:", err.message);
    res.status(500).json({ error: "Chat failed", debug: err.message });
  }
});

export default router;
