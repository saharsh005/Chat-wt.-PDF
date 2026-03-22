import express from "express";
import Groq from "groq-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { clerkAuth } from "../middleware/auth.js";
import { supabase } from "../utils/supabase.js";

const router = express.Router();
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

let ai = null;
function getAiClient() {
  if (!ai) {
    ai = new Groq({ 
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return ai;
}

/* =========================
   CREATE WORKSPACE
========================= */
router.post("/", clerkAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.auth.userId;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Workspace title required" });
    }

    // Ensure user exists
    await supabase
      .from("users")
      .upsert({ clerk_id: userId }, { onConflict: "clerk_id" });

    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        clerk_id: userId,
        title: title.trim()
      })
      .select("id, title, created_at")
      .single();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error("Workspace create error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GET USER WORKSPACES
========================= */
router.get("/", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const { data, error } = await supabase
      .from("workspaces")
      .select("id, title, created_at")
      .eq("clerk_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);

  } catch (err) {
    console.error("Workspace fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GET SINGLE WORKSPACE
========================= */
router.get("/:id", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("workspaces")
      .select("id, title, created_at")
      .eq("id", id)
      .eq("clerk_id", userId)
      .single();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error("Workspace fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GET WORKSPACE PDFs
========================= */
router.get("/:id/pdfs", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("user_pdfs")
      .select("pdf_id, filename, uploaded_at")
      .eq("workspace_id", id)
      .eq("clerk_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);

  } catch (err) {
    console.error("Workspace PDFs fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GET WORKSPACE CHATS
========================= */
router.get("/:id/chats", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("chats")
      .select("id, title, created_at")
      .eq("workspace_id", id)
      .eq("clerk_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);

  } catch (err) {
    console.error("Workspace chats fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GENERATE WORKSPACE GAPS
========================= */
router.get("/:id/research-gaps", clerkAuth, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.auth.userId;

    // Verify workspace belongs to user
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('clerk_id', userId)
      .single();

    if (wsErr || !ws) return res.status(404).json({ error: "Workspace not found" });

    // 1. Get PDFs for this workspace
    const { data: pdfs, error: pdfErr } = await supabase
      .from('user_pdfs')
      .select('pdf_id')
      .eq('workspace_id', workspaceId)
      .eq('clerk_id', userId);

    if (pdfErr) throw pdfErr;
    if (!pdfs || pdfs.length === 0) return res.json([]);

    const pdfIds = pdfs.map(p => p.pdf_id);

    // 2. Get chunks from Qdrant instead of Supabase
    const collectionName = `pdfs_${userId}`;
    const { points: chunks } = await qdrant.scroll(collectionName, {
      filter: {
        must: [
          { key: "workspaceId", match: { value: workspaceId } }
        ]
      },
      limit: 60,
      with_payload: true
    });

    if (!chunks || chunks.length === 0) return res.json([]);

    // 3. Prepare text
    const combinedText = chunks.map(c => c.payload.text).join('\n\n---\n\n');

    // 4. Call LLM
    const prompt = `
    Based on the following extracted text from research documents in this workspace, identify 3-5 major research gaps.
    Research gaps can be Methodological, Theoretical, Empirical, Application, or Population based.

    Documents:
    ${combinedText.substring(0, 16000)}

    You MUST respond in valid JSON format exactly matching this structure:
    {
      "gaps": [
        {
          "type": "METHODOLOGICAL GAP",
          "title": "Short descriptive title of the gap",
          "description": "Detailed clear explanation."
        }
      ]
    }
    `;

    const client = getAiClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    try {
      const parsed = JSON.parse(completion.choices[0].message.content);
      return res.json(parsed.gaps || []);
    } catch (parseErr) {
      console.error("Gaps parse error:", parseErr);
      return res.json([]);
    }

  } catch (err) {
    console.error("Workspace generic gaps error:", err);
    res.status(500).json({ error: 'Failed to generate research gaps' });
  }
});

/* =========================
   GENERATE ABSTRACT FOR GAP
========================= */
router.post("/:id/generate-abstract", clerkAuth, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.auth.userId;
    const { gapTitle, gapDescription } = req.body;

    if (!gapTitle) return res.status(400).json({ error: "Gap title is required" });

    // Verify workspace belongs to user
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('clerk_id', userId)
      .single();

    if (wsErr || !ws) return res.status(404).json({ error: "Workspace not found" });

    // 1. Get chunks from Qdrant for context
    const collectionName = `pdfs_${userId}`;
    const { points: chunks } = await qdrant.scroll(collectionName, {
      filter: {
        must: [
          { key: "workspaceId", match: { value: workspaceId } }
        ]
      },
      limit: 40,
      with_payload: true
    });

    const contextText = chunks.map(c => c.payload.text).join('\n\n---\n\n');

    // 2. Call LLM to generate abstract
    const prompt = `
    You are an expert academic researcher. Based on the provided context from research documents and a specific research gap, generate a detailed research abstract.
    
    RESEARCH GAP TITLE: ${gapTitle}
    RESEARCH GAP DESCRIPTION: ${gapDescription || "N/A"}
    
    WORKSPACE CONTEXT (Relevant excerpts from existing documents):
    ${contextText.substring(0, 12000)}
    
    The abstract should:
    1. Define the problem and why the identified gap matters.
    2. Propose a potential research objective or methodology to address this gap.
    3. Describe the expected contribution to the field.
    4. Provide context on how it relates to the existing documents in the workspace.
    
    Keep it professional, academic, and around 250-400 words.
    `;

    const client = getAiClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 1500
    });

    const abstract = completion.choices[0].message.content;
    res.json({ abstract });

  } catch (err) {
    console.error("Abstract generation error:", err);
    res.status(500).json({ error: 'Failed to generate abstract' });
  }
});

export default router;
