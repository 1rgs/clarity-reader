import asyncio
import json

import os
from typing import Dict, List
from .embed import embed
import modal
import openai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from nltk.tokenize import sent_tokenize
import numpy as np
import uvicorn
import nltk

from .helpers import (
    CACHE_ROOT,
    SummaryNode,
    count_tokens,
    get_sentence_indices,
    split_text_into_roughly_equal_chunks_by_num_sentences,
    split_text_to_chunks,
    summarize_text,
)

# from .modal_setup import image, stub, volume


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


BRANCHING_FACTOR = 4
MAX_DEPTH = 4


async def create_summary_tree(
    text: str, tokens_per_chunk: int, model: str, depth: int = 0
) -> SummaryNode:
    num_tokens = count_tokens(text, model)
    print(f"Num tokens: {num_tokens}")
    if num_tokens > 30000:
        splits = split_text_to_chunks(text, 30000, model)

        text = splits[0]

    if num_tokens <= tokens_per_chunk or depth >= MAX_DEPTH:
        return SummaryNode(
            text=text, children=[], sentence_indices=get_sentence_indices(text)
        )

    chunks = split_text_into_roughly_equal_chunks_by_num_sentences(
        text, BRANCHING_FACTOR
    )

    children = await asyncio.gather(
        *[
            create_summary_tree(chunk, tokens_per_chunk, model, depth + 1)
            for chunk in chunks
        ],
    )

    summarized_texts = [
        child.text if isinstance(child, SummaryNode) else "" for child in children
    ]
    summarized_text = await summarize_text("\n\n".join(summarized_texts))

    return SummaryNode(
        text=summarized_text,
        children=children,
        sentence_indices=get_sentence_indices(summarized_text),
    )


class SummarizeText(BaseModel):
    text: str
    token_count: int


@app.post("/summarize-text")
async def summarize_text_endpoint(text_chunk: SummarizeText):
    return await create_summary_tree(
        text_chunk.text, text_chunk.token_count, "gpt-3.5-turbo"
    )


# export type FlattenedTree = {
#   text: string;
#   sentence_indices: [number, number][];
#   children_in_next_level: number[];
# }[][];


class SummarizeFlattenedText(BaseModel):
    text: str
    token_count: int


class FlattenedTreeNode(BaseModel):
    text: str
    sentence_indices: List[List[int]]
    children_in_next_level: List[int]


class SummarizeFlattenedTextResponse(BaseModel):
    flattened_tree: List[List[FlattenedTreeNode]]


async def summarize_flattened_text(text_chunk: SummarizeText):
    text = text_chunk.text
    tokens_per_chunk = text_chunk.token_count
    num_tokens = count_tokens(text, "gpt-3.5-turbo")
    print(f"Num tokens: {num_tokens}")
    if num_tokens > 30000:
        splits = split_text_to_chunks(text_chunk.text, 30000, "gpt-3.5-turbo")
        text = splits[0]

    # chunk into tokens_per_chunk chunks
    result = [
        [
            FlattenedTreeNode(
                text=chunk,
                sentence_indices=get_sentence_indices(chunk),
                children_in_next_level=[],
            )
            for chunk in split_text_to_chunks(text, tokens_per_chunk, "gpt-3.5-turbo")
        ]
    ]

    # until the first element in chunks has only one element
    depth = 0
    # max_iterations = 2
    while len(result[0]) > 1:
        # take the first element in chunks
        layer: List[FlattenedTreeNode] = result[0]

        # split layer into chunks
        # make each chunk have roughly 1000 tokens

        running_token_count = 0
        chunks = [[]]
        children_in_next_level = [
            []
        ]  # the indices of the elements in the previous layer the summarized text is from

        for i, node in enumerate(layer):
            if running_token_count + count_tokens(node.text, "gpt-3.5-turbo") > 1000:
                chunks.append([node.text])
                children_in_next_level.append([i])
                running_token_count = count_tokens(node.text, "gpt-3.5-turbo")
            else:
                chunks[-1].append(node.text)
                children_in_next_level[-1].append(i)
                running_token_count += count_tokens(node.text, "gpt-3.5-turbo")

        # # children_in_next_level is the indices of the elements in the previous layer the summarized text is from

        async def sum(chunk):
            return FlattenedTreeNode(
                text=await summarize_text("\n\n".join(chunk)),
                sentence_indices=[],
                children_in_next_level=[],
            )

        # do above in parallel
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


@app.post("/summarize-flattened-text")
async def summarize_flattened_text_endpoint(text_chunk: SummarizeFlattenedText):
    # dedup inflight requests

    key = text_chunk.text + str(text_chunk.token_count)
    if key in inflight_requests:
        return await inflight_requests[key]

    inflight_requests[key] = asyncio.create_task(summarize_flattened_text(text_chunk))
    return await inflight_requests[key]


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


# @stub.asgi(
#     image=image,
#     secret=modal.Secret.from_name("openai"),
#     shared_volumes={str(CACHE_ROOT): volume},
#     # gpu="any",
#     keep_warm=1,
# )
# def fastapi_stub():
#     openai.api_key = os.environ["OPENAI_API_KEY"]
#     return app

if __name__ == "__main__":
    nltk.download("punkt")
    openai.api_key = os.environ["OPENAI_API_KEY"]
    uvicorn.run(app, port=8000)
