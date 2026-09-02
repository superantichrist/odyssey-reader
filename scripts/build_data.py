#!/usr/bin/env python3
"""Build static Odyssey reader data from the pinned Perseus TEI source."""

import hashlib
import json
import re
import shutil
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_META_PATH = ROOT / "sources" / "source.json"
OUTPUT_ROOT = ROOT / "public" / "data"
BOOKS_ROOT = OUTPUT_ROOT / "books"
TRANSLATION_ROOT = ROOT / "translations" / "ko"
TEI = "{http://www.tei-c.org/ns/1.0}"

EXPECTED_BOOKS = 24
EXPECTED_LINES = 12107
EXPECTED_PARAGRAPHS = 1186
EXPECTED_PARA_MARKERS = 1162
EXPECTED_GAPS = {
    "10": [456],
    "16": [101],
    "23": [49],
}


def read_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def normalize_text(value):
    value = unicodedata.normalize("NFC", value or "")
    return re.sub(r"\s+", " ", value).strip()


def element_text(element):
    return normalize_text("".join(element.itertext()))


def load_translation(book_number):
    path = TRANSLATION_ROOT / ("{:02d}.json".format(book_number))
    if not path.exists():
        return {"paragraphs": {}}
    payload = read_json(path)
    if payload.get("book") != book_number:
        raise ValueError("Translation book mismatch in {}".format(path))
    if not isinstance(payload.get("paragraphs"), dict):
        raise ValueError("Translation paragraphs must be an object in {}".format(path))
    return payload


def find_numeric_gaps(values):
    if not values:
        return []
    present = set(values)
    return [number for number in range(values[0], values[-1] + 1) if number not in present]


def parse_source(source_path):
    tree = ET.parse(str(source_path))
    root = tree.getroot()
    parent_map = {child: parent for parent in root.iter() for child in parent}
    speech_ids = {}
    speech_counter = 0

    def speech_group(line):
        nonlocal speech_counter
        node = parent_map.get(line)
        while node is not None:
            if node.tag == TEI + "q":
                if node not in speech_ids:
                    speech_counter += 1
                    speech_ids[node] = speech_counter
                return speech_ids[node]
            node = parent_map.get(node)
        return None

    book_nodes = [
        node
        for node in root.iter(TEI + "div")
        if (node.get("subtype") or "").lower() == "book"
    ]
    books = []
    para_marker_count = 0

    for book_node in book_nodes:
        book_number = int(book_node.get("n"))
        source_lines = []
        for line_node in book_node.iter(TEI + "l"):
            raw_ref = line_node.get("n")
            if not raw_ref or not raw_ref.isdigit():
                raise ValueError("Non-numeric line reference in book {}: {}".format(book_number, raw_ref))
            markers = [
                node
                for node in line_node.iter(TEI + "milestone")
                if node.get("unit") == "para"
            ]
            para_marker_count += len(markers)
            source_lines.append(
                {
                    "line": int(raw_ref),
                    "text": element_text(line_node),
                    "paragraphStart": bool(markers),
                    "speechGroup": speech_group(line_node),
                }
            )

        translation = load_translation(book_number)
        translation_rows = translation.get("paragraphs", {})
        paragraphs = []
        current = []

        for line in source_lines:
            if current and line["paragraphStart"]:
                paragraphs.append(current)
                current = []
            current.append(line)
        if current:
            paragraphs.append(current)

        output_paragraphs = []
        used_translation_keys = set()
        for paragraph_index, lines in enumerate(paragraphs, start=1):
            paragraph_id = "od-{:02d}-p{:03d}".format(book_number, paragraph_index)
            translated = translation_rows.get(paragraph_id, {})
            if translated:
                used_translation_keys.add(paragraph_id)
            greek_lines = [
                {"line": line["line"], "text": line["text"]}
                for line in lines
            ]
            speech_groups = sorted(
                set(line["speechGroup"] for line in lines if line["speechGroup"] is not None)
            )
            output_paragraphs.append(
                {
                    "id": paragraph_id,
                    "work": "odyssey",
                    "book": book_number,
                    "paragraph": paragraph_index,
                    "lineStart": lines[0]["line"],
                    "lineEnd": lines[-1]["line"],
                    "lineRefs": [line["line"] for line in lines],
                    "greekLines": greek_lines,
                    "greek": "\n".join(line["text"] for line in lines),
                    "korean": normalize_text(translated.get("korean", "")),
                    "notes": translated.get("notes", []),
                    "translationStatus": translated.get(
                        "status", "first-pass" if translated.get("korean") else "untranslated"
                    ),
                    "speechGroups": speech_groups,
                }
            )

        unknown = sorted(set(translation_rows) - used_translation_keys)
        if unknown:
            raise ValueError(
                "Unknown translation IDs in book {}: {}".format(book_number, ", ".join(unknown))
            )

        line_numbers = [line["line"] for line in source_lines]
        books.append(
            {
                "book": book_number,
                "labelGreek": "ΡΑΨΩΔΙΑ {}".format(book_number),
                "labelKorean": "제{}권".format(book_number),
                "lineCount": len(source_lines),
                "paragraphCount": len(output_paragraphs),
                "translationCount": sum(1 for row in output_paragraphs if row["korean"]),
                "lineNumberGaps": find_numeric_gaps(line_numbers),
                "paragraphs": output_paragraphs,
                "_sourceLines": source_lines,
            }
        )

    return books, para_marker_count


def validate(books, para_marker_count, source_hash, expected_hash):
    errors = []
    if source_hash.lower() != expected_hash.lower():
        errors.append("Pinned source SHA-256 mismatch")
    if len(books) != EXPECTED_BOOKS:
        errors.append("Expected {} books, found {}".format(EXPECTED_BOOKS, len(books)))
    total_lines = sum(book["lineCount"] for book in books)
    total_paragraphs = sum(book["paragraphCount"] for book in books)
    if total_lines != EXPECTED_LINES:
        errors.append("Expected {} lines, found {}".format(EXPECTED_LINES, total_lines))
    if total_paragraphs != EXPECTED_PARAGRAPHS:
        errors.append(
            "Expected {} paragraphs, found {}".format(EXPECTED_PARAGRAPHS, total_paragraphs)
        )
    if para_marker_count != EXPECTED_PARA_MARKERS:
        errors.append(
            "Expected {} paragraph markers, found {}".format(
                EXPECTED_PARA_MARKERS, para_marker_count
            )
        )

    actual_gaps = {
        str(book["book"]): book["lineNumberGaps"]
        for book in books
        if book["lineNumberGaps"]
    }
    if actual_gaps != EXPECTED_GAPS:
        errors.append("Unexpected line-number gaps: {}".format(actual_gaps))

    all_ids = set()
    for book in books:
        source_rows = book["_sourceLines"]
        output_rows = [
            line
            for paragraph in book["paragraphs"]
            for line in paragraph["greekLines"]
        ]
        source_pairs = [(row["line"], row["text"]) for row in source_rows]
        output_pairs = [(row["line"], row["text"]) for row in output_rows]
        if source_pairs != output_pairs:
            errors.append("Book {} output does not reproduce every source line once".format(book["book"]))
        for paragraph in book["paragraphs"]:
            if paragraph["id"] in all_ids:
                errors.append("Duplicate paragraph ID: {}".format(paragraph["id"]))
            all_ids.add(paragraph["id"])
            if not paragraph["greek"]:
                errors.append("Empty Greek paragraph: {}".format(paragraph["id"]))
            if paragraph["lineRefs"] != [line["line"] for line in paragraph["greekLines"]]:
                errors.append("Line reference mismatch: {}".format(paragraph["id"]))
            for note in paragraph["notes"]:
                if not isinstance(note, dict) or not note.get("text"):
                    errors.append("Malformed note in {}".format(paragraph["id"]))

    for book in books:
        if book["translationCount"] not in (0, book["paragraphCount"]):
            errors.append(
                "Book {} translation must be empty or complete: {}/{}".format(
                    book["book"],
                    book["translationCount"],
                    book["paragraphCount"],
                )
            )
        for paragraph in book["paragraphs"]:
            status = paragraph["translationStatus"]
            if status not in ("untranslated", "first-pass", "reviewed"):
                errors.append(
                    "Unknown translation status in {}: {}".format(
                        paragraph["id"], status
                    )
                )
            if paragraph["korean"] and status == "untranslated":
                errors.append(
                    "Translated paragraph marked untranslated: {}".format(
                        paragraph["id"]
                    )
                )

    if errors:
        raise ValueError("\n".join(errors))

    return {
        "books": len(books),
        "lines": total_lines,
        "paragraphs": total_paragraphs,
        "paragraphMarkers": para_marker_count,
        "translatedParagraphs": sum(book["translationCount"] for book in books),
        "lineNumberGaps": actual_gaps,
    }


def main():
    source_meta = read_json(SOURCE_META_PATH)
    source_path = ROOT / source_meta["localFile"]
    source_bytes = source_path.read_bytes()
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    books, marker_count = parse_source(source_path)
    stats = validate(books, marker_count, source_hash, source_meta["sourceSha256"])

    if BOOKS_ROOT.exists():
        shutil.rmtree(str(BOOKS_ROOT))
    BOOKS_ROOT.mkdir(parents=True, exist_ok=True)

    manifest_books = []
    for book in books:
        clean_book = {key: value for key, value in book.items() if not key.startswith("_")}
        clean_book["sourceEdition"] = source_meta["urn"]
        filename = "{:02d}.json".format(book["book"])
        write_json(BOOKS_ROOT / filename, clean_book)
        manifest_books.append(
            {
                "book": book["book"],
                "path": "data/books/{}".format(filename),
                "lineCount": book["lineCount"],
                "paragraphCount": book["paragraphCount"],
                "translationCount": book["translationCount"],
                "lineNumberGaps": book["lineNumberGaps"],
            }
        )

    manifest = {
        "work": "odyssey",
        "workTitleGreek": source_meta["workTitleGr"],
        "workTitleKorean": source_meta["workTitleKo"],
        "source": {
            key: source_meta[key]
            for key in (
                "edition",
                "urn",
                "repository",
                "sourceUrl",
                "sourceCommit",
                "sourceSha256",
                "license",
                "licenseUrl",
            )
        },
        "stats": stats,
        "books": manifest_books,
    }
    write_json(OUTPUT_ROOT / "manifest.json", manifest)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("build_data.py: {}".format(error), file=sys.stderr)
        sys.exit(1)
