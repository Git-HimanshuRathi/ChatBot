import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import MainLayout from "./components/MainLayout";
import TestCasesPanel from "./components/TestCasesPanel";

const API_URL = import.meta.env.VITE_API_URL || "";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createNewChat() {
  return {
    id: generateId(),
    title: "New chat",
    messages: [],
    pdfLoaded: false,
    pdfName: null,
    pageCount: null,
    lastSources: null,
    lastDebug: null,
  };
}

export default function App() {
  const [chats, setChats] = useState([createNewChat()]);
  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const abortRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];

  const updateChat = useCallback((chatId, updater) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? updater(c) : c)));
  }, []);

  const handleNewChat = useCallback(() => {
    const chat = createNewChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setUploadError(null);
  }, []);

  const handleDeleteChat = useCallback(
    (chatId) => {
      setChats((prev) => {
        const filtered = prev.filter((c) => c.id !== chatId);
        if (filtered.length === 0) {
          const fresh = createNewChat();
          setActiveChatId(fresh.id);
          return [fresh];
        }
        if (chatId === activeChatId) setActiveChatId(filtered[0].id);
        return filtered;
      });
    },
    [activeChatId],
  );

  const handleSelectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    setUploadError(null);
    setSourcesOpen(false);
  }, []);

  // Upload a PDF for the active chat session
  const handleUpload = useCallback(
    async (file) => {
      const chatId = activeChatId;
      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("session_id", chatId);

        const res = await fetch(`${API_URL}/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Upload failed." }));
          throw new Error(err.detail || "Upload failed.");
        }

        const data = await res.json();
        updateChat(chatId, (c) => ({
          ...c,
          pdfLoaded: true,
          pdfName: data.pdf_name,
          pageCount: data.page_count,
          title: data.pdf_name.replace(".pdf", ""),
        }));
      } catch (err) {
        setUploadError(err.message);
      } finally {
        setIsUploading(false);
      }
    },
    [activeChatId, updateChat],
  );

  const handleSend = useCallback(
    async (text) => {
      if (!text.trim() || isStreaming) return;

      const userMsg = { id: generateId(), role: "user", content: text };
      const assistantMsg = { id: generateId(), role: "assistant", content: "" };
      const chatId = activeChatId;

      updateChat(chatId, (c) => ({
        ...c,
        messages: [...c.messages, userMsg, assistantMsg],
      }));

      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_URL}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text, session_id: chatId }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let eventType = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (eventType === "chunk" && parsed.text) {
                  fullText += parsed.text;
                  updateChat(chatId, (c) => ({
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: fullText } : m,
                    ),
                  }));
                } else if (eventType === "metadata") {
                  updateChat(chatId, (c) => ({
                    ...c,
                    lastSources: parsed.sources,
                    lastDebug: parsed.debug,
                    messages: c.messages.map((m) =>
                      m.id === assistantMsg.id
                        ? { ...m, sources: parsed.sources, debug: parsed.debug }
                        : m,
                    ),
                  }));
                  setSourcesOpen(true);
                }
              } catch {
                /* skip unparseable lines */
              }
            }
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        // Fallback to non-streaming /chat
        try {
          const res = await fetch(`${API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: text, session_id: chatId }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          updateChat(chatId, (c) => ({
            ...c,
            lastSources: data.sources,
            lastDebug: data.debug,
            messages: c.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: data.response, sources: data.sources, debug: data.debug }
                : m,
            ),
          }));
          setSourcesOpen(true);
        } catch (fallbackErr) {
          updateChat(chatId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content: `Could not connect to backend.\n\nStart it with:\n\`uvicorn main:app --port 8000 --reload\`\n\n${fallbackErr.message}`,
                  }
                : m,
            ),
          }));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [activeChatId, isStreaming, updateChat],
  );

  // Load sample PDF into the current chat (if not already loaded), then open test panel
  const handleOpenTests = useCallback(async () => {
    if (!activeChat.pdfLoaded) {
      setTestLoading(true);
      try {
        const formData = new FormData();
        formData.append("session_id", activeChatId);
        const res = await fetch(`${API_URL}/load-sample`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Could not load sample PDF.");
        const data = await res.json();
        updateChat(activeChatId, (c) => ({
          ...c,
          pdfLoaded: true,
          pdfName: data.pdf_name,
          pageCount: data.page_count,
        }));
      } catch (err) {
        setUploadError(err.message);
        setTestLoading(false);
        return;
      }
      setTestLoading(false);
    }
    setTestPanelOpen(true);
  }, [activeChat.pdfLoaded, activeChatId, updateChat]);

  return (
    <div className="flex h-full">
      <TestCasesPanel
        isOpen={testPanelOpen}
        onClose={() => setTestPanelOpen(false)}
        onRunQuery={handleSend}
        pdfLoaded={activeChat.pdfLoaded}
      />
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        isOpen={true}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onToggle={() => {}}
      />
      <MainLayout
        chat={activeChat}
        isStreaming={isStreaming}
        isUploading={isUploading}
        uploadError={uploadError}
        sourcesOpen={sourcesOpen}
        onSend={handleSend}
        onUpload={handleUpload}
        onToggleSources={() => setSourcesOpen((o) => !o)}
        onOpenTests={handleOpenTests}
        testLoading={testLoading}
      />
    </div>
  );
}
