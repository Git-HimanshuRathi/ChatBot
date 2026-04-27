"""
Eval Harness — PDF Chat Agent
Tests the full pipeline against the sample PDF: retrieval → routing → LLM → evaluator

Run: python eval_harness.py [path/to/pdf]
     python eval_harness.py ../tests/sample.pdf
"""
import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(__file__))

from rag.ingest import ingest_pdf
from rag.chunk import chunk_documents
from rag.embed import build_index, get_model
from rag.retrieve import retrieve
from router.router import classify_query
from evaluator.evaluator import evaluate_response
from llm.groq_client import chat_completion

# ─── Test Cases ──────────────────────────────────────────────────────────────
# Using sample.pdf (Employee Handbook 2024)
# Valid queries expect in-scope answers with page citations.
# Invalid queries expect the out_of_scope_refused flag.

TEST_CASES = [
    # --- Routing Tests ---
    {
        "id": "R1",
        "query": "Hi there!",
        "expect_classification": "simple",
        "expect_model": "llama-3.1-8b-instant",
        "description": "Greeting should route to simple model",
    },
    {
        "id": "R2",
        "query": "Can you compare the leave policies and explain which employees benefit most?",
        "expect_classification": "complex",
        "expect_model": "llama-3.3-70b-versatile",
        "description": "Comparison + reasoning should route to complex model",
    },

    # --- Valid in-scope queries (expect answers with page citations) ---
    {
        "id": "V1",
        "query": "What is the purpose of this employee handbook?",
        "expect_in_scope": True,
        "expect_answer_contains": [],
        "description": "Core in-scope query — should answer from document",
    },
    {
        "id": "V2",
        "query": "What are the attendance or working hours expectations?",
        "expect_in_scope": True,
        "description": "Policy query — should retrieve relevant chunks",
    },
    {
        "id": "V3",
        "query": "What is the code of conduct expected from employees?",
        "expect_in_scope": True,
        "description": "Conduct policy — should answer from document",
    },
    {
        "id": "V4",
        "query": "What is the process for reporting workplace grievances?",
        "expect_in_scope": True,
        "description": "Grievance procedure — should answer from document",
    },

    # --- Invalid / out-of-scope queries (expect refusal) ---
    {
        "id": "OOS1",
        "query": "What is the capital of France?",
        "expect_flag": "out_of_scope_refused",
        "description": "Completely off-topic — must refuse",
    },
    {
        "id": "OOS2",
        "query": "Write me a poem about the company.",
        "expect_flag": "out_of_scope_refused",
        "description": "Creative task outside document scope — must refuse",
    },
    {
        "id": "OOS3",
        "query": "What is the current stock price of this company?",
        "expect_flag": "out_of_scope_refused",
        "description": "Financial data not in document — must refuse",
    },
]


def build_context(retrieved: list[dict]) -> str:
    if not retrieved:
        return "No relevant content found in the uploaded document."
    return "\n\n".join(
        f"[Page {c['page_number']}, Similarity: {c['similarity_score']}]\n{c['text']}"
        for c in retrieved
    )


def run_eval(pdf_path: str):
    print("=" * 70)
    print("  PDF CHAT AGENT — EVAL HARNESS")
    print(f"  PDF: {pdf_path}")
    print("=" * 70)

    # Build index from sample PDF
    print("\n  Building index...")
    pages = ingest_pdf(pdf_path)
    chunks = chunk_documents(pages)
    faiss_index, chunk_metadata = build_index(chunks)
    get_model()
    print(f"  Index ready: {faiss_index.ntotal} vectors\n")

    passed = 0
    failed = 0
    errors = 0
    results = []

    for tc in TEST_CASES:
        tc_id = tc["id"]
        query = tc["query"]
        desc = tc["description"]

        print(f"  [{tc_id}] {desc}")
        print(f"       Query: \"{query}\"")

        try:
            retrieved = retrieve(query, faiss_index, chunk_metadata)
            routing = classify_query(query)
            context = build_context(retrieved)

            llm_result = chat_completion(
                model=routing["model_used"],
                context=context,
                query=query,
            )

            evaluation = evaluate_response(llm_result["response"], retrieved)

            test_passed = True
            fail_reasons = []

            # Routing checks
            if "expect_classification" in tc and routing["classification"] != tc["expect_classification"]:
                test_passed = False
                fail_reasons.append(
                    f"Classification: expected '{tc['expect_classification']}', got '{routing['classification']}'"
                )

            if "expect_model" in tc and routing["model_used"] != tc["expect_model"]:
                test_passed = False
                fail_reasons.append(
                    f"Model: expected '{tc['expect_model']}', got '{routing['model_used']}'"
                )

            # In-scope: should NOT have out_of_scope_refused
            if tc.get("expect_in_scope"):
                if "out_of_scope_refused" in evaluation["flags"]:
                    test_passed = False
                    fail_reasons.append("Expected in-scope answer but got out_of_scope_refused")
                if not retrieved:
                    test_passed = False
                    fail_reasons.append("No chunks retrieved — answer has no grounding")

            # Out-of-scope: should have the flag
            if "expect_flag" in tc:
                if tc["expect_flag"] not in evaluation["flags"]:
                    test_passed = False
                    fail_reasons.append(
                        f"Expected flag '{tc['expect_flag']}' but got: {evaluation['flags']}"
                    )

            # Answer keywords
            if "expect_answer_contains" in tc:
                answer_lower = llm_result["response"].lower()
                for kw in tc["expect_answer_contains"]:
                    if kw.lower() not in answer_lower:
                        test_passed = False
                        fail_reasons.append(f"Answer missing keyword: '{kw}'")

            if test_passed:
                print(f"       PASS")
                passed += 1
            else:
                print(f"       FAIL")
                for reason in fail_reasons:
                    print(f"          -> {reason}")
                failed += 1

            results.append({
                "id": tc_id,
                "query": query,
                "description": desc,
                "passed": test_passed,
                "classification": routing["classification"],
                "model": routing["model_used"],
                "confidence": evaluation["confidence"],
                "flags": evaluation["flags"],
                "sources": [
                    {"page": c["page_number"], "score": c["similarity_score"]}
                    for c in retrieved
                ],
                "fail_reasons": fail_reasons,
            })

        except Exception as e:
            print(f"       ERROR: {e}")
            errors += 1
            results.append({"id": tc_id, "query": query, "passed": False, "error": str(e)})

        print()
        sys.stdout.flush()

        if tc != TEST_CASES[-1]:
            time.sleep(2)

    total = len(TEST_CASES)
    print("=" * 70)
    print(f"  RESULTS: {passed}/{total} passed | {failed} failed | {errors} errors")
    print(f"  Pass rate: {passed / total * 100:.0f}%")
    print("=" * 70)

    report_path = os.path.join(os.path.dirname(__file__), "eval_results.json")
    with open(report_path, "w") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "pdf": pdf_path,
            "total": total,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "pass_rate": f"{passed / total * 100:.0f}%",
            "results": results,
        }, f, indent=2)

    print(f"\n  Results saved to: {report_path}\n")
    return passed == total


if __name__ == "__main__":
    pdf = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "tests", "sample.pdf"
    )
    if not os.path.exists(pdf):
        print(f"PDF not found: {pdf}")
        print("Usage: python eval_harness.py path/to/document.pdf")
        sys.exit(1)

    success = run_eval(pdf)
    sys.exit(0 if success else 1)
