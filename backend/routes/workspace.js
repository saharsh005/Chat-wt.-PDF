import express from "express";
import Groq from "groq-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { clerkAuth } from "../middleware/auth.js";
import { supabase } from "../utils/supabase.js";
import { buildGapsPrompt, buildAbstractPrompt } from "../rag/prompts.js";

const router = express.Router();
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });

let ai = null;
function getAi() {
  if (!ai) ai = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return ai;
}

// ── CREATE ──────────────────────────────────────────────────────────────────

router.post("/", clerkAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.auth.userId;
    if (!title?.trim()) return res.status(400).json({ error: "Workspace title required" });

    await supabase.from("users").upsert({ clerk_id: userId }, { onConflict: "clerk_id" });

    const { data, error } = await supabase
      .from("workspaces")
      .insert({ clerk_id: userId, title: title.trim() })
      .select("id, title, created_at")
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── LIST ────────────────────────────────────────────────────────────────────

router.get("/", clerkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("workspaces").select("id, title, created_at")
      .eq("clerk_id", req.auth.userId).order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET SINGLE ──────────────────────────────────────────────────────────────

router.get("/:id", clerkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("workspaces").select("id, title, created_at")
      .eq("id", req.params.id).eq("clerk_id", req.auth.userId).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ──────────────────────────────────────────────────────────────────

router.delete("/:id", clerkAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("workspaces").delete()
      .eq("id", req.params.id).eq("clerk_id", req.auth.userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PDFs ────────────────────────────────────────────────────────────────────

router.get("/:id/pdfs", clerkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("user_pdfs").select("pdf_id, filename, uploaded_at, storage_path")
      .eq("workspace_id", req.params.id).eq("clerk_id", req.auth.userId)
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CHATS ────────────────────────────────────────────────────────────────────

router.get("/:id/chats", clerkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("chats").select("id, title, created_at")
      .eq("workspace_id", req.params.id).eq("clerk_id", req.auth.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── RESEARCH GAPS ────────────────────────────────────────────────────────────

router.get("/:id/research-gaps", clerkAuth, async (req, res) => {
  try {
    const { id: workspaceId } = req.params;
    const userId = req.auth.userId;

    const { data: ws, error: wsErr } = await supabase
      .from("workspaces").select("id").eq("id", workspaceId).eq("clerk_id", userId).single();
    if (wsErr || !ws) return res.status(404).json({ error: "Workspace not found" });

    const { data: pdfs } = await supabase
      .from("user_pdfs").select("pdf_id").eq("workspace_id", workspaceId).eq("clerk_id", userId);
    if (!pdfs?.length) return res.json([]);

    const collectionName = `pdfs_${userId}`;
    const { points: chunks } = await qdrant.scroll(collectionName, {
      filter: { must: [{ key: "workspaceId", match: { value: workspaceId } }] },
      limit: 80,
      with_payload: true,
    });

    if (!chunks?.length) return res.json([]);

    // Group by PDF for citation tracking
    const pdfGroups = {};
    for (const c of chunks) {
      const pid = c.payload.pdfId;
      if (!pdfGroups[pid]) pdfGroups[pid] = [];
      pdfGroups[pid].push(c.payload.text);
    }

    // Fetch filenames
    const { data: pdfMeta } = await supabase
      .from("user_pdfs").select("pdf_id, filename").eq("workspace_id", workspaceId);
    const pdfNameMap = Object.fromEntries((pdfMeta || []).map(p => [p.pdf_id, p.filename]));

    const combinedText = chunks.map(c => c.payload.text).join("\n\n---\n\n");

    const prompt = buildGapsPrompt(combinedText);

    const completion = await getAi().chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    const gaps = parsed.gaps || [];

    // Attach source citations: find which PDF chunks relate to each gap
    const gapsWithCitations = gaps.map((gap, i) => ({
      ...gap,
      id: `gap-${i}`,
      citations: Object.entries(pdfGroups).slice(0, 3).map(([pid]) => ({
        pdfId: pid,
        filename: pdfNameMap[pid] || pid,
      })),
    }));

    return res.json(gapsWithCitations);
  } catch (err) {
    console.error("Research gaps error:", err);
    res.status(500).json({ error: "Failed to generate research gaps" });
  }
});

// ── GENERATE ABSTRACT ────────────────────────────────────────────────────────

router.post("/:id/generate-abstract", clerkAuth, async (req, res) => {
  try {
    const { id: workspaceId } = req.params;
    const userId = req.auth.userId;
    const { gapTitle, gapDescription } = req.body;
    if (!gapTitle) return res.status(400).json({ error: "gapTitle required" });

    const { data: ws, error: wsErr } = await supabase
      .from("workspaces").select("id").eq("id", workspaceId).eq("clerk_id", userId).single();
    if (wsErr || !ws) return res.status(404).json({ error: "Workspace not found" });

    const { data: pdfMeta } = await supabase
      .from("user_pdfs").select("pdf_id, filename").eq("workspace_id", workspaceId);

    const collectionName = `pdfs_${userId}`;
    const { points: chunks } = await qdrant.scroll(collectionName, {
      filter: { must: [{ key: "workspaceId", match: { value: workspaceId } }] },
      limit: 50,
      with_payload: true,
    });

    const contextText = (chunks || []).map(c => c.payload.text).join("\n\n---\n\n");
    const prompt = buildAbstractPrompt(gapTitle, gapDescription, contextText, pdfMeta?.length || 0);

    const completion = await getAi().chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 1500,
    });

    res.json({
      abstract: completion.choices[0].message.content,
      sourceDocs: (pdfMeta || []).map(p => p.filename),
    });
  } catch (err) {
    console.error("Abstract error:", err);
    res.status(500).json({ error: "Failed to generate abstract" });
  }
});

export default router;
