import { useState, useRef } from "react";

export default function PDFUpload({ onUpload, isUploading, uploadError }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please select a PDF file.");
      return;
    }
    onUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-accent">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
            stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="12" x2="12" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Upload a PDF to start chatting
      </h2>
      <p className="text-sm text-text-secondary mb-8 text-center max-w-xs leading-relaxed">
        The agent will answer questions strictly from the content of your document,
        with page-level citations.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`
          w-full max-w-sm rounded-2xl border-2 border-dashed px-8 py-10
          flex flex-col items-center gap-3 cursor-pointer transition-colors duration-150
          ${dragOver
            ? "border-accent bg-accent/5"
            : "border-border/60 hover:border-accent/50 hover:bg-bg-hover"
          }
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {isUploading ? (
          <>
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">Processing PDF...</p>
          </>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-text-muted">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="text-center">
              <p className="text-sm text-text-primary font-medium">
                Drop your PDF here
              </p>
              <p className="text-xs text-text-muted mt-1">or click to browse</p>
            </div>
          </>
        )}
      </div>

      {uploadError && (
        <p className="mt-4 text-sm text-red-400 text-center max-w-xs">{uploadError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}
