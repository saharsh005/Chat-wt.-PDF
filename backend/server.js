import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

// Routes
import upload from "./routes/upload.js";
import chat from "./routes/chat.js";
import pdfRoutes from "./routes/pdf.js";
import workspaceRoutes from "./routes/workspace.js";
import { clerkAuth } from "./middleware/auth.js";

app.use("/workspace", workspaceRoutes);
app.use("/pdf", pdfRoutes);
app.use("/chat", chat);
app.use("/upload", clerkAuth, upload);

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.get("/", (req, res) => res.json({ status: "Radium backend running 🚀" }));

app.use((err, req, res, next) => {
  console.error("Global error:", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
