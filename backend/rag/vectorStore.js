import { QdrantVectorStore } from "@langchain/qdrant";
import { createQdrantClient } from "../utils/qdrant.js";

export async function createStore(docs, pdfId, embeddings) {
  const client = createQdrantClient();

  return await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName: pdfId
  });
}

export async function loadStore(pdfId, embeddings) {
  const client = createQdrantClient();

  return await QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: pdfId
  });
}
