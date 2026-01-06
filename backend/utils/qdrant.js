import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION_NAME = "pdf_chunks";

export const qdrant = new QdrantClient({
  url: "http://localhost:6333"
});

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
