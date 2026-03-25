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

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const VECTOR_SIZE = 384;
const CHUNK_SIZE = 800;
const BATCH_SIZE = 15;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const qdrant = new QdrantClient({ url: QDRANT_URL, timeout: 60_000 });

// ─── Qdrant Collection Setup ──────────────────────────────
async function ensureCollection(name) {
  try {
    await qdrant.createCollection(name, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    console.log("✅ Created collection:", name);
  } catch (err) {
    if (err.status === 409) {
      console.log("ℹ️ Collection already exists:", name);
    } else {
      throw err;
    }
  }
}

// ─── Section Heading Detector ─────────────────────────────
function isLikelyHeading(line) {
  if (!line) return false;
  const t = line.trim();
  if (t.length < 12 || t.length > 70) return false;
  if (/IJISS|Vol\.\d+|No\.\d+|Page|October/i.test(t)) return false;
  if (/[∑∫∂∇≠≤≥√πμστφθλρψωαβγδεζη×÷±∞]/.test(t)) return false;
  if (/^[=+\-*\/<>\[\]{}()×÷±∞\d.,]+$/.test(t)) return false;
  if (/^(I{0,4}|V?I{0,3})\.\s+[A-Z][a-z]/.test(t)) return true;
  if (/^\d+\.\d+\s+[A-Z][a-z]/.test(t)) return true;
  if (t === t.toUpperCase() && t.length >= 20) return true;
  return false;
}

// ─── Section Extractor ────────────────────────────────────
function extractSections(fullText) {
  const lines = fullText.split("\n").map((l) => l.trim()).filter((l) => l.length > 10);
  const sections = [];
  let current = { title: "Document", content: [], page: 1 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isLikelyHeading(line)) {
      if (current.content.length > 5) sections.push(current);
      current = { title: line, content: [], page: Math.floor(i / 60) + 1 };
    } else if (line.length > 15 && !/Vol\.\d+|IJISS|Page \d+/i.test(line)) {
      current.content.push(line);
    }
  }
  if (current.content.length > 5) sections.push(current);

  if (sections.length < 3) {
    const pageSize = 1200;
    return Array.from({ length: Math.ceil(fullText.length / pageSize) }, (_, i) => ({
      title: `Page ${i + 1}`,
      content: [fullText.slice(i * pageSize, (i + 1) * pageSize).trim()],
      page: i + 1,
    })).slice(0, 12);
  }

  return sections.filter((s) => s.content.length > 8);
}

// ─── Text Chunker ─────────────────────────────────────────
function chunkText(raw, size = CHUNK_SIZE) {
  const cleaned = raw
    .replace(/IJISS Vol\.\d+ No\.\d+ October-December \d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 30);
  const chunks = [];
  let current = "";

  for (const s of sentences) {
    if ((current + s).length > size && current.length > 200) {
      chunks.push(current.trim());
      current = s + ". ";
    } else {
      current += s + ". ";
    }
  }
  if (current.length > 200) chunks.push(current.trim());

  return chunks.filter(
    (c) =>
      c.length > 250 &&
      !/Vol\.\d+|IJISS|Page \d+/i.test(c) &&
      !c.match(/^[×∑∫∂∇≠≤≥√πμσ]/)
  );
}

// ─── Main Worker ──────────────────────────────────────────
new Worker(
  "pdf-queue",
  async (job) => {
    const { pdfId, storagePath, userId, workspaceId } = job.data;

    console.log("➡️ Processing PDF:", pdfId);

    if (!storagePath) throw new Error("No storagePath in job data");

    const { data: fileData, error: dlErr } = await supabase.storage
      .from("pdfs")
      .download(storagePath);

    if (dlErr) throw new Error("Download failed: " + dlErr.message);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const parsed = await pdf(buffer);
    const fullText = parsed.text;

    console.log("📑 Pages:", parsed.numpages, "| Text length:", fullText.length);

    const sections = extractSections(fullText);
    console.log("📚 Sections:", sections.length);

    const chunks = [];
    let chunkCounter = 0;

    for (const section of sections) {
      const text = section.content.join(" ").trim();
      if (text.length < 100) continue;
      const sectionChunks = chunkText(text);
      for (const chunk of sectionChunks) {
        chunks.push({
          text: chunk,
          page: section.page,
          section: section.title.substring(0, 100),
          chunkIndex: chunkCounter++,
        });
      }
    }

    console.log("✅ Total chunks:", chunks.length);

    const collectionName = `pdfs_${userId}`;
    await ensureCollection(collectionName);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      let retries = 0;

      while (retries < 3) {
        try {
          const points = await Promise.all(
            batch.map(async (c) => ({
              id: uuidv4(),
              vector: await getEmbedding(c.text),
              payload: {
                pdfId,
                userId,
                workspaceId,
                text: c.text,
                page: c.page,
                section: c.section,
                chunkIndex: c.chunkIndex,
                createdAt: new Date().toISOString(),
              },
            }))
          );
          await qdrant.upsert(collectionName, { points });
          console.log(`📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} ✅`);
          break;
        } catch (err) {
          retries++;
          if (retries >= 3) throw err;
          await sleep(1000 * retries);
        }
      }
      await sleep(300);
    }

    console.log("✅ Done processing:", pdfId);
  },
  { connection: REDIS_CONNECTION, concurrency: 1 }
);

console.log("🚀 Radium PDF Worker running...");
