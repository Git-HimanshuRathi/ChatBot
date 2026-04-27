"""
PDF Chat Agent — FastAPI Backend
POST /upload          — upload a PDF and build its FAISS index for a session
POST /query           — query the uploaded PDF (API contract endpoint)
POST /chat            — legacy chat endpoint (used by frontend)
POST /chat/stream     — SSE streaming endpoint (used by frontend)
GET  /session/{id}    — get info about an uploaded PDF session
GET  /health          — health check
"""
import logging
import os
import json
import uuid
import tempfile
from collections import defaultdict
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from rag.ingest import ingest_pdf
from rag.chunk import chunk_documents
from rag.embed import build_index, get_model
from rag.retrieve import retrieve, retrieve_fallback
from router.router import classify_query
from evaluator.evaluator import evaluate_response
from llm.groq_client import chat_completion, chat_completion_stream
from logs.logger import log_request

# ─── Globals ────────────────────────────────────────────────────────────────
# session_id → { faiss_index, chunk_metadata, pdf_name, page_count, chunk_count }
session_store: dict[str, dict] = {}

# conversation_id → list of last N user/assistant pairs
MAX_MEMORY = 3
conversation_memory: dict[str, list[dict]] = defaultdict(list)

DEFAULT_SESSION_ID = "default"
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
SAMPLE_PDF = os.path.join(BASE_DIR, "tests", "sample.pdf")


def _index_pdf(filepath: str, session_id: str, display_name: str | None = None):
    """Index a PDF file and store it under session_id."""
    pages = ingest_pdf(filepath)
    name = display_name or os.path.basename(filepath)
    for p in pages:
        p["filename"] = name
    chunks = chunk_documents(pages)
    faiss_index, chunk_metadata = build_index(chunks)
    session_store[session_id] = {
        "faiss_index": faiss_index,
        "chunk_metadata": chunk_metadata,
        "pdf_name": name,
        "page_count": max(p["page_number"] for p in pages),
        "chunk_count": len(chunks),
    }
    return session_store[session_id]


# ─── Startup ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PDF Chat Agent — Starting up...")
    get_model()  # Pre-warm the embedding model
    logger.info("Ready")
    yield
    logger.info("Shutting down PDF Chat Agent...")


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="PDF Chat Agent", version="2.0.0", lifespan=lifespan)

_allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_allowed_origins != ["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ─── Pydantic Models ──────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    session_id: str
    conversation_id: str | None = None


class TokensInfo(BaseModel):
    input: int
    output: int


class QueryMetadata(BaseModel):
    model_used: str
    classification: str
    tokens: TokensInfo
    latency_ms: int
    chunks_retrieved: int
    evaluator_flags: list[str]


class SourceInfo(BaseModel):
    document: str
    page: int | None = None
    relevance_score: float | None = None


class QueryResponse(BaseModel):
    answer: str
    metadata: QueryMetadata
    sources: list[SourceInfo]
    conversation_id: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(default="default")


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _get_session(session_id: str) -> dict:
    if session_id not in session_store:
        raise HTTPException(
            status_code=400,
            detail="No PDF uploaded for this session. Please upload a PDF first.",
        )
    return session_store[session_id]


def _get_history(conv_id: str) -> list[dict]:
    return list(conversation_memory[conv_id])


def _update_history(conv_id: str, question: str, answer: str):
    history = conversation_memory[conv_id]
    history.append({"role": "user", "content": question})
    history.append({"role": "assistant", "content": answer})
    if len(history) > MAX_MEMORY * 2:
        conversation_memory[conv_id] = history[-(MAX_MEMORY * 2):]


def _build_context(retrieved: list[dict]) -> str:
    if not retrieved:
        return "No relevant content found in the uploaded document."
    is_fallback = any(c.get("is_fallback") for c in retrieved)
    chunks_text = "\n\n".join(
        f"[Page {c['page_number']}, Similarity: {c['similarity_score']}]\n{c['text']}"
        for c in retrieved
    )
    if is_fallback:
        return (
            "NOTE: No highly relevant content was found for this query. "
            "The following are the closest matches in the document (low relevance):\n\n"
            + chunks_text
        )
    return chunks_text


def _run_pipeline(question: str, conv_id: str, session_id: str) -> dict:
    session = _get_session(session_id)
    index = session["faiss_index"]
    chunks = session["chunk_metadata"]

    retrieved = retrieve(question, index, chunks)
    if not retrieved:
        retrieved = retrieve_fallback(question, index, chunks)
    routing = classify_query(question)
    context = _build_context(retrieved)
    history = _get_history(conv_id)

    llm_result = chat_completion(
        model=routing["model_used"],
        context=context,
        query=question,
        conversation_history=history,
    )

    evaluation = evaluate_response(llm_result["response"], retrieved, query=question)

    log_request(
        query=question,
        classification=routing["classification"],
        model_used=routing["model_used"],
        tokens_input=llm_result["tokens_input"],
        tokens_output=llm_result["tokens_output"],
        latency_ms=llm_result["latency_ms"],
        confidence=evaluation["confidence"],
        flags=evaluation["flags"],
        num_sources=len(retrieved),
    )

    _update_history(conv_id, question, evaluation["response"])

    return {
        "retrieved": retrieved,
        "routing": routing,
        "llm_result": llm_result,
        "evaluation": evaluation,
    }


# ─── POST /load-sample ───────────────────────────────────────────────────────
@app.post("/load-sample")
async def load_sample(session_id: str = Form(...)):
    """Load the bundled sample PDF into a session without a file upload."""
    if not os.path.exists(SAMPLE_PDF):
        raise HTTPException(status_code=404, detail="Sample PDF not found on server.")
    info = _index_pdf(SAMPLE_PDF, session_id)
    logger.info("Sample PDF loaded for session [%s]", session_id)
    return {"session_id": session_id, **{k: info[k] for k in ("pdf_name", "page_count", "chunk_count")}}


# ─── POST /upload ─────────────────────────────────────────────────────────────
@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    session_id: str = Form(...),
):
    """
    Accept a PDF upload, build its FAISS index, and store it under session_id.
    The frontend sends session_id = chat.id so each chat has its own PDF.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Save to a temp file, then ingest
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        info = _index_pdf(tmp_path, session_id, display_name=file.filename)
        logger.info("Session [%s]: %s (%d pages, %d chunks)",
                    session_id, file.filename, info["page_count"], info["chunk_count"])
        return {"session_id": session_id, **{k: info[k] for k in ("pdf_name", "page_count", "chunk_count")}}
    finally:
        os.unlink(tmp_path)


# ─── GET /session/{session_id} ────────────────────────────────────────────────
@app.get("/session/{session_id}")
async def get_session(session_id: str):
    session = _get_session(session_id)
    return {
        "session_id": session_id,
        "pdf_name": session["pdf_name"],
        "page_count": session["page_count"],
        "chunk_count": session["chunk_count"],
    }


# ─── POST /query — API Contract ───────────────────────────────────────────────
@app.post("/query", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    question = request.question.strip()
    session_id = request.session_id
    conv_id = request.conversation_id or f"conv_{uuid.uuid4().hex[:8]}"

    logger.info("Query: %s | Session: %s | Conv: %s", question[:80], session_id, conv_id)

    result = _run_pipeline(question, conv_id, session_id)

    sources = [
        SourceInfo(
            document=c["document_name"],
            page=c.get("page_number"),
            relevance_score=c["similarity_score"],
        )
        for c in result["retrieved"]
    ]

    metadata = QueryMetadata(
        model_used=result["routing"]["model_used"],
        classification=result["routing"]["classification"],
        tokens=TokensInfo(
            input=result["llm_result"]["tokens_input"],
            output=result["llm_result"]["tokens_output"],
        ),
        latency_ms=int(result["llm_result"]["latency_ms"]),
        chunks_retrieved=len(result["retrieved"]),
        evaluator_flags=result["evaluation"]["flags"],
    )

    logger.info("Query complete: %s", result["evaluation"]["confidence"])

    return QueryResponse(
        answer=result["evaluation"]["response"],
        metadata=metadata,
        sources=sources,
        conversation_id=conv_id,
    )


# ─── POST /chat — Legacy endpoint ────────────────────────────────────────────
@app.post("/chat")
async def chat(request: ChatRequest):
    question = request.query.strip()
    conv_id = request.session_id

    result = _run_pipeline(question, conv_id, request.session_id)

    return {
        "response": result["evaluation"]["response"],
        "sources": [
            {
                "document": c["document_name"],
                "page": c.get("page_number"),
                "chunk_id": c["chunk_id"],
                "similarity_score": c["similarity_score"],
            }
            for c in result["retrieved"]
        ],
        "debug": {
            "classification": result["routing"]["classification"],
            "model_used": result["routing"]["model_used"],
            "confidence": result["evaluation"]["confidence"],
            "flags": result["evaluation"]["flags"],
            "latency_ms": result["llm_result"]["latency_ms"],
            "tokens_input": result["llm_result"]["tokens_input"],
            "tokens_output": result["llm_result"]["tokens_output"],
        },
    }


# ─── POST /chat/stream — SSE Streaming ───────────────────────────────────────
@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    question = request.query.strip()
    session_id = request.session_id
    conv_id = session_id

    session = _get_session(session_id)
    index = session["faiss_index"]
    chunks = session["chunk_metadata"]

    retrieved = retrieve(question, index, chunks)
    if not retrieved:
        retrieved = retrieve_fallback(question, index, chunks)
    routing = classify_query(question)
    context = _build_context(retrieved)
    history = _get_history(conv_id)

    async def event_generator():
        full_response = ""
        final_meta = {}

        for item in chat_completion_stream(
            model=routing["model_used"],
            context=context,
            query=question,
            conversation_history=history,
        ):
            if "chunk" in item:
                yield {"event": "chunk", "data": json.dumps({"text": item["chunk"]})}
            elif item.get("done"):
                full_response = item.get("response", "")
                final_meta = item

        evaluation = evaluate_response(full_response, retrieved, query=question)

        log_request(
            query=question,
            classification=routing["classification"],
            model_used=routing["model_used"],
            tokens_input=final_meta.get("tokens_input", 0),
            tokens_output=final_meta.get("tokens_output", 0),
            latency_ms=final_meta.get("latency_ms", 0),
            confidence=evaluation["confidence"],
            flags=evaluation["flags"],
            num_sources=len(retrieved),
        )

        _update_history(conv_id, question, full_response)

        sources = [
            {
                "document": c["document_name"],
                "page": c.get("page_number"),
                "chunk_id": c["chunk_id"],
                "similarity_score": c["similarity_score"],
            }
            for c in retrieved
        ]

        meta = {
            "sources": sources,
            "debug": {
                "model_used": routing["model_used"],
                "classification": routing["classification"],
                "latency_ms": final_meta.get("latency_ms", 0),
                "tokens_input": final_meta.get("tokens_input", 0),
                "tokens_output": final_meta.get("tokens_output", 0),
                "confidence": evaluation["confidence"],
                "flags": evaluation["flags"],
            },
        }
        yield {"event": "metadata", "data": json.dumps(meta)}
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())


# ─── GET /health ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "active_sessions": len(session_store),
        "sessions": [
            {"session_id": sid, "pdf_name": s["pdf_name"], "chunks": s["chunk_count"]}
            for sid, s in session_store.items()
        ],
    }
