"""
Embedding generation and FAISS index management.
- Uses sentence-transformers all-MiniLM-L6-v2
- L2 normalization for cosine similarity (IndexFlatIP)
- In-memory only — no disk persistence (session-based use)
"""
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print("  Loading embedding model: paraphrase-multilingual-MiniLM-L12-v2 ...")
        _model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        print("  ✓ Embedding model loaded")
    return _model


def build_index(chunks: list[dict]) -> tuple[faiss.Index, list[dict]]:
    """
    Generate embeddings and build an in-memory FAISS IndexFlatIP.

    Args:
        chunks: List of chunk dicts with keys: chunk_id, document_name, page_number, text

    Returns:
        Tuple of (FAISS index, chunk metadata list)
    """
    model = get_model()

    texts = [c["text"] for c in chunks]
    print(f"  Generating embeddings for {len(texts)} chunks...")
    embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    embeddings = embeddings.astype(np.float32)
    faiss.normalize_L2(embeddings)

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    print(f"  ✓ FAISS index: {index.ntotal} vectors, dim={dimension}")
    return index, chunks


def embed_query(query: str) -> np.ndarray:
    """Generate and normalize embedding for a single query string."""
    model = get_model()
    embedding = model.encode([query], convert_to_numpy=True).astype(np.float32)
    faiss.normalize_L2(embedding)
    return embedding
