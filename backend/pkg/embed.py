import os
import shelve
from datetime import timedelta
from hashlib import sha256

import modal
from flufl.lock import Lock
from sentence_transformers import SentenceTransformer

from .helpers import (
    EMBED_CACHE_PATH,
    LOCK_FILE,
    chunks,
)
from .modal_setup import EMBEDDING_MODEL_NAME


class Model:
    def init_model(self):
        self.model = SentenceTransformer(
            EMBEDDING_MODEL_NAME,
        )

    def __enter__(self):
        self.init_model()

    def __exit__(self, *args):
        pass

    def uncached_embed(self, texts: list[str]) -> list[str]:
        if not hasattr(self, "model"):
            self.init_model()
        embeddings = self.model.encode(texts, show_progress_bar=True)
        return embeddings


def _get_embedding_cache_key(text: str, model_name: str):
    return f'embedding:{model_name}:{sha256(text.encode("utf-8")).hexdigest()}'


def embed(texts: list[str]) -> list[str]:
    with Lock(str(LOCK_FILE), default_timeout=timedelta(hours=1)):
        with shelve.open(str(EMBED_CACHE_PATH)) as cache:
            results = {
                key: cache.get(_get_embedding_cache_key(key, EMBEDDING_MODEL_NAME))
                for key in texts
            }
            uncached = [text for text in texts if results[text] is None]

    print(
        "total: %s, cached: %s, uncached: %s"
        % (len(texts), len(texts) - len(uncached), len(uncached))
    )
    if len(uncached) > 0:
        chunked_texts = list(chunks(uncached, 256))
        print("Total texts: %s, chunks: %s" % (len(texts), len(chunked_texts)))
        model = Model()
        uncached_preds_ = list(map(model.uncached_embed, chunked_texts))
        uncached_preds = [pred for chunk in uncached_preds_ for pred in chunk]
        with Lock(str(LOCK_FILE), default_timeout=timedelta(hours=1)):
            with shelve.open(str(EMBED_CACHE_PATH)) as cache:
                for text, pred in zip(uncached, uncached_preds):
                    results[text] = pred
                    cache[_get_embedding_cache_key(text, EMBEDDING_MODEL_NAME)] = pred

    return [results[text] for text in texts]  # type: ignore
