"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

export default function PdfViewer({ pdfId }) {
  const [url, setUrl] = useState(null);
  const { getToken } = useAuth();

  useEffect(() => {
    async function fetchPdf() {
      try {
        const token = await getToken();

        const res = await fetch(
          `http://localhost:5000/pdf/${pdfId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        setUrl(data.url);
      } catch (err) {
        console.error("PDF fetch error:", err);
      }
    }

    if (pdfId) fetchPdf();
  }, [pdfId, getToken]);

  if (!url) return <div className="p-4">Loading PDF...</div>;

  return (
    <div className="h-full w-full">
      <iframe
        src={url}
        className="w-full h-full border-none"
        title="PDF Viewer"
      />
    </div>
  );
}
