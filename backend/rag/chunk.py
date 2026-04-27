"""
Token-based text chunking with page number tracking.
Each chunk carries the page_number of its source page.
"""
from transformers import AutoTokenizer

_tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

CHUNK_SIZE = 400
CHUNK_OVERLAP = 80


def chunk_documents(pages: list[dict]) -> list[dict]:
    """
    Split page-level text into token-based chunks.

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

        token_ids = _tokenizer.encode(text, add_special_tokens=False)

        start = 0
        while start < len(token_ids):
            end = min(start + CHUNK_SIZE, len(token_ids))
            chunk_text = _tokenizer.decode(token_ids[start:end], skip_special_tokens=True)

            all_chunks.append({
                "chunk_id": chunk_id,
                "document_name": filename,
                "page_number": page_number,
                "text": chunk_text,
            })
            chunk_id += 1

            if end >= len(token_ids):
                break
            start += CHUNK_SIZE - CHUNK_OVERLAP

    print(f"  Chunked {len(pages)} pages into {len(all_chunks)} chunks "
          f"(size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})")
    return all_chunks
