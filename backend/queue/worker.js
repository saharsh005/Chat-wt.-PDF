import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import { Worker } from "bullmq";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { v4 as uuidv4 } from "uuid";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { supabase } from "../utils/supabase.js";

// ─── Config ───────────────────────────────────────────────
const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
};

const QDRANT_URL  = process.env.QDRANT_URL || "http://localhost:6333";
const VECTOR_SIZE = 384;

const CHUNK_TARGET  = 800;
const CHUNK_MIN     = 250;
const CHUNK_MAX     = 1100;
const CHUNK_OVERLAP = 150;
const BATCH_SIZE    = 15;

const sleep  = (ms) => new Promise((res) => setTimeout(res, ms));
const qdrant = new QdrantClient({ url: QDRANT_URL, timeout: 60_000 });

// ─── Qdrant Collection Setup ──────────────────────────────
/**
 * One collection per workspace  →  `workspace_{workspaceId}`
 *
 * All PDFs in the workspace share the collection.
 * At query time, filter by `workspaceId` (always) and optionally by
 * `pdfId` to scope the search to specific documents.
 *
 * Payload indices on workspaceId + pdfId make filtered search O(log n)
 * instead of a full scan.
 */
async function ensureCollection(name) {
  try {
    await qdrant.createCollection(name, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    console.log("✅ Created collection:", name);

    await qdrant.createPayloadIndex(name, {
      field_name:   "workspaceId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(name, {
      field_name:   "pdfId",
      field_schema: "keyword",
    });
    console.log("✅ Payload indices created (workspaceId, pdfId)");
  } catch (err) {
    if (err.status === 409) {
      console.log("ℹ️  Collection already exists:", name);
    } else {
      throw err;
    }
  }
}

// ─── PDF metadata ─────────────────────────────────────────
/**
 * Fetch the human-readable file name and title for a PDF so every chunk
 * carries source attribution.  Adjust the select list to your schema.
 */
async function fetchPdfMeta(pdfId) {
  const { data, error } = await supabase
    .from("pdfs")
    .select("id, file_name, title")
    .eq("id", pdfId)
    .single();

  if (error) {
    console.warn("⚠️  Could not fetch PDF metadata:", error.message);
    return { fileName: "unknown.pdf", pdfTitle: "Untitled" };
  }
  return {
    fileName: data.file_name ?? "unknown.pdf",
    pdfTitle: data.title ?? data.file_name ?? "Untitled",
  };
}

// ─── Noise line detector ──────────────────────────────────
const NOISE_PATTERNS = [
  /IJISS\s+Vol\.\s*\d+/i,
  /^Vol\.\s*\d+\s+No\.\s*\d+/i,
  /^Page\s+\d+\s*$/i,
  /^October|^November|^December|^January/i,
  /^\s*\d+\s*$/,
  /^[=+\-*/<>\[\]{}()×÷±∞\d\s.,;:]+$/,
  /[∑∫∂∇≠≤≥√πμστφθλρψωαβγδεζη×÷±∞]{2,}/,
  /^https?:\/\//i,
  /^doi:/i,
  /^\[?\d+\]?\s+[A-Z][a-z]+.*\d{4}[.,]/,
];

function isNoiseLine(line) {
  const t = line.trim();
  if (t.length === 0) return true;
  return NOISE_PATTERNS.some((re) => re.test(t));
}

// ─── Section Heading Detector ─────────────────────────────
function isLikelyHeading(line) {
  const t = line.trim();
  if (t.length < 4 || t.length > 60)  return false;
  if (isNoiseLine(t))                  return false;
  if (/[∑∫∂∇≠≤≥√πμστφθλρψωαβγδεζη×÷±∞]/.test(t)) return false;
  if (/[,;]\s/.test(t))                return false;

  if (/^(X{0,3})(IX|IV|V?I{0,3})\.\s+[A-Z][a-zA-Z\s\-]{2,}$/.test(t)) return true;
  if (/^\d+(\.\d+)*\.?\s+[A-Z][a-zA-Z\s\-]{2,}$/.test(t))              return true;

  if (/^[A-Z][A-Z\s\-]{3,}$/.test(t)) {
    const wc = t.trim().split(/\s+/).length;
    if (wc === 1 && t.length < 5) return false;
    if (wc > 7)                   return false;
    return true;
  }
  return false;
}

// ─── Text Normaliser ──────────────────────────────────────
function normaliseText(raw) {
  return raw
    .replace(/IJISS\s+Vol\.\s*\d+\s+No\.\s*\d+[^\n]*/gi, "")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Section Extractor ────────────────────────────────────
function extractSections(fullText) {
  const lines    = fullText.split("\n").map((l) => l.trim());
  const sections = [];
  let current    = { title: "Preamble", lines: [], lineStart: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isLikelyHeading(line)) {
      if (current.lines.length > 3) sections.push({ ...current, lineEnd: i });
      current = { title: line, lines: [], lineStart: i };
    } else if (!isNoiseLine(line) && line.length > 15) {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 3) sections.push({ ...current, lineEnd: lines.length });

  if (sections.length < 3) {
    console.warn("⚠️  Heading detection yielded < 3 sections; using paragraph fallback.");
    return paragraphFallback(fullText);
  }
  return sections.filter((s) => s.lines.length > 5);
}

function paragraphFallback(fullText) {
  const paragraphs = fullText
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 80 && !isNoiseLine(p));

  const PAGE_BUCKET = 1200;
  const sections    = [];
  let bucket = [], bucketLen = 0, pageNum = 1;

  for (const para of paragraphs) {
    if (bucketLen + para.length > PAGE_BUCKET && bucket.length > 0) {
      sections.push({ title: `Segment ${pageNum}`, lines: bucket, page: pageNum });
      pageNum++; bucket = []; bucketLen = 0;
    }
    bucket.push(para);
    bucketLen += para.length;
  }
  if (bucket.length > 0)
    sections.push({ title: `Segment ${pageNum}`, lines: bucket, page: pageNum });

  return sections;
}

// ─── Text Chunker ─────────────────────────────────────────
function chunkSection(sectionText, overlap = CHUNK_OVERLAP) {
  const sentences = sectionText
    .split(/(?<=[.!?])\s+(?=[A-Z"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const chunks = [];
  let current  = "";
  let carry    = "";

  for (const sentence of sentences) {
    if (current.length > 0 && current.length + sentence.length > CHUNK_MAX) {
      if (current.length >= CHUNK_MIN) chunks.push(current.trim());
      carry   = current.slice(-overlap).trim();
      current = carry + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
      if (current.length >= CHUNK_TARGET) {
        if (current.length >= CHUNK_MIN) chunks.push(current.trim());
        carry   = current.slice(-overlap).trim();
        current = "";
      }
    }
  }
  if (current.trim().length >= CHUNK_MIN) chunks.push(current.trim());
  return chunks;
}

// ─── Main Worker ──────────────────────────────────────────
new Worker(
  "pdf-queue",
  async (job) => {
    const { pdfId, storagePath, userId, workspaceId } = job.data;

    console.log("➡️  Processing PDF:", pdfId, "| workspace:", workspaceId);

    if (!storagePath) throw new Error("No storagePath in job data");
    if (!workspaceId) throw new Error("No workspaceId in job data");

    // 1. Download
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("pdfs")
      .download(storagePath);
    if (dlErr) throw new Error("Download failed: " + dlErr.message);

    // 2. Parse
    const buffer   = Buffer.from(await fileData.arrayBuffer());
    const parsed   = await pdf(buffer);
    const fullText = normaliseText(parsed.text);
    console.log("📑 Pages:", parsed.numpages, "| Text length:", fullText.length);

    // 3. Source metadata (carried into every chunk payload)
    const { fileName, pdfTitle } = await fetchPdfMeta(pdfId);
    console.log("📄 Document:", pdfTitle, "(", fileName, ")");

    // 4. Chunk
    const sections = extractSections(fullText);
    console.log("📚 Sections detected:", sections.length);

    const chunks = [];
    let chunkCounter = 0;

    for (const section of sections) {
      const sectionText = section.lines.join(" ").replace(/\s+/g, " ").trim();
      if (sectionText.length < 80) continue;

      const sectionChunks = chunkSection(sectionText);
      const approxPage    = section.page ?? Math.floor((section.lineStart ?? 0) / 60) + 1;

      for (const chunkText of sectionChunks) {
        chunks.push({
          text:       chunkText,
          page:       approxPage,
          section:    section.title.substring(0, 120),
          chunkIndex: chunkCounter++,
        });
      }
    }
    console.log("✅ Total chunks:", chunks.length);

    // 5. Upsert into workspace-scoped Qdrant collection
    const collectionName = `workspace_${workspaceId}`;
    await ensureCollection(collectionName);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch   = chunks.slice(i, i + BATCH_SIZE);
      let retries   = 0;

      while (retries < 3) {
        try {
          const points = await Promise.all(
            batch.map(async (c) => ({
              id:     uuidv4(),
              vector: await getEmbedding(c.text),
              payload: {
                // Identity — used for filtering at query time
                workspaceId,
                pdfId,
                userId,

                // Source attribution — returned with every chunk so the
                // answer layer can cite "pdfTitle, page N, section S"
                pdfTitle,
                fileName,

                // Content
                text:       c.text,
                page:       c.page,
                section:    c.section,
                chunkIndex: c.chunkIndex,

                createdAt: new Date().toISOString(),
              },
            }))
          );
          await qdrant.upsert(collectionName, { points });
          console.log(
            `📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} ✅`
          );
          break;
        } catch (err) {
          retries++;
          if (retries >= 3) throw err;
          await sleep(1000 * retries);
        }
      }
      await sleep(300);
    }

    // 6. Mark PDF as indexed in Supabase
    const { error: updateErr } = await supabase
      .from("pdfs")
      .update({
        indexed:     true,
        chunk_count: chunks.length,
        indexed_at:  new Date().toISOString(),
      })
      .eq("id", pdfId);

    if (updateErr) console.warn("⚠️  Could not update indexing status:", updateErr.message);

    console.log("✅ Done:", pdfId, "→", collectionName);
  },
  { connection: REDIS_CONNECTION, concurrency: 1 }
);

console.log("🚀 Radium PDF Worker running...");