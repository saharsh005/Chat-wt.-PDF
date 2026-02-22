import express from "express";
import Groq from "groq-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { clerkAuth } from "../middleware/auth.js";
import { supabase } from "../utils/supabase.js";

const router = express.Router();

let ai = null;
function getAiClient() {
  if (!ai) {
    ai = new Groq({ 
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return ai;
}

const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

// ADD THIS NEW ROUTE
router.post('/create', clerkAuth, async (req, res) => {
  try {
    const { pdfId } = req.body;
    const userId = req.auth.userId;
    
    const { data: pdfData } = await supabase
      .from('user_pdfs')
      .select('filename')
      .eq('pdf_id', pdfId)
      .single();

    const pdfName = pdfData?.filename?.replace('.pdf', '') || 'Document';
    
    const { data: newChat, error } = await supabase
      .from('chats')
      .insert({
        clerk_id: userId,
        pdf_id: pdfId,
        title: pdfName.substring(0, 50)
      })
      .select('id, title, pdf_id, created_at')
      .single();
    
    if (error) throw error;
    
    console.log('🆕 Created chat:', newChat.title);
    res.json(newChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post("/", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { pdfId, question, chatId } = req.body; // ← NO 'let chatDbId'

    console.log("🚀 Chat:", { pdfId, question: question.substring(0, 50) + "...", chatId });

    // 🔥 REPLACE entire validation - NO auto-create, NO chatDbId
    if (!question || !chatId || !pdfId) {
      return res.status(400).json({
        error: "Missing required fields",
        received: { pdfId, chatId, question: !!question }
      });
    }


    // Use chatId directly - NO chatDbId variable needed
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chatId)  // ← Use chatId directly
      .order("created_at", { ascending: false })
      .limit(6);
    const historyText = recentMessages?.reverse().map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n") || "";

    const collectionName = `pdfs_${userId}`;
    const queryVector = await getEmbedding(question);

    // 🔍 SMART SEARCH: Try exact pdfId FIRST, fallback to best chunks
    let hits = await qdrant.search(collectionName, {
      vector: queryVector,
      limit: 3,
      with_payload: true,
      filter: {
        must: [{ key: "pdfId", match: { value: pdfId } }]
      }
    });

    console.log("📊 Exact pdfId chunks:", hits.length);

    // FALLBACK: If no exact match, use BEST chunks regardless of pdfId
    if (!hits.length) {
      console.log("⚠️ No chunks for pdfId, using best matches...");
      hits = await qdrant.search(collectionName, {
        vector: queryVector,
        limit: 3,
        with_payload: true
      });
      console.log("📊 Fallback chunks:", hits.length);
    }

    if (!hits.length) {
      const answer = "No content found in your documents. Please upload a new PDF.";
      await supabase.from('messages').insert([
        { chat_id: chatId, role: 'user', content: question },
        { chat_id: chatId, role: 'assistant', content: answer }
      ]);
      return res.json({ chatId, answer, sources: [], chunkCount: 0 });
    }

    // 🔎 Extract page numbers from retrieved chunks
    const pagesUsed = [
      ...new Set(
        hits
          .map(h => h.payload?.page)
          .filter(p => p !== undefined && p !== null)
      )
    ].sort((a, b) => a - b);

    // 🖨 Console log page numbers
    if (pagesUsed.length) {
      console.log(`📄 Answer derived from pages: ${pagesUsed.join(", ")}`);
    } else {
      console.log("📄 No page metadata available in retrieved chunks");
    }

    // Build context
    const context = hits.map(h => h.payload.text).join("\n\n---\n\n");

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

        const client = getAiClient();
        const completion = await client.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: finalPrompt }],
          temperature: 0.3,
          max_tokens: 6000
        });

    const answer = completion.choices[0].message.content;

    await supabase.from('messages').insert([
      { chat_id: chatId, role: 'user', content: question },
      { chat_id: chatId, role: 'assistant', content: answer }
    ]);

    // // Count page frequency
    // const pageFrequency = {};

    // hits.forEach(hit => {
    //   const p = hit.payload?.page;
    //   if (p !== undefined && p !== null) {
    //     pageFrequency[p] = (pageFrequency[p] || 0) + 1;
    //   }
    // });

    // // Get page with highest frequency
    // const dominantPage = Object.entries(pageFrequency)
    //   .sort((a, b) => b[1] - a[1])[0]?.[0];

    // console.log("🎯 Dominant answer page:", dominantPage);

    res.json({
      chatId,
      answer,
      page: hits[0]?.payload?.page || 1,
      sources: hits.slice(0, 5).map(h => ({
        page: h.payload.page,
        pdfId: h.payload.pdfId,
        score: Math.round(h.score * 100),
        preview: h.payload.text.substring(0, 100) + "..."
      })),
      chunkCount: hits.length
    });

    console.log("Top hit page:", hits[0]?.payload?.page);



  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: "Chat failed", debug: err.message });
  }
});

router.get("/", clerkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("id, title, pdf_id, created_at")
      .eq("clerk_id", req.auth.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("Chat list error:", err);
    res.json([]);
  }
});

router.get("/:chatId", clerkAuth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const { data, error } = await supabase
      .from("chats")
      .select("id, title, pdf_id, created_at")
      .eq("id", chatId)
      .eq("clerk_id", req.auth.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json(data);
  } catch (err) {
    console.error("Load chat error:", err.message);
    res.status(500).json({ error: "Failed to load chat" });
  }
});



router.get("/:chatId/messages", clerkAuth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error("Load messages error:", err.message);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

export default router;
