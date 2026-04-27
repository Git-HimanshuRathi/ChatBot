# Test Cases — PDF Chat Agent

**Sample document:** `tests/sample.pdf` (Employee Handbook 2024)

Upload `sample.pdf` to the agent before running any query below.

---

## Setup

```bash
# Start backend
cd backend && uvicorn main:app --port 8000 --reload

# Start frontend
cd frontend && npm run dev

# Open http://localhost:5173
# Upload tests/sample.pdf
# Ask the queries below
```

Or test directly via API:

```bash
# 1. Upload the PDF
curl -X POST http://localhost:8000/upload \
  -F "file=@tests/sample.pdf" \
  -F "session_id=test-session-1"

# 2. Query it
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "YOUR QUERY HERE", "session_id": "test-session-1"}'
```

---

## Valid Queries (5) — Expected: answer with page citation

### Query 1
**Input:** `What is the purpose of this employee handbook?`

**Expected behavior:**
- Answers with a summary of the handbook's purpose
- Includes a page citation e.g. "(Page 1)" or "(Page 2)"
- Does NOT refuse
- `out_of_scope_refused` flag is NOT present

---

### Query 2
**Input:** `What are the core working hours or attendance expectations?`

**Expected behavior:**
- Describes attendance/working hours policy from the document
- Cites the relevant page number
- Evaluator confidence: `high`

---

### Query 3
**Input:** `What is the code of conduct expected from employees?`

**Expected behavior:**
- Returns conduct expectations (professional behavior, ethics, etc.) from the document
- Cites page number(s)
- Structured response (may include bullet points)

---

### Query 4
**Input:** `How many days of paid leave are employees entitled to?`

**Expected behavior:**
- Returns a specific number or policy around leave entitlement
- Cites the relevant page
- If leave is not in this document, agent correctly says so (see invalid query 3)

---

### Query 5
**Input:** `What is the process for reporting workplace misconduct or grievances?`

**Expected behavior:**
- Explains the grievance/reporting procedure from the document
- Cites page number(s)
- Evaluator confidence: `high`

---

## Invalid / Out-of-Scope Queries (3) — Expected: refusal

### Query 6
**Input:** `What is the capital of France?`

**Expected behavior:**
- Agent responds with: *"This information is not available in the uploaded document."*
- Evaluator flag: `out_of_scope_refused`
- Blue "Out of scope" badge shown in UI
- Does NOT hallucinate an answer

---

### Query 7
**Input:** `Write me a poem about the company.`

**Expected behavior:**
- Agent declines; responds that this is not information from the document
- Flag: `out_of_scope_refused`
- No poem is generated

---

### Query 8
**Input:** `What is the current stock price of this company?`

**Expected behavior:**
- Agent responds that stock price information is not available in the uploaded document
- Flag: `out_of_scope_refused`
- No fabricated price is given

---

## Removing a Source Changes the Output

To demonstrate that answers change when the source is removed:

1. Upload `sample.pdf` → ask Query 1 → note the answer
2. Create a new chat session, upload a **different PDF** (e.g. a blank or unrelated document)
3. Ask the same Query 1 → the agent either refuses (not in document) or gives a different answer

This confirms strict source-grounding — the agent only knows what is in the uploaded PDF.

---

## Expected Response Format

Every in-scope answer should contain:
- A direct answer to the question
- At least one page citation in the format `(Page N)`
- The Sources panel shows: document name + page number + relevance score

Every out-of-scope answer should contain:
- The exact phrase: *"This information is not available in the uploaded document."*
- Evaluator flag: `out_of_scope_refused`
- No page citations (nothing to cite)
