import express from "express";
import { supabase } from "../utils/supabase.js";
import { clerkAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/:pdfId", clerkAuth, async (req, res) => {
  try {
    const { pdfId } = req.params;

    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.auth.userId;

    const { data: pdf, error } = await supabase
      .from("user_pdfs")
      .select("storage_path")
      .eq("pdf_id", pdfId)
      .eq("clerk_id", userId)
      .single();

    if (error || !pdf) {
      return res.status(404).json({ error: "PDF not found" });
    }

    const { data: signedData, error: signedError } =
      await supabase.storage
        .from("pdfs")
        .createSignedUrl(pdf.storage_path, 60 * 60);

    if (signedError) throw signedError;

    res.json({ url: signedData.signedUrl });

  } catch (err) {
    console.error("PDF fetch error:", err);
    res.status(500).json({ error: "Failed to fetch PDF" });
  }
});


export default router;
