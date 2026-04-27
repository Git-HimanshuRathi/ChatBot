import Header from "./Header";
import ChatWindow from "./ChatWindow";
import ChatInput from "./ChatInput";
import PDFUpload from "./PDFUpload";
import SourcesPanel from "./SourcesPanel";

export default function MainLayout({
  chat,
  isStreaming,
  isUploading,
  uploadError,
  sourcesOpen,
  onSend,
  onUpload,
  onToggleSources,
  onOpenTests,
  testLoading,
}) {
  return (
    <div className="flex-1 flex h-full min-w-0">
      {/* Chat area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-bg-main relative">
        <Header
          pdfName={chat.pdfName}
          pageCount={chat.pageCount}
          sourcesOpen={sourcesOpen}
          onToggleSources={onToggleSources}
          showSourcesButton={chat.pdfLoaded && chat.messages.length > 0}
          onOpenTests={onOpenTests}
          testLoading={testLoading}
        />

        {chat.pdfLoaded ? (
          <>
            <ChatWindow
              messages={chat.messages}
              isStreaming={isStreaming}
            />
            <ChatInput onSend={onSend} disabled={isStreaming} />
          </>
        ) : (
          <PDFUpload
            onUpload={onUpload}
            isUploading={isUploading}
            uploadError={uploadError}
          />
        )}
      </main>

      {/* Sources panel */}
      <SourcesPanel
        data={{ sources: chat.lastSources, debug: chat.lastDebug }}
        isOpen={sourcesOpen}
        onToggle={onToggleSources}
        pdfName={chat.pdfName}
        pageCount={chat.pageCount}
      />
    </div>
  );
}
