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
import { supabase } from "../utils/supabase.js";


const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDFs allowed"));
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

    const storagePath = `${userId}/${pdfId}.pdf`;

    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .upload(storagePath, file.buffer, {
        contentType: "application/pdf"
      });

    if (storageError) throw storageError;


        // 1️⃣ Ensure user exists
    await supabase
      .from("users")
      .upsert(
        { clerk_id: userId },
        { onConflict: "clerk_id" }
      );

    // 2️⃣ Store PDF metadata
    await supabase
      .from("user_pdfs")
      .insert({
        pdf_id: pdfId,
        clerk_id: userId,
        filename: file.originalname,
        storage_path: storagePath
      });


    // 3️⃣ Create initial chat (EMPTY chat)
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .insert({
        clerk_id: userId,
        pdf_id: pdfId,
        title: file.originalname
      })
      .select("id")
      .single();

    if (chatError) throw chatError;


    await pdfQueue.add("process-pdf", {
      pdfId,
      userId,
      storagePath
    });


    res.json({
      message: "Upload successful, processing started",
      pdfId,
      chatId: chat.id
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});


export default router;
