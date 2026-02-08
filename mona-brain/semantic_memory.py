"""Semantic memory search using sentence-transformers + FAISS.

Provides embedding-based retrieval so Mona can recall memories that are
semantically related to the current conversation, not just keyword matches.

Uses all-MiniLM-L6-v2 (~22M params, ~80MB) for embeddings.
FAISS IndexFlatIP for cosine-similarity search (inner product on L2-normed vectors).

Gracefully degrades to no-op if faiss-cpu or sentence-transformers are not installed.
"""

from __future__ import annotations

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Check if dependencies are available
_AVAILABLE = False
try:
    import numpy as np
    import faiss  # noqa: F401
    from sentence_transformers import SentenceTransformer  # noqa: F401

    _AVAILABLE = True
except ImportError:
    logger.warning(
        "sentence-transformers or faiss-cpu not installed — "
        "semantic memory search disabled. Install with: "
        "pip install sentence-transformers faiss-cpu"
    )

# Lazy-loaded model (only when _AVAILABLE)
_model = None


def _get_model():
    """Lazy-load the sentence-transformer model on first call."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Loaded sentence-transformer model: all-MiniLM-L6-v2")
    return _model


def embed_texts(texts: List[str]):
    """Encode a list of strings into L2-normalized embeddings."""
    import numpy as np

    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return np.asarray(embeddings, dtype="float32")


class SemanticIndex:
    """Per-user FAISS index mapping memory content to embeddings."""

    DIMENSION = 384  # all-MiniLM-L6-v2 output dim

    def __init__(self):
        import faiss

        self.index = faiss.IndexFlatIP(self.DIMENSION)
        self.texts: List[str] = []  # parallel list — texts[i] ↔ index row i
        self.keys: List[Optional[str]] = []  # memory keys for dedup

    @property
    def size(self) -> int:
        return self.index.ntotal

    def add(self, content: str, key: Optional[str] = None):
        """Add a single memory to the index."""
        vec = embed_texts([content])
        self.index.add(vec)
        self.texts.append(content)
        self.keys.append(key)

    def add_batch(self, contents: List[str], keys: Optional[List[Optional[str]]] = None):
        """Add multiple memories at once (more efficient than one-by-one)."""
        if not contents:
            return
        vecs = embed_texts(contents)
        self.index.add(vecs)
        self.texts.extend(contents)
        if keys:
            self.keys.extend(keys)
        else:
            self.keys.extend([None] * len(contents))

    def remove_by_key(self, key: str):
        """Remove a memory by key. Rebuilds the index (rare operation)."""
        import faiss

        indices_to_keep = [i for i, k in enumerate(self.keys) if k != key]
        if len(indices_to_keep) == len(self.keys):
            return  # nothing to remove

        kept_texts = [self.texts[i] for i in indices_to_keep]
        kept_keys = [self.keys[i] for i in indices_to_keep]

        # Rebuild index
        self.index = faiss.IndexFlatIP(self.DIMENSION)
        self.texts = kept_texts
        self.keys = kept_keys

        if kept_texts:
            vecs = embed_texts(kept_texts)
            self.index.add(vecs)

    def search(self, query: str, top_k: int = 5) -> List[tuple[str, float]]:
        """Find the top_k most semantically similar memories.

        Returns list of (content, score) tuples sorted by relevance.
        """
        if self.size == 0:
            return []

        query_vec = embed_texts([query])
        k = min(top_k, self.size)
        scores, indices = self.index.search(query_vec, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0:  # FAISS returns -1 for missing
                results.append((self.texts[idx], float(score)))
        return results


class SemanticMemoryStore:
    """Manages per-user semantic indices.

    If faiss-cpu or sentence-transformers are not installed, all methods
    are safe no-ops so the rest of the app works without semantic search.
    """

    def __init__(self):
        self._indices: dict[str, SemanticIndex] = {}
        self.available = _AVAILABLE

    def _get_index(self, user_id: str) -> SemanticIndex:
        if user_id not in self._indices:
            self._indices[user_id] = SemanticIndex()
        return self._indices[user_id]

    def index_memory(self, user_id: str, content: str, key: Optional[str] = None):
        """Add a memory to the user's semantic index."""
        if not self.available:
            return
        idx = self._get_index(user_id)
        idx.add(content, key)

    def index_memories_batch(
        self, user_id: str, contents: List[str], keys: Optional[List[Optional[str]]] = None
    ):
        """Batch-index multiple memories (used when loading from DB)."""
        if not self.available:
            return
        idx = self._get_index(user_id)
        idx.add_batch(contents, keys)

    def remove_memory(self, user_id: str, key: str):
        """Remove a memory from the semantic index by key."""
        if not self.available:
            return
        if user_id in self._indices:
            self._indices[user_id].remove_by_key(key)

    def search(self, user_id: str, query: str, top_k: int = 5) -> List[str]:
        """Search for semantically relevant memories.

        Returns list of memory content strings ranked by relevance.
        """
        if not self.available or user_id not in self._indices:
            return []
        results = self._indices[user_id].search(query, top_k)
        return [content for content, _score in results]

    def clear(self, user_id: str):
        """Clear a user's semantic index."""
        self._indices.pop(user_id, None)

    def has_index(self, user_id: str) -> bool:
        if not self.available:
            return False
        return user_id in self._indices and self._indices[user_id].size > 0
