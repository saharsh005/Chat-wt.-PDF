import express from "express";
import { clerkAuth } from "../middleware/auth.js";
import { supabase } from "../utils/supabase.js";

const router = express.Router();

/* =========================
   CREATE WORKSPACE
========================= */
router.post("/", clerkAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.auth.userId;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Workspace title required" });
    }

    // Ensure user exists
    await supabase
      .from("users")
      .upsert({ clerk_id: userId }, { onConflict: "clerk_id" });

    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        clerk_id: userId,
        title: title.trim()
      })
      .select("id, title, created_at")
      .single();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error("Workspace create error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GET USER WORKSPACES
========================= */
router.get("/", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;

    const { data, error } = await supabase
      .from("workspaces")
      .select("id, title, created_at")
      .eq("clerk_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);

  } catch (err) {
    console.error("Workspace fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GET SINGLE WORKSPACE
========================= */
router.get("/:id", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("workspaces")
      .select("id, title, created_at")
      .eq("id", id)
      .eq("clerk_id", userId)
      .single();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error("Workspace fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GET WORKSPACE PDFs
========================= */
router.get("/:id/pdfs", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("user_pdfs")
      .select("pdf_id, filename, uploaded_at")
      .eq("workspace_id", id)
      .eq("clerk_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);

  } catch (err) {
    console.error("Workspace PDFs fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   GET WORKSPACE CHATS
========================= */
router.get("/:id/chats", clerkAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("chats")
      .select("id, title, created_at")
      .eq("workspace_id", id)
      .eq("clerk_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);

  } catch (err) {
    console.error("Workspace chats fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
