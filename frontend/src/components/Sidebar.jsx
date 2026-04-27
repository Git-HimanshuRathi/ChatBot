import { useState } from "react";

export default function Sidebar({
  chats,
  activeChatId,
  isOpen,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onToggle,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <aside
      className={`
        flex flex-col h-full bg-bg-sidebar
        transition-all duration-300 ease-in-out
        ${isOpen ? "w-[240px] min-w-[240px]" : "w-0 min-w-0 overflow-hidden"}
      `}
    >
      {/* Top */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2 px-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-accent flex-shrink-0">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="text-sm font-semibold text-text-primary">PDF Chat</span>
        </div>

        <button
          onClick={onNewChat}
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="New chat"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider px-2 py-2">
          Recent
        </div>
        <nav className="flex flex-col gap-0.5">
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isHovered = chat.id === hoveredId;

            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                onMouseEnter={() => setHoveredId(chat.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`
                  group relative flex flex-col w-full text-left
                  px-3 py-2 rounded-lg text-sm transition-colors duration-150
                  ${isActive
                    ? "bg-bg-active text-text-primary"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }
                `}
              >
                <div className="flex items-center gap-2 w-full">
                  {chat.pdfLoaded ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-accent flex-shrink-0">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                        stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full border border-border/60 flex-shrink-0" />
                  )}
                  <span className="truncate flex-1">{chat.title}</span>
                  {(isHovered || isActive) && (
                    <span
                      onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                      className="flex-shrink-0 p-0.5 rounded text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                      </svg>
                    </span>
                  )}
                </div>
                {chat.pdfName && (
                  <span className="text-[10px] text-text-muted truncate pl-[19px] mt-0.5">
                    {chat.pdfName}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <p className="text-[11px] text-text-muted px-1 leading-relaxed">
          Answers are grounded strictly in the uploaded PDF.
        </p>
      </div>
    </aside>
  );
}
