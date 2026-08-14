"use client";

import { tapFeedback } from "@/lib/haptics";

/**
 * Print, or save as PDF.
 *
 * The browser's own print dialog is the PDF exporter — on iOS the share sheet
 * offers "Save to Files", on a Mac the PDF dropdown. Shipping a PDF library
 * to do what the platform already does well would add megabytes and a second
 * rendering engine that has to be kept looking like the first.
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback("medium");
        window.print();
      }}
      className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 text-sm font-bold text-white transition-colors hover:bg-brand-blue/90"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 9V3h12v6M6 18H4v-6h16v6h-2" strokeLinejoin="round" />
        <path d="M6 14h12v7H6z" strokeLinejoin="round" />
      </svg>
      Print or save as PDF
    </button>
  );
}
