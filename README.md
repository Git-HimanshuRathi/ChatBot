# PDF Chat Agent

A **PDF-Constrained Conversational Agent** built for the STAIR x Scaler School of Technology assessment (Task 3).

Upload any PDF and ask questions about it. The agent answers **only** from the document's content, explicitly refuses out-of-scope queries, and cites page numbers in every response.

---

## Architecture

```
User uploads PDF
      │
      ▼
POST /upload ──► ingest_pdf() ──► chunk_documents() ──► build_index()
                 (page-level)    (400-token chunks,      (FAISS IndexFlatIP,
                                  page_number tracked)    in-memory per session)
      │
      ▼
User asks question
      │
      ▼
POST /chat/stream
      │
      ├─► retrieve()          Top-5 FAISS search with similarity threshold (0.25)
      │                        Returns chunks with page_number
      │
      ├─► classify_query()    Routes to 8B (simple) or 70B (complex) Groq model
      │
      ├─► chat_completion()   Strict system prompt: answer ONLY from PDF,
      │                        cite page numbers, refuse out-of-scope
      │
      └─► evaluate_response() Checks: no_context | out_of_scope_refused
                               | potential_hallucination (context overlap < 28%)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Embedding model | `all-MiniLM-L6-v2` | Fast, accurate, 384-dim — good balance for document QA |
| Vector store | FAISS `IndexFlatIP` + L2 norm | Exact cosine similarity, no approximation error |
| Chunking | 400 tokens / 80 overlap, per-page | Page attribution is exact; no cross-page chunks |
| LLM routing | 8B vs 70B based on query complexity | Cost-efficient without sacrificing quality on hard queries |
| Refusal strategy | System-prompt instruction + evaluator flag | Two-layer: model is instructed to refuse, evaluator confirms |
| Session model | Per-session in-memory FAISS index | Each chat independently uploads its own PDF |

### Trade-offs

- **Per-page chunking** preserves page citations exactly but may split mid-sentence at page breaks. The 80-token overlap mitigates this.
- **In-memory sessions** mean uploaded PDFs are lost on server restart. For production, add persistent storage.
- **FAISS in-memory** — no disk persistence per session. Suitable for evaluation; production would need a vector DB.

---

## Setup

```bash
# 1. Create venv and install dependencies
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt

# 2. Set your Groq API key
echo "GROQ_API_KEY=your_key_here" > .env

# 3. Start backend
cd backend && uvicorn main:app --port 8000 --reload

# 4. Start frontend (new terminal)
cd frontend && npm install && npm run dev
```

Then open `http://localhost:5173`, upload a PDF, and start chatting.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/upload` | POST | Upload a PDF (multipart: `file` + `session_id`) |
| `/query` | POST | Query the PDF (`{ question, session_id, conversation_id? }`) |
| `/chat/stream` | POST | SSE streaming (`{ query, session_id }`) |
| `/session/{id}` | GET | Get session info (pdf_name, page_count) |
| `/health` | GET | Server health + active sessions |

---

## Models

| Query Type | Model | Triggered By |
|---|---|---|
| Simple | `llama-3.1-8b-instant` | Short, single-fact, yes/no |
| Complex | `llama-3.3-70b-versatile` | Multi-step, comparison, explanation |

---

## Evaluator Flags

| Flag | Meaning |
|---|---|
| `no_context` | No relevant chunks retrieved from PDF |
| `out_of_scope_refused` | LLM correctly refused a query not in the document |
| `potential_hallucination` | Response word overlap with context < 28% |

---

## Test Instructions

See [`tests/test_cases.md`](tests/test_cases.md) for the full test suite with a sample PDF, 5 valid queries, and 3 out-of-scope queries.

**Quick test:**
1. Upload [`tests/sample.pdf`](tests/sample.pdf) (included in the repo)
2. Run the queries from `test_cases.md`
3. Verify: valid queries return page citations; out-of-scope queries return the refusal phrase

---

## Demo Video

[Insert demo video link here]
