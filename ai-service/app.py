import os

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from face_service import FaceInputError, create_embedding

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="sign/space face AI service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:3001"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


class EmbeddingRequest(BaseModel):
    image: str


@app.get("/health")
def health():
    return {"success": True, "service": "face-ai"}


@app.post("/generate-embedding")
def generate_embedding(request: EmbeddingRequest):
    try:
        embedding = create_embedding(request.image)
        return {"success": True, "embedding": embedding}
    except FaceInputError as error:
        return {"success": False, "message": str(error)}
    except Exception:
        return {"success": False, "message": "Face embedding generation failed"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))