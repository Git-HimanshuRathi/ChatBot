"""
Lightweight embedding generation and FAISS index management.
- Uses hashing-based vectorization (no ML models, no GPU, minimal RAM)
- Character n-gram hashing projected to fixed-dimension dense vectors
- L2 normalization for cosine similarity (IndexFlatIP)
- In-memory only — no disk persistence (session-based use)

NOTE: This is a lightweight alternative to sentence-transformers for
low-resource environments (e.g., 2GB RAM, no GPU). Semantic quality
is lower but sufficient for keyword-overlap-based retrieval in a demo/MVP.
"""
import hashlib
import re
from typing import Optional

import numpy as np
import faiss

# ─── Configuration ──────────────────────────────────────────────────────────
EMBED_DIM = 256          # Dimension of the output embedding vectors
NGRAM_RANGE = (2, 4)     # Character n-gram sizes to use
NUM_HASH_FEATURES = 4096 # Intermediate hash space (projected down to EMBED_DIM)

_projection_matrix: Optional[np.ndarray] = None


def _get_projection_matrix() -> np.ndarray:
    """
    Lazily initialize a fixed random projection matrix.
    Uses a fixed seed so embeddings are deterministic across runs.
    """
    global _projection_matrix
    if _projection_matrix is None:
        rng = np.random.RandomState(42)
        _projection_matrix = rng.randn(NUM_HASH_FEATURES, EMBED_DIM).astype(np.float32)
        # Normalize columns for better numeric stability
        norms = np.linalg.norm(_projection_matrix, axis=0, keepdims=True)
        _projection_matrix /= norms
    return _projection_matrix


def _tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, and split into word tokens."""
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    return text.split()


def _char_ngrams(text: str, ngram_range: tuple[int, int] = NGRAM_RANGE) -> list[str]:
    """Extract character n-grams from text."""
    text = text.lower().strip()
    ngrams = []
    for n in range(ngram_range[0], ngram_range[1] + 1):
        for i in range(len(text) - n + 1):
            ngrams.append(text[i:i + n])
    return ngrams


def _hash_embed_single(text: str) -> np.ndarray:
    """
    Convert text to a fixed-dimension dense vector using hashing trick + random projection.

    Steps:
    1. Extract character n-grams and word unigrams from text
    2. Hash each feature to a bucket in a high-dimensional sparse space
    3. Project down to EMBED_DIM using a fixed random matrix
    """
    # Combine word tokens and character n-grams for richer signal
    words = _tokenize(text)
    ngrams = _char_ngrams(text)
    features = words + ngrams

    # Hashing trick: map features to sparse vector
    sparse = np.zeros(NUM_HASH_FEATURES, dtype=np.float32)
    for feat in features:
        h = int(hashlib.md5(feat.encode('utf-8')).hexdigest(), 16)
        bucket = h % NUM_HASH_FEATURES
        sign = 1 if (h // NUM_HASH_FEATURES) % 2 == 0 else -1
        sparse[bucket] += sign

    # Random projection to dense low-dimensional space
    proj = _get_projection_matrix()
    dense = sparse @ proj  # (NUM_HASH_FEATURES,) @ (NUM_HASH_FEATURES, EMBED_DIM) → (EMBED_DIM,)

    return dense


def _hash_embed_batch(texts: list[str]) -> np.ndarray:
    """Embed a batch of texts, returning (N, EMBED_DIM) float32 array."""
    embeddings = np.array([_hash_embed_single(t) for t in texts], dtype=np.float32)
    return embeddings


def get_model():
    """
    Initialize the embedding system (projection matrix).
    Kept for API compatibility with callers that pre-warm the model.
    """
    _get_projection_matrix()
    print("  ✓ Lightweight hash-based embedding ready (no ML model needed)")
    return None


def build_index(chunks: list[dict]) -> tuple[faiss.Index, list[dict]]:
    """
    Generate embeddings and build an in-memory FAISS IndexFlatIP.

    Args:
        chunks: List of chunk dicts with keys: chunk_id, document_name, page_number, text

    Returns:
        Tuple of (FAISS index, chunk metadata list)
    """
    texts = [c["text"] for c in chunks]
    print(f"  Generating embeddings for {len(texts)} chunks...")
    embeddings = _hash_embed_batch(texts)
    faiss.normalize_L2(embeddings)

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    print(f"  ✓ FAISS index: {index.ntotal} vectors, dim={dimension}")
    return index, chunks


def embed_query(query: str) -> np.ndarray:
    """Generate and normalize embedding for a single query string."""
    embedding = _hash_embed_batch([query])
    faiss.normalize_L2(embedding)
    return embedding
