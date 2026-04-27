const VALID_QUERIES = [
  {
    id: "V1",
    query: "What is the purpose of this employee handbook?",
    expected: "Answer with page citation — describes the handbook's purpose from the document.",
  },
  {
    id: "V2",
    query: "What are the standard working hours?",
    expected: "Answer with page citation — states specific working hours from the document.",
  },
  {
    id: "V3",
    query: "What is the code of conduct expected from employees?",
    expected: "Answer with page citation — lists conduct expectations from the document.",
  },
  {
    id: "V4",
    query: "What is the process for reporting workplace grievances?",
    expected: "Answer with page citation — explains the reporting/grievance procedure.",
  },
  {
    id: "V5",
    query: "What are the employee responsibilities regarding company property?",
    expected: "Answer with page citation — describes property handling rules from the document.",
  },
];

const INVALID_QUERIES = [
  {
    id: "OOS1",
    query: "What is the capital of France?",
    expected: "Refusal — 'This information is not available in the uploaded document.'",
  },
  {
    id: "OOS2",
    query: "Write me a poem about the company.",
    expected: "Refusal — creative tasks outside document scope are declined.",
  },
  {
    id: "OOS3",
    query: "What is the current stock price of this company?",
    expected: "Refusal — financial data not present in the document.",
  },
];

const MULTILINGUAL_QUERIES = [
  {
    id: "ML1",
    lang: "हिंदी",
    flag: "🇮🇳",
    query: "इस कर्मचारी हैंडबुक का उद्देश्य क्या है?",
    expected: "Answer in Hindi with page citation — same content as V1 but in Hindi.",
  },
  {
    id: "ML2",
    lang: "Español",
    flag: "🇪🇸",
    query: "¿Cuál es el código de conducta esperado de los empleados?",
    expected: "Answer in Spanish with page citation — same content as V3 but in Spanish.",
  },
  {
    id: "ML3",
    lang: "Français",
    flag: "🇫🇷",
    query: "Quelle est la procédure pour signaler des griefs au travail?",
    expected: "Answer in French with page citation — same content as V4 but in French.",
  },
  {
    id: "ML4",
    lang: "Deutsch",
    flag: "🇩🇪",
    query: "Was sind die Standardarbeitszeiten?",
    expected: "Answer in German with page citation — same content as V2 but in German.",
  },
];

export default function TestCasesPanel({ isOpen, onClose, onRunQuery, pdfLoaded }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-bg-sidebar rounded-2xl border border-border/40 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Sample Test</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Task 3 — PDF-Constrained Conversational Agent
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Sample PDF info */}
          <div className="bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent mt-0.5 flex-shrink-0">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
            </svg>
            <div className="text-xs text-text-secondary leading-relaxed">
              <span className="font-medium text-text-primary">Sample PDF:</span>{" "}
              <code className="bg-bg-input px-1.5 py-0.5 rounded border border-border/40 text-accent">
                tests/sample.pdf
              </code>
              {" "}(Employee Handbook 2024) — included in the repo.
              Upload it to run the valid queries below.
              {!pdfLoaded && (
                <span className="block mt-1 text-amber-400">
                  Upload a PDF first to enable clicking queries.
                </span>
              )}
            </div>
          </div>

          {/* Valid queries */}
          <Section
            title="Valid Queries"
            count={VALID_QUERIES.length}
            badge="In-scope"
            badgeColor="green"
            description="Expect: direct answer with page citation(s)"
          >
            {VALID_QUERIES.map((tc) => (
              <QueryCard
                key={tc.id}
                tc={tc}
                type="valid"
                disabled={!pdfLoaded}
                onRun={() => { onRunQuery(tc.query); onClose(); }}
              />
            ))}
          </Section>

          {/* Invalid queries */}
          <Section
            title="Out-of-Scope Queries"
            count={INVALID_QUERIES.length}
            badge="Out-of-scope"
            badgeColor="blue"
            description="Expect: refusal — 'This information is not available in the uploaded document.'"
          >
            {INVALID_QUERIES.map((tc) => (
              <QueryCard
                key={tc.id}
                tc={tc}
                type="invalid"
                disabled={!pdfLoaded}
                onRun={() => { onRunQuery(tc.query); onClose(); }}
              />
            ))}
          </Section>

          {/* Multilingual queries */}
          <Section
            title="Multilingual Queries"
            count={MULTILINGUAL_QUERIES.length}
            badge="Bonus"
            badgeColor="purple"
            description="Expect: answer in the query's language with page citation — grounding maintained across languages"
          >
            {MULTILINGUAL_QUERIES.map((tc) => (
              <QueryCard
                key={tc.id}
                tc={tc}
                type="multilingual"
                disabled={!pdfLoaded}
                onRun={() => { onRunQuery(tc.query); onClose(); }}
              />
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, badge, badgeColor, description, children }) {
  const colors = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-text-primary">{title}</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colors[badgeColor]}`}>
          {badge} · {count}
        </span>
      </div>
      <p className="text-[11px] text-text-muted mb-3">{description}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function QueryCard({ tc, type, disabled, onRun }) {
  const isValid = type === "valid";
  const isMultilingual = type === "multilingual";

  return (
    <div className="rounded-xl border border-border/30 bg-bg-main/40 p-3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-text-muted">{tc.id}</span>
            {isMultilingual && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {tc.flag} {tc.lang}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-text-primary leading-relaxed">
            "{tc.query}"
          </p>
          <p className={`text-[11px] mt-1.5 leading-relaxed ${
            isMultilingual ? "text-purple-400/80" : isValid ? "text-green-400/80" : "text-blue-400/80"
          }`}>
            {isMultilingual ? "🌐" : isValid ? "✓" : "↩"} {tc.expected}
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={disabled}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors
            ${disabled
              ? "bg-bg-input text-text-muted cursor-not-allowed opacity-50"
              : "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 cursor-pointer"
            }`}
          title={disabled ? "Upload a PDF first" : "Send this query"}
        >
          Run
        </button>
      </div>
    </div>
  );
}
