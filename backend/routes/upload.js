import express from "express";
import multer from 'multer';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { v4 as uuidv4 } from 'uuid';
import { clerkAuth } from "../middleware/clerkAuth.js";

const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

router.post("/", clerkAuth, upload.single('file'), async (req, res) => {
  const { userId } = req.user;  // From Clerk JWT
  const file = req.file;
  
  try {
    // Load + chunk PDF
    const loader = new PDFLoader(file.path);
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const chunks = await splitter.splitDocuments(docs);

    // User-scoped collection
    const pdfId = `${userId}_${uuidv4()}`;  // user123_pdf456_chunk789
    const collectionName = `pdfs_${userId}`;

    // Create collection if needed
    await qdrant.createCollection(collectionName, {
      vectors: { size: 384, distance: 'Cosine' }  // Match your embeddings
    });

    // Index chunks (user-isolated)
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const vector = await getEmbedding(chunks[i].pageContent);
      points.push({
        id: `${pdfId}_${i}`,
        vector,
        payload: {
          pdfId,
          userId,
          text: chunks[i].pageContent,
          page: chunks[i].metadata.page || 1,
          file_name: file.originalname
        }
      });
    }

    await qdrant.upsert(collectionName, { points });

    res.json({
      message: "PDF uploaded",
      pdfId,  // user123_pdf456 (unique per user)
      chunkCount: points.length,
      collection: collectionName
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
