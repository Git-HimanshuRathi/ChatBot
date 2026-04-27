"""
Output evaluator for PDF Chat Agent responses.
Checks:
  1. no_context        — no chunks retrieved from the PDF
  2. out_of_scope      — LLM correctly refused an out-of-scope query
  3. potential_hallucination — response diverges from retrieved context
"""
import re

# Phrases the LLM uses when it correctly refuses an out-of-scope query
OUT_OF_SCOPE_PHRASES = [
    # English
    "not available in the uploaded document",
    "not found in the document",
    "not mentioned in the document",
    "not in the provided document",
    "cannot find this information",
    "this information is not",
    "i don't have enough information",
    "not covered in the document",
    "no information about this",
    # Hindi
    "दस्तावेज़ में उपलब्ध नहीं",
    "अपलोड किए गए दस्तावेज़ में यह जानकारी",
    "दस्तावेज़ में नहीं मिला",
    # Spanish
    "no está disponible en el documento",
    "no se encuentra en el documento",
    "esta información no está",
    # French
    "n'est pas disponible dans le document",
    "cette information n'est pas",
    "introuvable dans le document",
    # German
    "nicht im dokument verfügbar",
    "diese information ist nicht",
    "nicht im hochgeladenen dokument",
    # Chinese
    "文档中没有此信息",
    "上传的文档中不包含",
    # Arabic
    "غير متوفر في المستند",
    "هذه المعلومات غير موجودة",
]

# Common stopwords excluded from overlap checks
STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
    "us", "them", "my", "your", "his", "its", "our", "their",
    "this", "that", "these", "those", "what", "which", "who", "whom",
    "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most",
    "other", "some", "such", "no", "only", "own", "same", "than",
    "too", "very", "just", "also", "how", "when", "where", "why",
    "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "up", "about", "into", "through", "during", "before", "after",
    "above", "below", "between", "under", "again", "further", "then",
    "once", "here", "there", "if", "because", "as", "until", "while",
    "based", "provided", "using", "used", "like", "including", "such",
    "please", "note", "however", "also", "may", "well", "per", "page",
}

CONTEXT_OVERLAP_THRESHOLD = 0.40

# Latin-script diacritics common in French, Spanish, German, Portuguese, etc.
_LATIN_DIACRITICS = set('àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿœšžß¿¡')


def _is_non_english_query(query: str) -> bool:
    """Return True if the query appears to be in a non-English language."""
    if not query:
        return False
    # Non-ASCII ratio covers Hindi, Arabic, Chinese, Japanese, etc.
    non_ascii = sum(1 for c in query if ord(c) > 127)
    if non_ascii / max(len(query), 1) > 0.08:
        return True
    # Latin diacritics cover French, Spanish, German, etc.
    return any(c.lower() in _LATIN_DIACRITICS for c in query)


def _extract_content_words(text: str) -> set[str]:
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    return {w for w in words if w not in STOPWORDS}


def evaluate_response(response: str, retrieved_chunks: list[dict], query: str = "") -> dict:
    """
    Evaluate an LLM response against the retrieved PDF chunks.

    Returns:
        Dict with keys: response, confidence ("high"|"low"), flags (list[str])
    """
    flags = []
    response_lower = response.lower()
    multilingual = _is_non_english_query(query)

    # Check 1: No context retrieved from PDF
    if not retrieved_chunks:
        flags.append("no_context")

    # Check 2: LLM explicitly refused (out-of-scope query — expected good behavior)
    for phrase in OUT_OF_SCOPE_PHRASES:
        if phrase in response_lower:
            flags.append("out_of_scope_refused")
            break

    # Check 3: Hallucination — response has low overlap with retrieved context
    # Skip for fallback chunks, out-of-scope refusals, and non-Latin responses
    # (Arabic, Chinese, Hindi etc. have minimal ASCII content-words — overlap would be meaningless)
    non_fallback = [c for c in retrieved_chunks if not c.get("is_fallback")]
    ascii_ratio = sum(1 for ch in response if ord(ch) < 128) / max(len(response), 1)
    run_overlap_check = (
        non_fallback
        and "out_of_scope_refused" not in flags
        and ascii_ratio > 0.6
        and not multilingual
    )
    if run_overlap_check:
        context_text = " ".join(chunk["text"] for chunk in non_fallback)
        context_words = _extract_content_words(context_text)
        response_words = _extract_content_words(response)

        if response_words:
            overlap_ratio = len(response_words & context_words) / len(response_words)
            if overlap_ratio < CONTEXT_OVERLAP_THRESHOLD:
                flags.append(
                    f"potential_hallucination (overlap={overlap_ratio:.1%}, "
                    f"threshold={CONTEXT_OVERLAP_THRESHOLD:.0%})"
                )

    # Check 4: Page citations in response must match retrieved chunk pages
    if non_fallback and "out_of_scope_refused" not in flags and ascii_ratio > 0.6 and not multilingual:
        cited_pages = {int(m) for m in re.findall(r'\bpage\s+(\d+)\b', response_lower)}
        valid_pages = {c["page_number"] for c in non_fallback if c.get("page_number")}
        invalid_cited = cited_pages - valid_pages
        if invalid_cited:
            flags.append(
                f"invalid_page_citation (cited={sorted(invalid_cited)}, "
                f"valid={sorted(valid_pages)})"
            )

    # out_of_scope_refused is good behavior; no_context alongside it is also expected
    if "out_of_scope_refused" in flags:
        quality_flags = [f for f in flags if f not in ("out_of_scope_refused", "no_context")]
    else:
        quality_flags = [f for f in flags if f != "out_of_scope_refused"]
    confidence = "low" if quality_flags else "high"

    result = {"response": response, "confidence": confidence, "flags": flags}
    print(f"  Evaluator: confidence={confidence}, flags={flags}")
    return result
