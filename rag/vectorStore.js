import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

export async function createStore(docs, pdfId, embeddings) {
  const client = new QdrantClient({
    url: "http://localhost:6333"
  });

  return await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName: pdfId
  });
}

export async function loadStore(pdfId, embeddings) {
  const client = new QdrantClient({
    url: "http://localhost:6333"
  });

  return await QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: pdfId
  });
}
