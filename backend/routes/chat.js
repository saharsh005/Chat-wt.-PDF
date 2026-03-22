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
    const { workspaceId } = req.body;
    const userId = req.auth.userId;

    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const { data: newChat, error } = await supabase
      .from('chats')
      .insert({
        clerk_id: userId,
        workspace_id: workspaceId,
        title: "Research Chat"
      })
      .select('id, title, workspace_id, created_at')
      .single();

    if (error) throw error;

    console.log('🆕 Created workspace chat');
    res.json(newChat);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



router.post("/", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { question, chatId } = req.body; // ← NO 'let chatDbId'

    console.log("🚀 Chat:", { question: question.substring(0, 50) + "...", chatId });

    // 🔥 REPLACE entire validation - NO auto-create, NO chatDbId
    if (!question || !chatId) {
      return res.status(400).json({
        error: "Missing required fields",
        received: { chatId, question: !!question }
      });
    }

    const { data: chatData } = await supabase
      .from("chats")
      .select("workspace_id")
      .eq("id", chatId)
      .single();

    if (!chatData) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const workspaceId = chatData.workspace_id;


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
    
    // 🔍 SEARCH: Get more chunks for broader context across multiple PDFs
    let hits = await qdrant.search(collectionName, {
      vector: queryVector,
      limit: 8, // Increased from 3
      with_payload: true,
      filter: {
        must: [
          { key: "workspaceId", match: { value: workspaceId } }
        ]
      }
    });

    console.log("📊 Workspace chunks found:", hits.length);

    // Build context
    const context = hits.map(h => h.payload.text).join("\n\n---\n\n");

    const finalPrompt = `
    You are an expert technical tutor and experienced researcher.

    Your task is to explain the user's question using ONLY the information present in the provided document content.
    Do NOT use any external knowledge.

    ### Response Guidelines:
    1. **Structure**: Use clear Markdown headers (e.g., ### Section, #### Subsection) to organize your thoughts.
    2. **Readability**: Break your answer into clear, digestible paragraphs. Avoid long walls of text.
    3. **Emphasis**: Use **bold text** for important terms, concepts, or key findings.
    4. **Tone**: Maintain a professional, academic yet accessible tone, similar to a high-quality research assistant or ChatGPT.
    5. **Clarity**: Explain concepts from a foundational level to more advanced insights.
    6. **JSON Format**: You MUST respond in valid JSON format exactly matching the structure below.

    ### JSON Structure:
    {
      "answer": "Your detailed explanation string here, heavily using Markdown for structure, bolding, and spacing...",
      "gaps": [
        {
          "type": "METHODOLOGICAL GAP",
          "title": "Short descriptive title of the gap",
          "description": "Detailed explanation of what the gap is and why it exists based on the text."
        }
      ]
    }

    Follow these rules strictly:
    - Include short and relevant code examples ONLY if directly present in the text and necessary.
    - End the answer with a "### Summary and Key Takeaways" section.
    - Do not invent information outside the document.
    - Output ONLY valid JSON, starting with { and ending with }.

    Recent conversation context:
    ${historyText}

    Document content to use as the ONLY source:
    ${context.substring(0, 18000)}

    User question:
    ${question}

    Now write the clean, structured, and beautifully formatted JSON object as requested.
    `;

    const client = getAiClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: finalPrompt }],
      temperature: 0.3,
      max_tokens: 6000,
      response_format: { type: "json_object" }
    });

    let aiResponse;
    try {
      aiResponse = JSON.parse(completion.choices[0].message.content);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      aiResponse = { answer: completion.choices[0].message.content, gaps: [] };
    }

    const answer = aiResponse.answer || "No logical answer generated.";
    const gaps = aiResponse.gaps || [];

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

    await supabase
    .from("chats")
    .update({ updated_at: new Date() })
    .eq("id", chatId);


    // 🎯 REFINED SOURCES: Filter by score + De-duplicate by (pdfId, page)
    const uniqueSources = [];
    const sourceKeys = new Set();

    for (const h of hits) {
      if (h.score < 0.35) continue; // Skip low-confidence matches

      const key = `${h.payload.pdfId}_${h.payload.page}`;
      if (!sourceKeys.has(key)) {
        sourceKeys.add(key);
        uniqueSources.push({
          page: h.payload.page,
          pdfId: h.payload.pdfId,
          score: Math.round(h.score * 100),
          preview: h.payload.text.substring(0, 100) + "..."
        });
      }
      if (uniqueSources.length >= 5) break; // Limit to 5 diverse sources
    }

    res.json({
      chatId,
      answer,
      gaps,
      page: uniqueSources[0]?.page || 1,
      sources: uniqueSources,
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
      .select("id, title, workspace_id, created_at")
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
      .select("id, title, workspace_id, created_at")
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

router.get('/:id/pdfs', clerkAuth, async (req, res) => {
  try {
    const chatId = req.params.id;

    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID is required' });
    }

    // 🔐 Get user from Clerk middleware (assumed you already have this)
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ✅ Step 1: Verify chat belongs to user
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, workspace_id, clerk_id')
      .eq('id', chatId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.clerk_id !== clerkId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ✅ Step 2: Fetch PDFs linked to this chat's workspace
    const { data: pdfs, error: pdfError } = await supabase
      .from('user_pdfs')
      .select('pdf_id, filename, storage_path, workspace_id, uploaded_at')
      .eq('workspace_id', chat.workspace_id);

    if (pdfError) {
      console.error('❌ PDF fetch error:', pdfError);
      return res.status(500).json({ error: 'Failed to fetch PDFs' });
    }

    return res.json(pdfs);

  } catch (err) {
    console.error('🔥 GET /chat/:id/pdfs error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
});


export default router;
