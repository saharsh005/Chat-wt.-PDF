import express from "express";
import Groq from "groq-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { clerkAuth } from "../middleware/auth.js";
import { supabase } from "../utils/supabase.js";
import { buildRagPrompt } from "../rag/prompts.js";

const router = express.Router();
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });

let ai = null;
function getAi() {
  if (!ai) ai = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return ai;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function getWorkspacePdfs(workspaceId) {
  const { data, error } = await supabase
    .from("user_pdfs")
    .select("pdf_id, filename, storage_path")
    .eq("workspace_id", workspaceId);
  if (error) { console.error("Workspace PDF fetch error:", error); return []; }
  return data || [];
}

function buildContext(hits, workspacePdfs) {
  const grouped = {};
  for (const h of hits) {
    const meta = workspacePdfs.find(p => p.pdf_id === h.payload.pdfId);
    const key = meta?.filename || h.payload.pdfId;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(`[Page ${h.payload.page} | ${h.payload.section || "N/A"}]\n${h.payload.text}`);
  }
  return Object.entries(grouped)
    .map(([name, chunks]) => `\n\n===== DOCUMENT: ${name} =====\n${chunks.join("\n\n")}`)
    .join("\n\n");
}

function buildSources(hits, workspacePdfs) {
  const seen = new Set();
  const sources = [];
  for (const h of hits) {
    const key = `${h.payload.pdfId}_${h.payload.page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const meta = workspacePdfs.find(p => p.pdf_id === h.payload.pdfId);
    sources.push({
      pdfId: h.payload.pdfId,
      filename: meta?.filename || "Document",
      page: h.payload.page,
      section: h.payload.section || null,
      score: Math.round(h.score * 100),
      preview: h.payload.text.substring(0, 120) + "…",
    });
    if (sources.length >= 8) break;
  }
  return sources;
}

// ── CREATE CHAT ─────────────────────────────────────────────────────────────

router.post("/create", clerkAuth, async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const userId = req.auth.userId;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const { data, error } = await supabase
      .from("chats")
      .insert({ clerk_id: userId, workspace_id: workspaceId, title: "Research Chat" })
      .select("id, title, workspace_id, created_at")
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PDF RAG CHAT ────────────────────────────────────────────────────────────

router.post("/", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { question, chatId } = req.body;

    if (!question || !chatId) {
      return res.status(400).json({ error: "question and chatId are required" });
    }

    // Load chat → workspace
    const { data: chatData } = await supabase
      .from("chats").select("workspace_id").eq("id", chatId).single();
    if (!chatData) return res.status(404).json({ error: "Chat not found" });

    const workspaceId = chatData.workspace_id;
    const workspacePdfs = await getWorkspacePdfs(workspaceId);
    const validPdfIds = workspacePdfs.map(p => p.pdf_id);

    // Recent history
    const { data: recentMsgs } = await supabase
      .from("messages").select("role, content")
      .eq("chat_id", chatId).order("created_at", { ascending: false }).limit(6);
    const historyText = (recentMsgs || []).reverse()
      .map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

    // Vector search
    const collectionName = `pdfs_${userId}`;
    const queryVector = await getEmbedding(question);

    let hits = await qdrant.search(collectionName, {
      vector: queryVector,
      limit: 14,
      with_payload: true,
      filter: {
        must: [
          { key: "workspaceId", match: { value: workspaceId } },
          ...(validPdfIds.length > 0 ? [{ key: "pdfId", match: { any: validPdfIds } }] : []),
        ],
      },
    });

    // Diversify: ensure coverage across multiple docs
    hits = hits.filter(h => h.score > 0.35).sort((a, b) => b.score - a.score);
    const seenDocs = new Set();
    const diversified = [];
    for (const h of hits) {
      if (!seenDocs.has(h.payload.pdfId) || diversified.length < 8) {
        diversified.push(h);
        seenDocs.add(h.payload.pdfId);
      }
    }
    hits = diversified.slice(0, 10);

    const context = buildContext(hits, workspacePdfs);
    const sources = buildSources(hits, workspacePdfs);

    // LLM
    const prompt = buildRagPrompt(context, historyText, question);
    const completion = await getAi().chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 6000,
      response_format: { type: "json_object" },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion.choices[0].message.content);
    } catch {
      parsed = { answer: completion.choices[0].message.content, gaps: [] };
    }

    const answer = parsed.answer || "No answer generated.";
    const gaps = parsed.gaps || [];

    // Persist messages
    await supabase.from("messages").insert([
      { chat_id: chatId, role: "user", content: question },
      { chat_id: chatId, role: "assistant", content: answer, sources },
    ]);

    await supabase.from("chats").update({ created_at: new Date() }).eq("id", chatId);

    res.json({ chatId, answer, gaps, sources, chunkCount: hits.length, mode: "pdf-rag" });

  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Chat failed", debug: err.message });
  }
});

// ── INTERNET-AUGMENTED CHAT ─────────────────────────────────────────────────
// Extracts keywords/authors from question, searches CrossRef + Semantic Scholar,
// returns sources the user can follow up on. Falls back to a web-grounded answer.

router.post("/internet", clerkAuth, async (req, res) => {
  try {
    const { question, chatId, workspaceId } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

    // Step 1: extract keywords with LLM
    const kwCompletion = await getAi().chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{
        role: "user",
        content: `Extract 3-5 academic search keywords and up to 2 author names from this research question. Return JSON only: {"keywords":["..."],"authors":["..."]}
Question: ${question}`,
      }],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    let kwData = { keywords: [], authors: [] };
    try { kwData = JSON.parse(kwCompletion.choices[0].message.content); } catch {}

    const keywords = kwData.keywords || [];
    const authors = kwData.authors || [];

    // Step 2: Search CrossRef
    const crossRefResults = [];
    const searchQuery = [...keywords, ...authors].join(" ");
    try {
      const crRes = await fetch(
        `https://api.crossref.org/works?query=${encodeURIComponent(searchQuery)}&rows=5&select=DOI,title,author,published-print,abstract,URL`,
        { headers: { "User-Agent": "Radium/1.0 (research-tool)" }, signal: AbortSignal.timeout(8000) }
      );
      const crData = await crRes.json();
      for (const item of (crData?.message?.items || [])) {
        crossRefResults.push({
          title: item.title?.[0] || "Untitled",
          authors: (item.author || []).map(a => `${a.given || ""} ${a.family || ""}`.trim()).join(", "),
          year: item["published-print"]?.["date-parts"]?.[0]?.[0] || "N/A",
          doi: item.DOI,
          url: item.URL || `https://doi.org/${item.DOI}`,
          abstract: item.abstract?.replace(/<[^>]+>/g, "").substring(0, 300) || null,
          source: "CrossRef",
        });
      }
    } catch (err) {
      console.warn("CrossRef fetch failed:", err.message);
    }

    // Step 3: Search Semantic Scholar
    const semResults = [];
    try {
      const ssRes = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(searchQuery)}&limit=5&fields=title,authors,year,abstract,url,externalIds`,
        { headers: { "x-api-key": process.env.SEMANTIC_SCHOLAR_KEY || "" }, signal: AbortSignal.timeout(8000) }
      );
      const ssData = await ssRes.json();
      for (const p of (ssData?.data || [])) {
        semResults.push({
          title: p.title || "Untitled",
          authors: (p.authors || []).map(a => a.name).join(", "),
          year: p.year || "N/A",
          doi: p.externalIds?.DOI || null,
          url: p.url || null,
          abstract: p.abstract?.substring(0, 300) || null,
          source: "Semantic Scholar",
        });
      }
    } catch (err) {
      console.warn("Semantic Scholar fetch failed:", err.message);
    }

    const allPapers = [...crossRefResults, ...semResults].slice(0, 8);

    // Step 4: Synthesize answer with LLM using paper abstracts as context
    const paperContext = allPapers
      .filter(p => p.abstract)
      .map(p => `[${p.title} (${p.year}), ${p.source}]\n${p.abstract}`)
      .join("\n\n---\n\n");

    const synthesisPrompt = `You are Radium, an academic research assistant.

Using the following web-sourced paper abstracts, answer the user's question academically.
Cite papers by title. If context is insufficient, say so.

PAPERS FROM WEB SEARCH:
${paperContext || "No abstracts available — answer from general knowledge."}

USER QUESTION:
${question}

Provide a clear, cited academic answer in Markdown.`;

    const answerCompletion = await getAi().chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: synthesisPrompt }],
      temperature: 0.4,
      max_tokens: 3000,
    });

    const answer = answerCompletion.choices[0].message.content;

    // Persist if chatId given
    if (chatId) {
      await supabase.from("messages").insert([
        { chat_id: chatId, role: "user", content: question, mode: "internet" },
        { chat_id: chatId, role: "assistant", content: answer, mode: "internet" },
      ]);
    }

    res.json({
      answer,
      papers: allPapers,
      keywords,
      authors,
      mode: "internet",
    });

  } catch (err) {
    console.error("Internet chat error:", err.message);
    res.status(500).json({ error: "Internet chat failed", debug: err.message });
  }
});

// ── GET CHATS ───────────────────────────────────────────────────────────────

router.get("/", clerkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("chats").select("id, title, workspace_id, created_at")
      .eq("clerk_id", req.auth.userId).order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.json([]);
  }
});

router.get("/:chatId", clerkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("chats").select("id, title, workspace_id, created_at")
      .eq("id", req.params.chatId).eq("clerk_id", req.auth.userId).single();
    if (error || !data) return res.status(404).json({ error: "Chat not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load chat" });
  }
});

router.get("/:chatId/messages", clerkAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("messages").select("id, role, content, sources, mode, created_at")
      .eq("chat_id", req.params.chatId).order("created_at", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to load messages" });
  }
});

router.get("/:id/pdfs", clerkAuth, async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    const { data: chat, error: chatErr } = await supabase
      .from("chats").select("id, workspace_id, clerk_id").eq("id", req.params.id).single();
    if (chatErr || !chat) return res.status(404).json({ error: "Chat not found" });
    if (chat.clerk_id !== clerkId) return res.status(403).json({ error: "Forbidden" });

    const { data: pdfs, error: pdfErr } = await supabase
      .from("user_pdfs").select("pdf_id, filename, storage_path, workspace_id, uploaded_at")
      .eq("workspace_id", chat.workspace_id);
    if (pdfErr) return res.status(500).json({ error: "Failed to fetch PDFs" });
    res.json(pdfs || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:chatId", clerkAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.auth.userId;

    // 1. Check ownership
    const { data: chat, error: chatErr } = await supabase
      .from("chats").select("clerk_id").eq("id", chatId).single();
    
    if (chatErr || !chat) return res.status(404).json({ error: "Chat not found" });
    if (chat.clerk_id !== userId) return res.status(403).json({ error: "Forbidden" });

    // 2. Delete chat (cascades to messages in DB if FK is set)
    const { error: delErr } = await supabase
      .from("chats").delete().eq("id", chatId);
    
    if (delErr) throw delErr;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

export default router;
