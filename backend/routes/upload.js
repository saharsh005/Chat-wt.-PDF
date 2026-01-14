import express from "express";
import multer from 'multer';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding } from "../utils/embeddings.js";
import { v4 as uuidv4 } from 'uuid';
import { clerkAuth } from "../middleware/auth.js";
import fs from "fs";
import { pdfQueue } from "../queue/pdfQueue.js";

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    limits: { fileSize: 200 * 1024 * 1024 },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 1024 * 1024 * 200 // ✅ 200MB (change if needed)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDFs allowed'));
    }
    cb(null, true);
  }
});

const qdrant = new QdrantClient({
  url: "http://localhost:6333",
  timeout: 120000 // 2 minutes
});

router.post("/", clerkAuth, upload.single("file"), async (req, res) => {
  try {
    const { userId } = req.auth;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pdfId = `${userId}_${uuidv4()}`;

    await pdfQueue.add("process-pdf", {
      pdfId,
      userId,
      filePath: file.path,
      fileName: file.originalname
    });

    res.json({
      message: "Upload successful, processing started",
      pdfId
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});


export default router;
