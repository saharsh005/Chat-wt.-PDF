"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, AlertCircle } from "lucide-react";

/**
 * PdfViewer
 * @param {string} pdfId  - PDF identifier (used to fetch signed URL)
 * @param {number} page   - Page number to jump to (changes force iframe reload via key)
 */
export default function PdfViewer({ pdfId, page = 1 }) {
  const { getToken } = useAuth();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pdfId) return;
    let cancelled = false;

    async function fetchUrl() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/pdf/${pdfId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setUrl(data.url);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUrl();
    return () => { cancelled = true; };
  }, [pdfId, getToken]);

  if (!pdfId) return null;

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "#555" }}>
      <Loader2 size={22} style={{ animation: "spin 0.8s linear infinite", color: "#6495ed" }} />
      <span style={{ fontSize: 12 }}>Loading PDF…</span>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "#e85d5d" }}>
      <AlertCircle size={22} />
      <span style={{ fontSize: 12 }}>Failed to load PDF</span>
      <span style={{ fontSize: 10, color: "#555" }}>{error}</span>
    </div>
  );

  if (!url) return null;

  // key={`${pdfId}-${page}`} forces iframe to reload when page changes
  // The #page= fragment is supported by most PDF.js/Chrome-based viewers
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <iframe
        key={`${pdfId}-p${page}`}
        src={`${url}#page=${page}`}
        title="PDF Viewer"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </div>
  );
}
