import os
from pathlib import Path
from typing import List


import modal
import nltk
import openai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def download_all_models():
    print("Downloading nltk data,")
    nltk.download("punkt")
    print("Downloading sentence transformer model")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print("Encoding example text")
    model.encode(["Hello world"])
    print("Done downloading models")


volume = modal.SharedVolume().persist("reader-cache3")
image = (
    modal.Image.debian_slim()
    .pip_install(
        "fastapi",
        "nltk",
        "tiktoken",
        "openai",
        "diskcache",
        "sentence_transformers",
        "accelerate",
        "torch",
        "transformers",
        "flufl.lock",
        "orjson",
        "scipy",
        "numpy",
    )
    .run_function(download_all_models)
)
stub = modal.Stub("clarity-reader")
