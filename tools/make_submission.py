#!/usr/bin/env python3
"""
Create submission artefacts for the Software Quality Assessment:
- INSTALLATION_MANUAL.pdf (generated from INSTALLATION_MANUAL.md)
- submission zip (excluding secrets and large/derived directories)

This script avoids non-standard Python dependencies.
"""

from __future__ import annotations

import argparse
import os
import re
import textwrap
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


EXCLUDE_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    ".idea",
    ".worktrees",
    "dist",
}

EXCLUDE_FILES = {
    ".env",
}

EXCLUDE_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".sqlite3",
    ".db",
}


def should_exclude(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    parts = rel.parts
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    if path.name in EXCLUDE_FILES:
        return True
    if path.suffix in EXCLUDE_SUFFIXES:
        return True
    return False


def iter_files() -> list[Path]:
    out: list[Path] = []
    for p in ROOT.rglob("*"):
        if p.is_dir():
            continue
        if should_exclude(p):
            continue
        out.append(p)
    return out


# ---------------------------
# Minimal PDF generator
# ---------------------------


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


@dataclass
class _PdfObj:
    num: int
    content: bytes


def render_text_pdf(lines: list[str], *, title: str) -> bytes:
    """
    Render a simple multi-page PDF with Helvetica text.
    A4 page size (595 x 842 points), 11pt font, 14pt leading.
    """
    page_w, page_h = 595, 842
    margin_x, margin_y = 50, 50
    font_size = 11
    leading = 14
    usable_h = page_h - 2 * margin_y
    lines_per_page = max(1, usable_h // leading)

    # Split into pages
    pages: list[list[str]] = []
    cur: list[str] = []
    for line in lines:
        cur.append(line)
        if len(cur) >= lines_per_page:
            pages.append(cur)
            cur = []
    if cur:
        pages.append(cur)

    objs: list[_PdfObj] = []
    obj_num = 1

    def add_obj(content: bytes) -> int:
        nonlocal obj_num
        n = obj_num
        obj_num += 1
        objs.append(_PdfObj(n, content))
        return n

    # Font object (Helvetica)
    font_obj = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    # Content streams and page objects
    page_obj_nums: list[int] = []
    content_obj_nums: list[int] = []

    for page_lines in pages:
        # Build content stream
        # Start near top-left (PDF origin is bottom-left)
        start_y = page_h - margin_y - font_size
        stream_lines = [
            "BT",
            f"/F1 {font_size} Tf",
            f"{leading} TL",
            f"{margin_x} {start_y} Td",
        ]
        for ln in page_lines:
            stream_lines.append(f"({_pdf_escape(ln)}) Tj")
            stream_lines.append("T*")
        stream_lines.append("ET")
        stream = ("\n".join(stream_lines) + "\n").encode("utf-8")
        content = b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)
        content_obj = add_obj(content)
        content_obj_nums.append(content_obj)

        # Page object (parent set later)
        page = (
            b"<< /Type /Page /Parent 0 0 R /MediaBox [0 0 %d %d] "
            b"/Resources << /Font << /F1 %d 0 R >> >> "
            b"/Contents %d 0 R >>"
            % (page_w, page_h, font_obj, content_obj)
        )
        page_obj = add_obj(page)
        page_obj_nums.append(page_obj)

    # Pages tree
    kids = " ".join(f"{n} 0 R" for n in page_obj_nums).encode("ascii")
    pages_obj = add_obj(b"<< /Type /Pages /Kids [ " + kids + b" ] /Count %d >>" % len(page_obj_nums))

    # Patch Page objects' Parent now that we know pages_obj number.
    for i, obj in enumerate(objs):
        if obj.num in page_obj_nums:
            obj.content = obj.content.replace(b"/Parent 0 0 R", f"/Parent {pages_obj} 0 R".encode("ascii"))

    # Catalog
    catalog_obj = add_obj(b"<< /Type /Catalog /Pages %d 0 R >>" % pages_obj)

    # Info (Title)
    safe_title = re.sub(r"[^ -~]+", "", title)[:120]  # ASCII-ish
    info_obj = add_obj(
        (f"<< /Title ({_pdf_escape(safe_title)}) /Producer (make_submission.py) >>").encode("utf-8")
    )

    # Build xref
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    body = bytearray()
    xref_offsets: dict[int, int] = {}

    def write_obj(n: int, content: bytes) -> None:
        xref_offsets[n] = len(header) + len(body)
        body.extend(f"{n} 0 obj\n".encode("ascii"))
        body.extend(content)
        body.extend(b"\nendobj\n")

    # Objects must be written in numeric order
    for obj in sorted(objs, key=lambda o: o.num):
        write_obj(obj.num, obj.content)

    xref_start = len(header) + len(body)
    max_obj = max(xref_offsets) if xref_offsets else 0
    xref = bytearray()
    xref.extend(b"xref\n")
    xref.extend(f"0 {max_obj + 1}\n".encode("ascii"))
    xref.extend(b"0000000000 65535 f \n")
    for n in range(1, max_obj + 1):
        off = xref_offsets.get(n, 0)
        xref.extend(f"{off:010d} 00000 n \n".encode("ascii"))

    trailer = (
        b"trailer\n"
        + (b"<< /Size %d /Root %d 0 R /Info %d 0 R >>\n" % (max_obj + 1, catalog_obj, info_obj))
        + b"startxref\n"
        + f"{xref_start}\n".encode("ascii")
        + b"%%EOF\n"
    )

    return bytes(header) + bytes(body) + bytes(xref) + bytes(trailer)


def markdown_to_plain_lines(md_text: str, *, width: int = 96) -> list[str]:
    """
    Convert markdown-ish text to wrapped plain lines for PDF rendering.
    We keep code fences as-is (monospace isn't supported, but preserves content).
    """
    lines: list[str] = []
    in_code = False
    for raw in md_text.splitlines():
        if raw.strip().startswith("```"):
            in_code = not in_code
            lines.append(raw)
            continue
        if in_code or not raw.strip():
            lines.append(raw)
            continue
        # Normalize headings/bullets lightly
        clean = raw.replace("\t", "  ").rstrip()
        wrapped = textwrap.wrap(clean, width=width) or [""]
        lines.extend(wrapped)
    return lines


def build_installation_pdf(*, out_path: Path) -> None:
    md_path = ROOT / "INSTALLATION_MANUAL.md"
    md_text = md_path.read_text(encoding="utf-8")
    lines = markdown_to_plain_lines(md_text)
    pdf = render_text_pdf(lines, title="INSTALLATION_MANUAL")
    out_path.write_bytes(pdf)


def build_zip(*, out_path: Path) -> None:
    files = iter_files()
    # Ensure manual PDF exists and is included
    manual_pdf = ROOT / "INSTALLATION_MANUAL.pdf"
    if manual_pdf.exists():
        if manual_pdf not in files:
            files.append(manual_pdf)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for p in sorted(files):
            arcname = str(p.relative_to(ROOT))
            zf.write(p, arcname)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--zip",
        dest="zip_path",
        default=str(ROOT / "dist" / "sprint3_software_quality.zip"),
        help="Output zip path",
    )
    parser.add_argument(
        "--pdf",
        dest="pdf_path",
        default=str(ROOT / "INSTALLATION_MANUAL.pdf"),
        help="Output PDF path",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    zip_path = Path(args.zip_path)

    build_installation_pdf(out_path=pdf_path)
    build_zip(out_path=zip_path)

    # Print basic size info for convenience
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"Created: {pdf_path}")
    print(f"Created: {zip_path} ({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

