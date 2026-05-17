import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

export const COLLECTION_NAME = "pdf_chunks";

export function createQdrantClient(options = {}) {
  return new QdrantClient({
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY,
    checkCompatibility: false,
    ...options,
  });
}

export const qdrant = createQdrantClient();

export async function ensureCollection(vectorSize) {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.find(
    c => c.name === COLLECTION_NAME
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: vectorSize,
        distance: "Cosine"
      }
    });
    console.log("✅ Qdrant collection created");
  }
}
