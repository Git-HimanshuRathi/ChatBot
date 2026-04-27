import Markdown from "react-markdown";

export default function ChatMessage({ message, isLast, isStreaming }) {
  const isUser = message.role === "user";
  const confidence = message.debug?.confidence;
  const isOutOfScope = message.debug?.flags?.includes("out_of_scope_refused");

  return (
    <div className={`animate-fade-in-up mb-6 ${isUser ? "flex justify-end" : ""}`}>
      <div
        className={`
          ${isUser
            ? "bg-bg-user-msg rounded-2xl px-4 py-3 max-w-[85%] text-text-primary"
            : "max-w-full text-text-primary"
          }
        `}
      >
        {/* Assistant avatar */}
        {!isUser && (
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-text-primary">PDF Chat</span>
          </div>
        )}

        {/* Content */}
        <div className={`text-[15px] leading-7 break-words ${!isUser ? "pl-9" : ""}`}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <>
              <div className="markdown-body">
                <Markdown
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    strong: ({ children }) => (
                      <strong className="font-semibold text-text-primary">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-text-secondary">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
                    ),
                    li: ({ children }) => <li className="text-text-primary">{children}</li>,
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mb-2 mt-4">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-bold mb-1.5 mt-2">{children}</h3>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      return isBlock ? (
                        <pre className="bg-bg-input rounded-lg p-3 my-3 overflow-x-auto border border-border/30">
                          <code className="text-sm font-mono text-text-primary">{children}</code>
                        </pre>
                      ) : (
                        <code className="bg-bg-input px-1.5 py-0.5 rounded text-sm font-mono text-accent border border-border/30">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <>{children}</>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-accent/50 pl-4 my-3 text-text-secondary italic">
                        {children}
                      </blockquote>
                    ),
                    hr: () => <hr className="border-border/30 my-4" />,
                    a: ({ href, children }) => (
                      <a href={href} className="text-accent hover:underline"
                        target="_blank" rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.content || (isStreaming ? "" : "...")}
                </Markdown>
              </div>

              {/* Streaming cursor */}
              {isStreaming && isLast && (
                <span className="animate-blink ml-0.5 inline-block w-[2px] h-4 bg-text-primary align-text-bottom" />
              )}
            </>
          )}
        </div>

        {/* Out-of-scope badge */}
        {!isUser && isOutOfScope && !isStreaming && (
          <div className="pl-9 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Out of scope — not found in the uploaded document
            </span>
          </div>
        )}

        {/* Low confidence (non-scope) warning */}
        {!isUser && confidence === "low" && !isOutOfScope && !isStreaming && (
          <div className="pl-9 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Low confidence — verify against the source document
            </span>
          </div>
        )}

        {/* Page citations */}
        {!isUser && message.sources?.length > 0 && !isStreaming && (
          <div className="pl-9 mt-3 pt-3 border-t border-border/30">
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
              Citations
            </div>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((src, j) => (
                <span
                  key={j}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-bg-input rounded-md text-xs text-text-secondary border border-border/50"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" className="text-text-muted"
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {src.page != null ? (
                    <span>Page {src.page}</span>
                  ) : (
                    <span>{(src.document || src.document_name)?.replace(".pdf", "")}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
