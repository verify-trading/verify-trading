"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { GuidePdfSkeleton } from "@/components/guide/guide-pdf-skeleton";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/** Min width so text stays readable; max avoids huge canvases on ultra-wide screens. */
const PAGE_WIDTH_MIN = 280;
const PAGE_WIDTH_MAX = 1000;

export function GuidePdfViewer() {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  useLayoutEffect(() => {
    function updateWidth() {
      const node = measureRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const inner = Math.floor(rect.width - padX);
      setPageWidth(Math.min(PAGE_WIDTH_MAX, Math.max(PAGE_WIDTH_MIN, inner)));
    }

    updateWidth();
    const node = measureRef.current;
    if (!node) return;

    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(node);
    window.addEventListener("orientationchange", updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", updateWidth);
    };
  }, []);

  const width = pageWidth ?? 360;

  return (
    <div
      ref={measureRef}
      className="box-border flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-auto overflow-x-hidden bg-[#111] px-4 py-4 sm:px-6 sm:py-6"
    >
      <Document
        file="/guide-pdf"
        loading={<GuidePdfSkeleton />}
        error={
          <p className="p-4 text-sm text-red-400" role="alert">
            Could not load the guide PDF.
          </p>
        }
        onLoadSuccess={onLoadSuccess}
        className="flex w-full min-w-0 flex-col items-center"
      >
        {numPages !== null
          ? Array.from({ length: numPages }, (_, i) => (
              <div
                key={i + 1}
                className="flex w-full max-w-full justify-center py-2 [&_.react-pdf__Page]:max-w-full [&_canvas]:!h-auto [&_canvas]:max-w-full"
              >
                <Page
                  pageNumber={i + 1}
                  width={width}
                  renderTextLayer
                  renderAnnotationLayer
                  className="shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
                />
              </div>
            ))
          : null}
      </Document>
    </div>
  );
}
