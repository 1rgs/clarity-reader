from pathlib import Path
import tiktoken
from typing import List, Tuple
import openai
import diskcache
from nltk.tokenize import sent_tokenize
import asyncio
from flufl.lock import Lock


# CACHE_ROOT = Path.cwd() / ".cache"
CACHE_ROOT = Path("/root/cache")
LOCK_FILE = CACHE_ROOT / "lock"
SUM_LOCK_FILE = CACHE_ROOT / "sum_lock"
EMBED_CACHE_PATH = CACHE_ROOT / "embed-cache"
SUM_CACHE_PATH = CACHE_ROOT / "sum-cache"


def count_tokens(text: str, model: str) -> int:
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))


semaphore = asyncio.Semaphore(5)


async def summarize_text_uncached(text: str) -> str:
    if len(text) == 0:
        return ""

    print("sending to openai:", text[:100], "...", text[-100:])
    async with semaphore:
        completion = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that summarizes text. Output one paragraph of text that summarizes the following text:",
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
            max_tokens=3900 - count_tokens(text, "gpt-3.5-turbo"),
        )
        return completion.choices[0].message["content"].strip()


async def summarize_text_cached(text: str) -> str:
    with Lock(str(SUM_LOCK_FILE)):
        with diskcache.Cache(str(SUM_CACHE_PATH)) as summarization_cache:
            if text in summarization_cache:
                return summarization_cache[text]

    summary = await summarize_text_uncached(text)
    with Lock(str(SUM_LOCK_FILE)):
        with diskcache.Cache(str(SUM_CACHE_PATH)) as summarization_cache:
            summarization_cache[text] = summary
    return summary


def split_text_to_chunks(text: str, max_token_count: int, model: str) -> List[str]:
    sentences = sent_tokenize(text)
    chunks = []
    current_chunk = ""

    for sentence in sentences:
        try:
            sentence_token_count = count_tokens(sentence, model)
        except Exception as e:
            raise ValueError(f"Error counting tokens: {str(e)}")

        if sentence_token_count > max_token_count:
            while len(sentence) > 0:
                if count_tokens(sentence[:max_token_count], model) <= max_token_count:
                    chunks.append(sentence[:max_token_count])
                    sentence = sentence[max_token_count:]
                else:
                    chunks.append(sentence[:max_token_count])
                    sentence = sentence[max_token_count:]

        if count_tokens(current_chunk + " " + sentence, model) <= max_token_count:
            current_chunk += " " + sentence
        else:
            chunks.append(current_chunk.strip())
            current_chunk = sentence

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


async def summarize_text(text: str) -> str:
    tokens = count_tokens(text, "gpt-3.5-turbo")
    if tokens > 3500:
        chunks = split_text_to_chunks(text, 3500, "gpt-3.5-turbo")
        return await summarize_text(
            "\n\n".join(
                await asyncio.gather(
                    *[summarize_text(chunk) for chunk in chunks], return_exceptions=True
                )
            )
        )

    return await summarize_text_cached(text)


def chunks(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def get_sentence_indices(text: str) -> List[Tuple[int, int]]:
    sentence_indices = []
    current_index = 0

    for sentence in sent_tokenize(text):
        sentence_indices.append((current_index, current_index + len(sentence)))
        current_index += len(sentence) + 1

    return sentence_indices
