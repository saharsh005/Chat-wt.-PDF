import { Worker } from "bullmq";
import pdf from "pdf-parse";
import { v4 as uuidv4 } from "uuid";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { supabase } from "../utils/supabase.js";

// ---------------- CONFIG ----------------
const REDIS_CONNECTION = {
  host: "localhost",
  port: 6379,
};

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const QDRANT_URL = "http://localhost:6333";
const VECTOR_SIZE = 384;
const CHUNK_SIZE = 800;
const BATCH_SIZE = 15;
const SIMILARITY_DISTANCE = "Cosine";
// ----------------------------------------

const qdrant = new QdrantClient({
  url: QDRANT_URL,
  timeout: 60_000,
});

console.log("🚀 Research Paper Worker v2 running...");

// ---------- HELPERS ----------
async function ensureCollection(collectionName) {
  try {
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: VECTOR_SIZE,
        distance: SIMILARITY_DISTANCE,
      },
    });
    console.log("✅ Created collection:", collectionName);
  } catch (err) {
    if (err.status === 409) {
      console.log("ℹ️ Collection exists:", collectionName);
    } else {
      throw err;
    }
  }
}

// 🔥 REPLACE ENTIRE extractSections() + chunkText() + chunking logic

// ========== HEADING DETECTOR v3 ==========
function isLikelyHeading(line) {
  if (!line) return false;
  
  const trimmed = line.trim();
  
  // ❌ REJECT: Too short/long, journal headers, equations
  if (trimmed.length < 12 || trimmed.length > 70) return false;
  
  // ❌ Journal/page numbers (IJISS, Vol, page nums)
  if (/IJISS|Vol\.\d+|No\.\d+|Page|October|247|249|251|257/i.test(trimmed)) return false;
  
  // ❌ Math/equations/symbols
  if (/[∑∫∂∇≠≤≥√πμστφθλρψωαβγδεζη×÷±∞]|[(][a-zA-Z0-9]{1,3}[)]/.test(trimmed)) return false;
  
  // ❌ Pure symbols/numbers
  if (/^[=+\-*/<>\[\]{}()×÷±∞\d.,]+$/.test(trimmed)) return false;
  
  // ✅ ACCEPT: Roman numerals + Title case
  if (/^(I{0,4}|V?I{0,3})\.\s+[A-Z][a-z]/.test(trimmed)) return true;
  
  // ✅ Numbered sections: "3.1 Choosing...", "4.2 Enhanced..."
  if (/^\d+\.\d+\s+[A-Z][a-z]/.test(trimmed)) return true;
  
  // ✅ ALL CAPS titles (min length)
  if (trimmed === trimmed.toUpperCase() && trimmed.length >= 20) return true;
  
  return false;
}

// ========== SECTIONS v3 ==========
function extractSections(fullText) {
  const lines = fullText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 10);

  const sections = [];
  let currentSection = { title: "Document", content: [], page: 1 };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (isLikelyHeading(line)) {
      if (currentSection.content.length > 5) {
        sections.push(currentSection);
      }
      currentSection = {
        title: line,
        content: [],
        page: Math.floor(i / 60) + 1
      };
    } else {
      // Accept most content lines (lenient)
      if (line.length > 15 && !line.match(/^[××=+\-*/()]+$/) && 
          !/Vol\.\d+|IJISS|Page \d+/i.test(line)) {
        currentSection.content.push(line);
      }
    }
  }
  
  if (currentSection.content.length > 5) sections.push(currentSection);
  
  // Fallback: If too few sections, split by pages (~1000 chars/page)
  if (sections.length < 3) {
    console.log("⚠️ Few sections, using PAGE-WISE fallback");
    const pageSize = 1200;
    const pages = [];
    for (let i = 0; i < fullText.length; i += pageSize) {
      pages.push({
        title: `Page ${Math.floor(i/pageSize) + 1}`,
        content: [fullText.slice(i, i + pageSize).trim()],
        page: Math.floor(i/pageSize) + 1
      });
    }
    return pages.slice(0, 12); // Max 12 pages
  }
  
  return sections.filter(s => s.content.length > 8);
}

// ========== CHUNKING v3 (Aggressive cleaning + guaranteed chunks) ==========
function chunkText(rawSectionText, size = 900) {
  // 1️⃣ HEAVY CLEANING
  let cleaned = rawSectionText
    .replace(/IJISS Vol\.\d+ No\.\d+ October-December \d+/gi, '') // Journal headers
    .replace(/247|249|251|257\s+IJISS/gi, '') // Page numbers
    .replace(/×100\s*\([^)]*\)/gi, '') // Equation fragments
    .replace(/\[Eq\.\s*\d+\]/gi, '') // Eq labels
    .replace(/\s+/g, ' ')
    .trim();

  // 2️⃣ Split into sentences
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 30);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > size) {
      if (currentChunk.length > 200) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence + '. ';
    } else {
      currentChunk += sentence + '. ';
    }
  }
  
  if (currentChunk.length > 200) chunks.push(currentChunk.trim());
  
  // 3️⃣ FINAL FILTER (strict quality check)
  return chunks.filter(chunk => 
    chunk.length > 250 &&
    !/^[××=+\-*/()×÷]+$/.test(chunk) &&
    !/Vol\.\d+|IJISS|Page \d+/i.test(chunk) &&
    !chunk.match(/^[×∑∫∂∇≠≤≥√πμσ]/)
  );
}


new Worker(
  "pdf-queue",
  async (job) => {
    const { pdfId, storagePath, userId, workspaceId } = job.data;

    try {
      console.log("➡️ Processing Research PDF:", pdfId);

      if (!storagePath) {
        throw new Error("No storagePath provided in job data");
      }

      // 1️⃣ Download PDF from Supabase
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pdfs")
        .download(storagePath);

      if (downloadError) {
        throw new Error("Failed to download PDF: " + downloadError.message);
      }

      const fileBuffer = Buffer.from(await fileData.arrayBuffer());

      // 🔥 2️⃣ Use YOUR ORIGINAL pdf-parse (works perfectly)
      const data = await pdf(fileBuffer);
      const fullText = data.text;

      console.log("📑 Total pages:", data.numpages);
      console.log("📝 Total text length:", fullText.length);

      // 🔥 3️⃣ NEW: Smart section extraction
      const sections = extractSections(fullText);
      console.log("📚 Sections found:", sections.length);

      let chunks = [];
      let chunkCounter = 0;

      // 4️⃣ Chunk per section
      for (let section of sections) {
        const sectionText = section.content.join(' ').trim();
        if (sectionText.length < 100) continue;

        const sectionChunks = chunkText(sectionText, CHUNK_SIZE);
        
        for (const chunk of sectionChunks) {
          chunks.push({
            text: chunk,
            page: section.page,
            section: section.title.substring(0, 100),
            chunkIndex: chunkCounter++
          });
        }
        console.log(`   └─ ${section.title}: ${sectionChunks.length} chunks`);
      }

      console.log("✅ Total chunks:", chunks.length);

      // 5️⃣ Store (unchanged)
      const collectionName = `pdfs_${userId}`;
      await ensureCollection(collectionName);

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            const points = [];
            for (let chunkObj of batch) {
              const vector = await getEmbedding(chunkObj.text);
                points.push({
                  id: uuidv4(),
                  vector,
                  payload: {
                    pdfId,
                    userId,
                    workspaceId,   // 🔥 ADD THIS
                    text: chunkObj.text,
                    page: chunkObj.page,
                    section: chunkObj.section,
                    chunkIndex: chunkObj.chunkIndex,
                    createdAt: new Date().toISOString(),
                  },
                });
            }
            await qdrant.upsert(collectionName, { points });
            console.log(`📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} ✅`);
            break;
          } catch (err) {
            retryCount++;
            if (retryCount >= maxRetries) throw err;
            await sleep(1000 * retryCount);
          }
        }
        await sleep(400);
      }

      console.log("✅ Finished Research PDF processing:", pdfId);

    } catch (err) {
      console.error("❌ Worker failed:", err.message);
      throw err;
    }
  },
  { connection: REDIS_CONNECTION, concurrency: 1 }
);
