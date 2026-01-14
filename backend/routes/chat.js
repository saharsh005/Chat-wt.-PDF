import express from "express";
//import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { clerkAuth } from "../middleware/auth.js";
import { supabase } from "../utils/supabase.js";

const router = express.Router();

// In‑memory chat sessions: Map<chatId, { userId, messages: [{role, content}] }>
const sessions = new Map();

let ai = null;
function getAiClient() {
  if (!ai) {
    ai = new Groq({  // ✅ Already correct
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return ai;  // ✅ Returns client instance
}


const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

router.post("/", clerkAuth, async (req, res) => {
    try {
      const userId = req.auth.userId;  // ✅ "user_37sbSBCIlkR8psSwoF9tqKDEDy5"
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

    console.log("🔍 Searching collection:", collectionName);
    console.log("🔍 For pdfId:", pdfId);

    // Test collection exists + has data
    const collections = await qdrant.getCollections();
    console.log("📋 All collections:", collections.collections.map(c => c.name));


    if (!hits.length) {
      return res.json({ answer: "No relevant content found in document.", chatId: sessionKey });
    }

    // 6) Build context from chunks
    const context = hits.map(h => h.payload.text).join("\n\n---\n\n");
    console.log("📄 Context:", context.length, "chars");

    // 7) Build final prompt: history + document context
    const finalPrompt = `
    You are an expert technical tutor.

    Your task is to explain the user's question using ONLY the information present in the provided document content.
    Do NOT use any external knowledge.

    Use a clear, simple, and structured explanation that is easy to understand.
    The response should be moderately detailed, not overly long, and not too brief.

    Follow these rules strictly:
    - Use clear section titles (no symbols, no markdown characters like *, #, or ---)
    - Explain concepts from beginner level to slightly advanced level
    - Include short and relevant code examples only where necessary
    - Use simple language and direct explanations
    - Keep the response well-organized and readable
    - End with a short summary and key takeaways
    - Do not repeat content unnecessarily
    - Do not invent information outside the document

    Recent conversation context:
    ${historyText}

    Document content to use as the ONLY source:
    ${context.substring(0, 18000)}

    User question:
    ${question}

    Now write a clean, structured explanation that directly answers the user's question based only on the document.
    `;

    // 8) Call Groq with your existing detailed config
    // ✅ CORRECT:
    const client = getAiClient();  // Your existing function

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",  // ✅ Correct model name
      messages: [
        {
          role: "user",
          content: finalPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 6000,
      top_p: 0.9,
      stream: false
    });

    const answer = completion.choices[0].message.content || "No response generated";

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

    // 10) Save to Supabase (FIXED)
    try {
      let chatDbId = chatId;
      
      // Create chat if new (no chatId)
      if (!chatId) {
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({
            user_id: userId,  // "user_37sbSBCIlkR8psSwoF9tqKDEDy5"
            pdf_id: pdfId,
            title: question.substring(0, 50) + '...'
          })
          .select('id')
          .single();
        
        if (chatError) throw chatError;
        chatDbId = newChat.id;
        session.chatId = chatDbId;  // Store for future
      }

      // Save messages with VALID chat_id
      await supabase
        .from('messages')
        .insert([
          { chat_id: chatDbId, role: 'user', content: question },
          { chat_id: chatDbId, role: 'assistant', content: answer }
        ]);
      
      console.log('💾 Saved chat/messages:', chatDbId);
    } catch (dbErr) {
      console.error('DB save failed:', dbErr.message);
    }



  } catch (err) {
    console.error("❌ Chat error:", err.message);
    res.status(500).json({ error: "Chat failed", debug: err.message });
  }
});

router.get("/", clerkAuth, async (req, res) => {
  try {
    // ✅ Direct query by Clerk user_id (TEXT)
    const { data, error } = await supabase
      .from("chats")
      .select("id, title, created_at")
      .eq("user_id", req.auth.userId)  // Full "user_xxx"
      .order("created_at", { ascending: false });

    res.json(data || []);
  } catch (err) {
    console.error("Chat list error:", err);
    res.json([]);
  }
});




export default router;

// // Add this line:
// module.exports = router;

