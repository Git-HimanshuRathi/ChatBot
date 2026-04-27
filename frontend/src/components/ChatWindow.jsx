import { useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";

export default function ChatWindow({ messages, isStreaming }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
              stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Ask anything about your document
        </h2>
        <p className="text-sm text-text-secondary max-w-xs leading-relaxed">
          All answers are sourced directly from the uploaded PDF with page citations.
          Out-of-scope questions will be declined.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[768px] mx-auto px-4 py-6">
        {messages.map((msg, i) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isLast={i === messages.length - 1}
            isStreaming={
              isStreaming && i === messages.length - 1 && msg.role === "assistant"
            }
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
