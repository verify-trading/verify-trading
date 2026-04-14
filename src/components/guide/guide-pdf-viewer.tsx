"use client";

import { useCallback, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { GuidePdfSkeleton } from "@/components/guide/guide-pdf-skeleton";

/** True 150% page scale (iframe `#zoom=` does not match the toolbar %; it mixes fit, DPR, and internal units). */
const GUIDE_PDF_SCALE = 1.5;

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function GuidePdfViewer() {
  const [numPages, setNumPages] = useState<number | null>(null);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[#111]">
      <Document
        file="/guide-pdf"
        loading={<GuidePdfSkeleton />}
        error={
          <p className="p-4 text-sm text-red-400" role="alert">
            Could not load the guide PDF.
          </p>
        }
        onLoadSuccess={onLoadSuccess}
      >
        {numPages !== null
          ? Array.from({ length: numPages }, (_, i) => (
              <div key={i + 1} className="flex justify-center py-2">
                <Page
                  pageNumber={i + 1}
                  scale={GUIDE_PDF_SCALE}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </div>
            ))
          : null}
      </Document>
    </div>
  );
}
