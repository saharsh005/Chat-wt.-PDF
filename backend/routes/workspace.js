import express from "express";
import Groq from "groq-sdk";
import { clerkAuth } from "../middleware/auth.js";
import { supabase } from "../utils/supabase.js";
import { buildGapsPrompt, buildAbstractPrompt } from "../rag/prompts.js";
import { createQdrantClient } from "../utils/qdrant.js";

const router = express.Router();
const qdrant = createQdrantClient();

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
  // console.log("AUTH DEBUG:", req.auth);
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

// function splitGapText(gapText) {
//   if (!gapText || typeof gapText !== "string") return { title: "", description: "" };
//   const lines = gapText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
//   if (lines.length === 0) return { title: "", description: "" };
//   return {
//     title: lines[0],
//     description: lines.slice(1).join(" ").trim() || "",
//   };
// }

function sampleChunks(allChunks, sampleCount = 8, excerptLen = 150, maxContext = 1600) {
  if (!allChunks?.length) return "";
  const step    = Math.max(1, Math.floor(allChunks.length / sampleCount));
  const sampled = [];
  for (let i = 0; i < allChunks.length && sampled.length < sampleCount; i += step) {
    sampled.push(allChunks[i]);
  }
  // Include last chunk for conclusion coverage
  const last = allChunks[allChunks.length - 1];
  if (sampled.length > 0 && sampled[sampled.length - 1].id !== last.id) sampled.push(last);
 
  let combined = "";
  for (const c of sampled) {
    const section = c.payload.section ? `[${c.payload.section}]` : "[Excerpt]";
    const text    = (c.payload.text || "").slice(0, excerptLen).replace(/\s+/g, " ").trim();
    const excerpt = `${section}\n${text}\n\n---\n\n`;
    if (combined.length + excerpt.length > maxContext) break;
    combined += excerpt;
  }
  return combined.trim();
}

// ─── GET /:id/research-gaps ──────────────────────────────────────────────────
// Drop-in replacement for the route in your workspace router.
//
// Flow:
//   1. Check research_gaps table  →  return immediately if rows exist (free)
//   2. If no rows: sample Qdrant, call LLM, STORE results, then return
//      (so the next reload hits path 1, not the LLM again)

router.get("/:id/research-gaps", clerkAuth, async (req, res) => {
  try {
    const { id: workspaceId } = req.params;
    const userId = req.auth.userId;

    // ── Auth ────────────────────────────────────────────────────────────────
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("clerk_id", userId)
      .single();
    if (wsErr || !ws) return res.status(404).json({ error: "Workspace not found" });

    // ── Fetch PDFs for citations (needed in both paths) ─────────────────────
    const { data: pdfs } = await supabase
      .from("user_pdfs")
      .select("pdf_id, filename")
      .eq("workspace_id", workspaceId)
      .eq("clerk_id", userId);

    const pdfNameMap       = Object.fromEntries((pdfs || []).map(p => [p.pdf_id, p.filename]));
    const defaultCitations = Object.entries(pdfNameMap)
      .slice(0, 3)
      .map(([pid, filename]) => ({ pdfId: pid, filename }));

    // ── Path 1: return stored gaps (no LLM call) ────────────────────────────
    const { data: storedGaps, error: gapErr } = await supabase
      .from("research_gaps")
      .select("id, gap_text, gap_type, confidence, related_pdfs, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }); // ascending = insertion order
    if (gapErr) throw gapErr;

    if (storedGaps?.length) {
      return res.json(storedGaps.map((gap, index) => {
        const lines       = (gap.gap_text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const title       = lines[0] || `Gap ${index + 1}`;
        const description = lines.slice(1).join(" ").trim();
        return {
          id:          gap.id,
          title,
          description,
          type:        gap.gap_type || "RESEARCH GAP",
          confidence:  gap.confidence ?? 0,
          citations:   defaultCitations,
        };
      }));
    }

    // ── Path 2: no stored gaps yet — generate, store, then return ───────────
    if (!pdfs?.length) return res.json([]);

    // Sample Qdrant (same helper as worker — keeps behaviour identical)
    const collectionName = `workspace_${workspaceId}`;
    let allChunks = [];
    try {
      const result = await qdrant.scroll(collectionName, {
        filter: { must: [{ key: "workspaceId", match: { value: workspaceId } }] },
        limit: 200,
        with_payload: true,
      });
      allChunks = result.points || [];
    } catch (qdrantErr) {
      console.warn("Qdrant scroll failed:", qdrantErr.message);
      return res.json([]);
    }

    if (!allChunks.length) return res.json([]);

    const combinedText = sampleChunks(allChunks); // defined in your router file
    console.log(
      `📊 On-demand gap generation: ${allChunks.length} chunks → ${combinedText.length} chars sampled`
    );

    const prompt = buildGapsPrompt(combinedText);
    const completion = await getAi().chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: prompt }],
      temperature:     0.3,
      max_tokens:      1500,
      response_format: { type: "json_object" },
    });

    const rawContent = completion?.choices?.[0]?.message?.content;
    let parsed = { gaps: [] };
    if (rawContent) {
      try { parsed = JSON.parse(rawContent); }
      catch (e) { console.warn("Gap parse error:", e); }
    }

    const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];
    if (!gaps.length) return res.json([]);

    // ── Store so future reloads are free ────────────────────────────────────
    const relatedPdfs = Object.values(pdfNameMap).slice(0, 3);

    const records = gaps.map((gap, index) => ({
      workspace_id: workspaceId,
      gap_text: [
        (gap.title?.trim()       || `Research Gap ${index + 1}`),
        (gap.description?.trim() || ""),
      ].filter(Boolean).join("\n\n"),
      gap_type:     gap.type?.trim() || "RESEARCH GAP",
      confidence:   0,
      related_pdfs: relatedPdfs,
    }));

    // Fire-and-forget — don't block the response on the insert
    supabase
      .from("research_gaps")
      .insert(records)
      .then(({ error }) => {
        if (error) console.warn("Could not store on-demand research gaps:", error.message);
        else console.log(`✅ Stored ${records.length} on-demand gaps for workspace ${workspaceId}`);
      });

    // Return immediately with the generated gaps (using temp ids)
    return res.json(gaps.map((gap, i) => ({
      id:          `gap-${i}`,          // real uuid arrives on next reload from DB
      title:       gap.title?.trim()       || `Gap ${i + 1}`,
      description: gap.description?.trim() || "",
      type:        gap.type?.trim()        || "RESEARCH GAP",
      citations:   defaultCitations,
    })));

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
      .from("user_pdfs").select("pdf_id, filename").eq("workspace_id", workspaceId).eq("clerk_id", userId);
 
    const collectionName = `workspace_${workspaceId}`;
    let allChunks = [];
    try {
      const result = await qdrant.scroll(collectionName, {
        filter: { must: [{ key: "workspaceId", match: { value: workspaceId } }] },
        limit: 200,
        with_payload: true,
      });
      allChunks = result.points || [];
    } catch (e) {
      console.warn("Qdrant scroll failed for abstract:", e.message);
    }
 
    // Use sampled context — not full dump
    const contextText = sampleChunks(allChunks, 15, 500, 3000);
    const prompt      = buildAbstractPrompt(gapTitle, gapDescription, contextText, pdfMeta?.length || 0);
 
    const completion = await getAi().chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens:  800,
    });
 
    const abstract = completion?.choices?.[0]?.message?.content?.trim() || "No abstract generated.";
    res.json({
      abstract,
      sourceDocs: (pdfMeta || []).map(p => p.filename),
    });
  } catch (err) {
    console.error("Abstract error:", err);
    res.status(500).json({ error: "Failed to generate abstract" });
  }
});

export default router;
