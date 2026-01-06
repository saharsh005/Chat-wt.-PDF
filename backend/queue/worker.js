import { Worker } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { getEmbedding } from "../utils/embeddings.js";
import { qdrant, ensureCollection, COLLECTION_NAME } from "../utils/qdrant.js";
import pdf from "pdf-parse";

console.log("🚀 Worker running...");

new Worker(
  "pdf-queue",
  async job => {
    try {
      const { pdfId, buffer } = job.data;

      console.log("➡️ Processing PDF:", pdfId);

      // 1. Extract text
      const data = await pdf(Buffer.from(buffer));
      const text = data.text;
      console.log("✅ PDF text length:", text.length);

      // 2. Chunking (HARD LIMIT)
      const chunks = [];
      const CHUNK_SIZE = 800;

      for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
      }

      console.log("✅ Chunks created:", chunks.length);

      // 3. Ensure Qdrant collection
      await ensureCollection(384);

      // 4. Store vectors (BATCHED)
      for (const chunk of chunks) {
        const vector = await getEmbedding(chunk);

        await qdrant.upsert(COLLECTION_NAME, {
          points: [
            {
              id: uuidv4(),
              vector,
              payload: {
                pdfId,
                text: chunk
              }
            }
          ]
        });
      }

      console.log("✅ Stored vectors for:", pdfId);
    } catch (err) {
      console.error("❌ Worker failed:", err);
    }
  },
  {
    connection: {
      host: "localhost",
      port: 6379
    }
  }
);
