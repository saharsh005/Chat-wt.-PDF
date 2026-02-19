import { Worker } from "bullmq";
//import fs from "fs";
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

console.log("🚀 Worker running...");

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

// Improved chunking (sentence-aware basic)
function chunkText(text, size) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + size;

    if (end < text.length) {
      // Try to break at nearest period
      const lastPeriod = text.lastIndexOf(".", end);
      if (lastPeriod > start) {
        end = lastPeriod + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(chunk => chunk.length > 50);
}
// ----------------------------

new Worker(
  "pdf-queue",
  async (job) => {
    const { pdfId, storagePath, userId } = job.data;

    try {
      console.log("➡️ Processing PDF:", pdfId);

      // if (!filePath || !fs.existsSync(filePath)) {
      //   throw new Error("PDF file not found on disk");
      // }

      // 1️⃣ Extract text
      // 1️⃣ Download PDF from Supabase Storage
      if (!storagePath) {
        throw new Error("No storagePath provided in job data");
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("pdfs")
        .download(storagePath);

      if (downloadError) {
        throw new Error("Failed to download PDF from storage: " + downloadError.message);
      }

      if (!fileData) {
        throw new Error("Downloaded file is empty");
      }

      const fileBuffer = Buffer.from(await fileData.arrayBuffer());

      const pages = [];

      await pdf(fileBuffer, {
        pagerender: async (pageData) => {
          const textContent = await pageData.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(" ");
          pages.push(pageText);
          return pageText;
        }
      });

      if (!pages.length) {
        throw new Error("PDF contains no readable pages");
      }

      console.log("📑 Total pages detected:", pages.length);

      let chunks = [];
      let chunkCounter = 0;

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const pageText = pages[pageIndex].trim();
        if (!pageText) continue;

        const pageChunks = chunkText(pageText, CHUNK_SIZE);

        for (const chunk of pageChunks) {
          chunks.push({
            text: chunk,
            page: pageIndex + 1,   // 🔥 store real page number
            chunkIndex: chunkCounter++
          });
        }
      }

      console.log("✅ Total chunks:", chunks.length);


      // 3️⃣ Ensure user-specific collection
      const collectionName = `pdfs_${userId}`;
      await ensureCollection(collectionName);

      // 4️⃣ Embed + Store (Batched + Retry)
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            const points = [];

            for (let j = 0; j < batch.length; j++) {
              const chunkObj = batch[j];
              const vector = await getEmbedding(chunkObj.text);

              points.push({
                id: uuidv4(),
                vector,
                payload: {
                  pdfId,
                  userId,
                  text: chunkObj.text,
                  page: chunkObj.page,          // 🔥 now page exists
                  chunkIndex: chunkObj.chunkIndex,
                  createdAt: new Date().toISOString(),
                },
              });
            }

            await qdrant.upsert(collectionName, { points });

            console.log(
              `📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                chunks.length / BATCH_SIZE
              )} ✅`
            );

            break;
          } catch (err) {
            retryCount++;
            console.error(
              `❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (attempt ${retryCount}/${maxRetries}):`,
              err.message
            );

            if (retryCount >= maxRetries) {
              throw new Error(
                `Batch failed after ${maxRetries} retries: ${err.message}`
              );
            }

            await sleep(1000 * retryCount);
          }
        }

        await sleep(400);
      }

      console.log("✅ Finished processing:", pdfId);

    } catch (err) {
      console.error("❌ Worker failed:", err.message);
      throw err;
    }
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 1,
  }
);
