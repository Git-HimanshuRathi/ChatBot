export default function Header({
  pdfName,
  pageCount,
  sourcesOpen,
  onToggleSources,
  showSourcesButton,
  onOpenTests,
  testLoading,
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-12 px-4 bg-bg-main border-b border-border/20">
      {/* Left — PDF info */}
      <div className="flex items-center gap-2 min-w-0">
        {pdfName ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent flex-shrink-0">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="text-sm font-medium text-text-primary truncate max-w-[240px]">
              {pdfName}
            </span>
            {pageCount && (
              <span className="text-xs text-text-muted flex-shrink-0">· {pageCount} pages</span>
            )}
          </>
        ) : (
          <span className="text-sm font-medium text-text-secondary">PDF Chat Agent</span>
        )}
      </div>

      {/* Right — Sample Test + Sources toggle */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Sample Test button */}
        <button
          onClick={onOpenTests}
          disabled={testLoading}
          title="Load sample PDF and run test cases"
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            transition-all duration-150 disabled:cursor-not-allowed
            ${testLoading
              ? "bg-accent/10 text-accent/50"
              : "bg-accent text-white hover:bg-accent/80 shadow-sm"
            }
          `}
        >
          {testLoading ? (
            <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          )}
          {testLoading ? "Loading…" : "Sample Test"}
        </button>

        {/* Sources toggle */}
        {showSourcesButton && (
          <button
            onClick={onToggleSources}
            className={`
              p-2 rounded-lg transition-colors text-sm flex items-center gap-1.5
              ${sourcesOpen
                ? "bg-bg-active text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }
            `}
            title="Toggle sources panel"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="text-xs hidden sm:inline">Sources</span>
          </button>
        )}
      </div>
    </header>
  );
}
