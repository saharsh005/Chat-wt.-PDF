import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import { pdfQueue } from "../queue/pdfQueue.js";

const router = express.Router();

// store file in memory (buffer), not disk
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pdfId = crypto.randomUUID();

    // push job to queue
    await pdfQueue.add("process-pdf", {
      pdfId,
      buffer: req.file.buffer
    });

    res.json({
      message: "PDF uploaded successfully",
      pdfId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
