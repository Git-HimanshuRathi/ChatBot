"""
Groq API wrapper with strict grounding system prompt.
Supports standard and streaming completions with latency + token tracking.
"""
import os
import time
from typing import Generator

from groq import Groq
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

# Improvement 5: Strict grounding system prompt
SYSTEM_PROMPT = """You are a document analysis assistant. Your sole knowledge source is the PDF document provided by the user.

Rules:
1. Answer ONLY using information explicitly stated in the provided document context.
2. Always cite the page number(s) your answer comes from, e.g. "(Page 3)".
   IMPORTANT: Only cite page numbers that appear as [Page N] markers in the context above.
   Never reference a page number that is not present in the provided context.
3. If the answer is not present in the document, respond with exactly:
   "This information is not available in the uploaded document."
4. Do NOT use any prior knowledge or external information — not even widely known facts.
5. Do NOT speculate, infer, or extrapolate beyond what the document explicitly states.
6. If the context is marked as low-relevance, use it only to briefly describe what topics
   the document does cover, then state the requested information is not available.
7. Be concise and well-structured in your responses.
8. Always respond in the same language the user used to ask their question.
   Match the USER'S QUERY language — NOT the language of the document content.
   If the user asks in English, answer in English even if the document is in Hindi.
   If the user asks in Hindi, answer in Hindi even if the document is in English.
   Page citations like "(Page 3)" should remain in this format regardless of language."""

_client: Groq | None = None


def _get_client() -> Groq:
    """Get or create the Groq client."""
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key or api_key == "your_groq_api_key_here":
            raise ValueError(
                "GROQ_API_KEY not set. Please add a valid key to the .env file."
            )
        _client = Groq(api_key=api_key)
    return _client


def build_messages(
    context: str,
    query: str,
    conversation_history: list[dict] | None = None,
) -> list[dict]:
    """
    Build the message list for the Groq API call.
    
    Args:
        context: Retrieved document context.
        query: Current user query.
        conversation_history: Previous user/assistant message pairs.
    
    Returns:
        List of message dicts for the API.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add conversation history
    if conversation_history:
        messages.extend(conversation_history)
    
    # Add context and current query
    user_content = f"""Context from uploaded PDF document:
---
{context}
---

User question: {query}"""
    
    messages.append({"role": "user", "content": user_content})
    return messages


def chat_completion(
    model: str,
    context: str,
    query: str,
    conversation_history: list[dict] | None = None,
) -> dict:
    """
    Send a standard (non-streaming) chat completion to Groq.
    
    Returns:
        Dict with keys: response, tokens_input, tokens_output, latency_ms, model
    """
    client = _get_client()
    messages = build_messages(context, query, conversation_history)
    
    start = time.time()
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
    )
    latency_ms = round((time.time() - start) * 1000, 1)
    
    response_text = completion.choices[0].message.content
    usage = completion.usage
    
    result = {
        "response": response_text,
        "tokens_input": usage.prompt_tokens if usage else 0,
        "tokens_output": usage.completion_tokens if usage else 0,
        "latency_ms": latency_ms,
        "model": model,
    }
    
    print(f"  Groq: model={model}, tokens_in={result['tokens_input']}, "
          f"tokens_out={result['tokens_output']}, latency={latency_ms}ms")
    
    return result


def chat_completion_stream(
    model: str,
    context: str,
    query: str,
    conversation_history: list[dict] | None = None,
) -> Generator[dict, None, None]:
    """
    Send a streaming chat completion to Groq.
    
    Yields:
        Dicts with key 'chunk' for content chunks, and a final dict with
        'done', 'tokens_input', 'tokens_output', 'latency_ms', 'model'.
    """
    client = _get_client()
    messages = build_messages(context, query, conversation_history)
    
    start = time.time()
    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
        stream=True,
    )
    
    full_response = ""
    tokens_input = 0
    tokens_output = 0
    
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            content = chunk.choices[0].delta.content
            full_response += content
            yield {"chunk": content}
        
        # Capture usage from the final chunk (groq SDK v1.x)
        if hasattr(chunk, "x_groq") and chunk.x_groq:
            usage = getattr(chunk.x_groq, "usage", None)
            if usage:
                tokens_input = getattr(usage, "prompt_tokens", 0) or 0
                tokens_output = getattr(usage, "completion_tokens", 0) or 0
    
    latency_ms = round((time.time() - start) * 1000, 1)
    
    yield {
        "done": True,
        "response": full_response,
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
        "latency_ms": latency_ms,
        "model": model,
    }
