"""
PDF text extraction — one dict per page, tracking page numbers.
"""
import os
from PyPDF2 import PdfReader


def ingest_pdf(filepath: str) -> list[dict]:
    """
    Extract text from a single PDF file, one entry per page.

    Returns:
        List of dicts: { filename, page_number (1-indexed), text }
    """
    filename = os.path.basename(filepath)
    pages = []

    reader = PdfReader(filepath)
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            pages.append({
                "filename": filename,
                "page_number": i + 1,
                "text": text.strip(),
            })

    if not pages:
        raise ValueError(f"No extractable text found in {filename}")

    print(f"  Ingested: {filename} — {len(reader.pages)} pages, {len(pages)} with text")
    return pages


def ingest_pdfs(docs_dir: str) -> list[dict]:
    """
    Extract from all PDFs in a directory. Returns page-level dicts.
    """
    if not os.path.isdir(docs_dir):
        raise FileNotFoundError(f"Docs directory not found: {docs_dir}")

    pdf_files = sorted([f for f in os.listdir(docs_dir) if f.lower().endswith(".pdf")])
    if not pdf_files:
        raise ValueError(f"No PDF files found in {docs_dir}")

    all_pages = []
    for filename in pdf_files:
        try:
            pages = ingest_pdf(os.path.join(docs_dir, filename))
            all_pages.extend(pages)
        except Exception as e:
            print(f"  Error reading {filename}: {e}")

    print(f"  Total: {len(all_pages)} pages from {len(pdf_files)} documents")
    return all_pages
