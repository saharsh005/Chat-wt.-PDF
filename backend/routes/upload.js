import express from "express";
import multer from 'multer';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
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


router.post("/", clerkAuth, upload.single("pdf"), async (req, res) => {
  try {
    const { userId } = req.auth;
    const { workspaceId } = req.body;   // 🔥 MUST come from frontend
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    const pdfId = `${userId}_${uuidv4()}`;
    const storagePath = `${userId}/${pdfId}.pdf`;

    // 1️⃣ Upload to Supabase storage
    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .upload(storagePath, file.buffer, {
        contentType: "application/pdf"
      });

    if (storageError) throw storageError;

    // 2️⃣ Ensure user exists
    await supabase
      .from("users")
      .upsert(
        { clerk_id: userId },
        { onConflict: "clerk_id" }
      );

    // 3️⃣ Store PDF metadata WITH workspace_id
    await supabase
      .from("user_pdfs")
      .insert({
        pdf_id: pdfId,
        clerk_id: userId,
        workspace_id: workspaceId,   // 🔥 IMPORTANT
        filename: file.originalname,
        storage_path: storagePath
      });

    // 4️⃣ Send job to worker WITH workspaceId
    await pdfQueue.add("process-pdf", {
      pdfId,
      storagePath,
      userId,
      workspaceId
    });

    res.json({
      message: "Upload successful, processing started",
      pdfId
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});



export default router;
