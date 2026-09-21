import os
import traceback

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import JSONResponse

from face_service import FaceInputError, create_embedding
from hand_service import HandInputError, recognize_gesture

app = FastAPI(title="sign/space face AI service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


class EmbeddingRequest(BaseModel):
    image: str


class HandRequest(BaseModel):
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


@app.post("/recognize-gesture")
def recognize_hand_gesture(request: HandRequest):
    try:
        result = recognize_gesture(request.image)
        return {"success": True, **result}
    except HandInputError as error:
        return {"success": False, "message": str(error)}
    except Exception:
        if os.getenv("DEBUG", "").lower() == "true":
            traceback.print_exc()
        return JSONResponse(
            status_code=503,
            content={"success": False, "message": "Hand recognition service failed"},
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
