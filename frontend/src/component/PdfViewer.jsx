"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function PdfViewer({ pdfId }) {
  const [url, setUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);

  useEffect(() => {
    async function fetchPdf() {
      const res = await fetch(
        `http://localhost:5000/pdf/${pdfId}`,
        { credentials: "include" }
      );

      const data = await res.json();
      setUrl(data.url);
    }

    if (pdfId) fetchPdf();
  }, [pdfId]);

  return (
    <div className="p-4">
      {url && (
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        >
          {Array.from(new Array(numPages), (_, index) => (
            <Page
              key={index}
              pageNumber={index + 1}
              width={600}
            />
          ))}
        </Document>
      )}
    </div>
  );
}
