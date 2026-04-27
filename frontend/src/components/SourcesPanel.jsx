export default function SourcesPanel({ data, isOpen, onToggle, pdfName, pageCount }) {
  const sources = data?.sources || [];
  const debug = data?.debug;

  if (!isOpen) return null;

  return (
    <div className="w-[280px] min-w-[280px] h-full bg-bg-sidebar border-l border-border/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Sources
        </span>
        <button
          onClick={onToggle}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Active document */}
        {pdfName && (
          <Section title="Document">
            <div className="flex items-start gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                className="text-accent mt-0.5 flex-shrink-0"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
              </svg>
              <div className="min-w-0">
                <p className="text-[12px] text-text-primary font-medium truncate">{pdfName}</p>
                {pageCount && (
                  <p className="text-[11px] text-text-muted">{pageCount} pages</p>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Retrieved sources for last response */}
        {sources.length > 0 ? (
          <Section title={`Retrieved (${sources.length})`}>
            <div className="space-y-2">
              {sources.map((src, i) => (
                <div key={i} className="bg-bg-input rounded-lg p-2.5 border border-border/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-accent truncate">
                      {(src.document || src.document_name)?.replace(".pdf", "")}
                    </span>
                    {src.page != null && (
                      <span className="text-[10px] text-text-muted bg-bg-main px-1.5 py-0.5 rounded border border-border/30 flex-shrink-0">
                        p.{src.page}
                      </span>
                    )}
                  </div>
                  {src.relevance_score != null && (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-[10px] text-text-muted mb-0.5">
                        <span>Relevance</span>
                        <span>{(src.relevance_score * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1 bg-bg-main rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent/50 rounded-full"
                          style={{ width: `${Math.min(src.relevance_score * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ) : (
          !pdfName && (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-text-muted text-center leading-relaxed">
                Upload a PDF and ask a question to see source citations here.
              </p>
            </div>
          )
        )}

        {/* Evaluator */}
        {debug && (
          <Section title="Evaluator">
            <Row
              label="Confidence"
              value={
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold
                  ${debug.confidence === "high"
                    ? "bg-green-500/15 text-green-400 border border-green-500/20"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {debug.confidence === "high" ? "✓" : "⚠"} {debug.confidence}
                </span>
              }
            />
            <Row label="Latency" value={`${debug.latency_ms?.toLocaleString()} ms`} />
            {debug.flags?.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {debug.flags.map((flag, i) => (
                  <div key={i} className={`text-[11px] font-mono rounded px-2 py-1 border
                    ${flag === "out_of_scope_refused"
                      ? "text-blue-400 bg-blue-500/10 border-blue-500/15"
                      : "text-amber-400 bg-amber-500/10 border-amber-500/15"
                    }`}
                  >
                    {flag === "out_of_scope_refused" ? "↩" : "⚠"} {flag}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-bg-main/50 rounded-lg p-3 border border-border/20">
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary font-medium">{value}</span>
    </div>
  );
}
