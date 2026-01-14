import { Worker } from "bullmq";
import fs from "fs";
import pdf from "pdf-parse";
import { v4 as uuidv4 } from "uuid";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";

// ---------------- CONFIG ----------------
const REDIS_CONNECTION = {
  host: "localhost",
  port: 6379,
};
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const QDRANT_URL = "http://localhost:6333";
const VECTOR_SIZE = 384;
const CHUNK_SIZE = 800;          // Safe for embeddings
const BATCH_SIZE = 15;           // Prevents ECONNRESET
// ----------------------------------------

const qdrant = new QdrantClient({
  url: QDRANT_URL,
  timeout: 60_000, // 60 seconds
});


console.log("🚀 Worker running...");

// ---------- HELPERS ----------
async function ensureCollection(collectionName) {
  try {
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
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

function chunkText(text, size) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
// ----------------------------

new Worker(
  "pdf-queue",
  async (job) => {
    const { pdfId, filePath, userId } = job.data;

    try {
      console.log("➡️ Processing PDF:", pdfId);

      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error("PDF file not found on disk");
      }

      // 1️⃣ Read PDF from disk (SAFE for large files)
      const fileBuffer = fs.readFileSync(filePath);
      const data = await pdf(fileBuffer);
      const text = data.text || "";

      console.log("✅ Extracted text length:", text.length);

      if (!text.trim()) {
        throw new Error("PDF contains no readable text");
      }

      // 2️⃣ Chunk text
      const chunks = chunkText(text, CHUNK_SIZE);
      console.log("✅ Total chunks:", chunks.length);

      // 3️⃣ Ensure user-specific collection
      const collectionName = `pdfs_${userId}`;
      await ensureCollection(collectionName);

      // 4️⃣ Embed + store (BATCHED)
      // 4️⃣ Embed + store (BATCHED with RETRY)
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        
        // Retry logic for each batch
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const points = [];
            for (const chunk of batch) {
              const vector = await getEmbedding(chunk);
              points.push({
                id: uuidv4(),
                vector,
                payload: {
                  pdfId,
                  userId,
                  text: chunk,
                },
              });
            }

            await qdrant.upsert(collectionName, { points });
            console.log(`📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} ✅`);
            break; // Success - exit retry loop

          } catch (err) {
            retryCount++;
            console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (attempt ${retryCount}/${maxRetries}):`, err.message);
            
            if (retryCount >= maxRetries) {
              throw new Error(`Batch failed after ${maxRetries} retries: ${err.message}`);
            }
            
            await sleep(1000 * retryCount); // Exponential backoff
          }
        }
        
        await sleep(500); // Rate limit between batches
      }


      console.log("✅ Finished processing:", pdfId);

      // 5️⃣ Optional cleanup (recommended)
      // fs.unlinkSync(filePath);
      // console.log("🧹 Deleted file:", filePath);
    } catch (err) {
      console.error("❌ Worker failed:", err.message);
      throw err; // BullMQ will mark job as failed
    }
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 1, // IMPORTANT for memory stability
  }
);
