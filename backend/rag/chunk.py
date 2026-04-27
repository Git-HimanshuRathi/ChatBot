"""
Character-based text chunking with page number tracking.
Each chunk carries the page_number of its source page.

Uses simple character-count chunking with word-boundary awareness
instead of transformer tokenization — no heavy ML dependencies required.
"""

# Approximate token-to-char ratio: ~5 chars per token
# Original CHUNK_SIZE=400 tokens → ~2000 chars
# Original CHUNK_OVERLAP=80 tokens → ~400 chars
CHUNK_SIZE_CHARS = 2000
CHUNK_OVERLAP_CHARS = 400


def chunk_documents(pages: list[dict]) -> list[dict]:
    """
    Split page-level text into character-based chunks with word-boundary awareness.

    Args:
        pages: List of dicts: { filename, page_number, text }

    Returns:
        List of chunk dicts: { chunk_id, document_name, page_number, text }
    """
    all_chunks = []
    chunk_id = 0

    for page in pages:
        filename = page["filename"]
        page_number = page["page_number"]
        text = page["text"]

        if not text or not text.strip():
            continue

        start = 0
        while start < len(text):
            end = min(start + CHUNK_SIZE_CHARS, len(text))

            # Snap to word boundary (don't split mid-word)
            if end < len(text):
                # Look for last space within the chunk
                space_pos = text.rfind(' ', start, end)
                if space_pos > start:
                    end = space_pos + 1  # include the space

            chunk_text = text[start:end].strip()

            if chunk_text:
                all_chunks.append({
                    "chunk_id": chunk_id,
                    "document_name": filename,
                    "page_number": page_number,
                    "text": chunk_text,
                })
                chunk_id += 1

            if end >= len(text):
                break
            start = end - CHUNK_OVERLAP_CHARS
            # Ensure forward progress
            if start <= (end - CHUNK_SIZE_CHARS):
                start = end

    print(f"  Chunked {len(pages)} pages into {len(all_chunks)} chunks "
          f"(size≈{CHUNK_SIZE_CHARS} chars, overlap≈{CHUNK_OVERLAP_CHARS} chars)")
    return all_chunks
