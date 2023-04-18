import asyncio
import os
import pickle
from typing import Dict, List

import modal
import numpy as np
import openai
from diskcache import Cache
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from flufl.lock import Lock
from nltk.tokenize import sent_tokenize
from pydantic import BaseModel

from .embed import embed
from .helpers import (
    CACHE_ROOT,
    count_tokens,
    get_sentence_indices,
    split_text_to_chunks,
    summarize_text,
)
from .modal_setup import image, stub, volume

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/ping")
async def ping():
    return "pong"


class SummarizeFlattenedText(BaseModel):
    text: str
    token_count: int


class FlattenedTreeNode(BaseModel):
    text: str
    sentence_indices: List[List[int]]
    children_in_next_level: List[int]


class SummarizeFlattenedTextResponse(BaseModel):
    flattened_tree: List[List[FlattenedTreeNode]]


async def summarize_flattened_text(text_chunk: SummarizeFlattenedText):
    text = text_chunk.text
    model = "gpt-3.5-turbo"
    tokens_per_chunk = text_chunk.token_count
    num_tokens = count_tokens(text, model)
    print(f"Num tokens: {num_tokens}")
    if num_tokens > 30000:
        splits = split_text_to_chunks(text_chunk.text, 30000, model)
        text = splits[0]

    # chunk into tokens_per_chunk chunks
    result = [
        [
            FlattenedTreeNode(
                text=chunk,
                sentence_indices=get_sentence_indices(chunk),
                children_in_next_level=[],
            )
            for chunk in split_text_to_chunks(text, tokens_per_chunk, model)
        ]
    ]

    depth = 0

    while len(result[0]) > 1:
        layer: List[FlattenedTreeNode] = result[0]

        chunks, children_in_next_level, running_token_count = [[]], [[]], 0

        for i, node in enumerate(layer):
            if running_token_count + count_tokens(node.text, model) > 1000:
                chunks.append([node.text])
                children_in_next_level.append([i])
                running_token_count = count_tokens(node.text, model)
            else:
                chunks[-1].append(node.text)
                children_in_next_level[-1].append(i)
                running_token_count += count_tokens(node.text, model)

        async def sum(chunk):
            return FlattenedTreeNode(
                text=await summarize_text("\n\n".join(chunk)),
                sentence_indices=[],
                children_in_next_level=[],
            )

        new_layer = await asyncio.gather(
            *[asyncio.create_task(sum(chunk)) for chunk in chunks]
        )

        new_layer = [
            FlattenedTreeNode(
                text=node.text,
                sentence_indices=get_sentence_indices(node.text),
                children_in_next_level=children,
            )
            for node, children in zip(new_layer, children_in_next_level)
        ]

        # for each chunk, summarize the text
        result.insert(
            0,
            new_layer,
        )

        depth += 1

    return SummarizeFlattenedTextResponse(flattened_tree=result)


inflight_requests: Dict[str, asyncio.Task] = {}

cache_lock_file = CACHE_ROOT / "summarize-flattened-text-endpoint.lock"
cache_lock = Lock(str(cache_lock_file))


@app.post("/summarize-flattened-text")
async def summarize_flattened_text_endpoint(text_chunk: SummarizeFlattenedText):
    key = text_chunk.text + str(text_chunk.token_count)
    # cache it here
    with cache_lock:
        with Cache(str(CACHE_ROOT / "summarize-flattened")) as c:
            if key in c:
                print("Pickle cache hit")
                return pickle.loads(c[key])

    if key in inflight_requests:
        return await inflight_requests[key]

    inflight_requests[key] = asyncio.create_task(summarize_flattened_text(text_chunk))

    result = await inflight_requests[key]
    with cache_lock:
        with Cache(str(CACHE_ROOT / "summarize-flattened")) as c:
            c[key] = pickle.dumps(result)
    return result


class Similarity(BaseModel):
    source: str
    target: List[str]


class SimilarityResponse(BaseModel):
    targetIndex: int
    sentenceIndex: int


@app.post("/similarity")
async def get_similarity(similarity: Similarity) -> SimilarityResponse:
    tokenized_target = [sent_tokenize(target) for target in similarity.target]
    flattened_target = [
        sentence for sentences in tokenized_target for sentence in sentences
    ]
    to_embed = [similarity.source] + flattened_target

    embeddings = embed(to_embed)

    source_embedding = embeddings[0]
    target_embeddings = embeddings[1:]

    # if target_embeddings is empty, return -1
    if len(target_embeddings) == 0:
        return SimilarityResponse(targetIndex=-1, sentenceIndex=-1)
    # make it an np array
    similarities = np.dot(source_embedding, np.array(target_embeddings).T)

    most_similar_index = np.argmax(similarities)

    # Find the target index and the sentence index
    target_index = 0
    sentence_index = 0
    counter = 0
    for i, tokenized_sentences in enumerate(tokenized_target):
        for j, _ in enumerate(tokenized_sentences):
            if counter == most_similar_index:
                target_index = i
                sentence_index = j
                break
            counter += 1
        if counter == most_similar_index:
            break

    return SimilarityResponse(targetIndex=target_index, sentenceIndex=sentence_index)


@stub.asgi(
    image=image,
    secret=modal.Secret.from_name("openai"),
    shared_volumes={str(CACHE_ROOT): volume},
    # gpu="any",
    keep_warm=1,
)
def fastapi_stub():
    CACHE_ROOT.mkdir(exist_ok=True)
    openai.api_key = os.environ["OPENAI_API_KEY"]
    return app


# # on startup
# @app.on_event("startup")
# async def startup_event():
#     import nltk

#     nltk.download("punkt")
#     import uvicorn

#     openai.api_key = os.environ["OPENAI_API_KEY"]
