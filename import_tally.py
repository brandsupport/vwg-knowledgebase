"""Import Tally submissions into consistently formatted knowledge-base articles.

Accepts both the repository's existing normalized JSON files and a raw Tally
webhook/response payload (data.fields[]). This keeps field mapping and article
formatting in the repository rather than in a Zapier Code step.
"""
import hashlib
import json
import os
import re

from article_formatting import build_article, category_lookup

ROOT = os.path.dirname(os.path.abspath(__file__))
SUBMISSIONS_DIR = os.path.join(ROOT, "data", "tally_submissions")

FIELD_ALIASES = {
    "title": {"title", "article title", "tip title"},
    "category": {"category", "article category"},
    "tags": {"tag", "tags", "keywords"},
    "body": {"body", "article body", "article content", "content", "description",
             "tip", "tip details", "what is the tip?"},
    "source_url": {"source", "source link", "link", "reference link"},
}


def _text_value(value):
    """Convert common Tally field value shapes to readable text."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return ", ".join(part for part in (_text_value(v) for v in value) if part)
    if isinstance(value, dict):
        # Tally choice fields and upload fields may return objects instead of strings.
        for key in ("text", "label", "name", "value", "url"):
            if value.get(key) not in (None, ""):
                return _text_value(value[key])
        return ""
    return str(value).strip()


def _normalise_submission(item, filename):
    """Return the small, stable schema consumed by the article importer."""
    data = item.get("data") if isinstance(item.get("data"), dict) else {}
    normalized = {}

    # Backwards compatibility: existing Zapier-created JSON uses these fields.
    for key in (*FIELD_ALIASES.keys(), "response_id"):
        if item.get(key) not in (None, ""):
            normalized[key] = _text_value(item[key])

    fields = data.get("fields", item.get("fields", []))
    if isinstance(fields, list):
        for field in fields:
            if not isinstance(field, dict):
                continue
            candidates = (field.get("label"), field.get("key"), field.get("name"))
            canonical = None
            for candidate in candidates:
                label = re.sub(r"\s+", " ", _text_value(candidate)).strip().lower()
                for target, aliases in FIELD_ALIASES.items():
                    if label in aliases:
                        canonical = target
                        break
                if canonical:
                    break
            if canonical and not normalized.get(canonical):
                normalized[canonical] = _text_value(field.get("value"))

    normalized["response_id"] = (
        normalized.get("response_id")
        or _text_value(data.get("responseId"))
        or _text_value(data.get("submissionId"))
        or _text_value(item.get("eventId"))
        or os.path.splitext(filename)[0]
    )
    return normalized


def _escape_control_chars_in_json_strings(raw):
    """Escape literal control characters found inside quoted JSON strings.

    Some webhook-to-GitHub mappings insert article body newlines verbatim into
    a JSON string. That makes the file invalid JSON before the importer sees it.
    Repair only control characters inside strings; leave structural whitespace
    outside strings untouched.
    """
    out = []
    in_string = False
    escaped = False
    for char in raw:
        code = ord(char)
        if in_string and code < 0x20:
            if char == "\n":
                out.append("\\n")
            elif char == "\r":
                out.append("\\r")
            elif char == "\t":
                out.append("\\t")
            else:
                out.append(f"\\u{code:04x}")
            escaped = False
            continue
        out.append(char)
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
    return "".join(out)


def _load_submission_json(raw):
    """Load normal JSON, retrying after escaping literal control chars in strings."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(_escape_control_chars_in_json_strings(raw))

def load_tally_articles(categories):
    """Load each JSON submission once; deterministic IDs make Zapier retries safe."""
    if not os.path.isdir(SUBMISSIONS_DIR):
        return [], []
    lookup = category_lookup(categories)
    cat_short = {c["id"]: c["short"] for c in categories}
    fallback_cat = next((c["id"] for c in categories
                         if c["short"].strip().lower() == "reference"), categories[0]["id"])
    articles, warnings = [], []
    for filename in sorted(os.listdir(SUBMISSIONS_DIR)):
        if not filename.lower().endswith(".json"):
            continue
        path = os.path.join(SUBMISSIONS_DIR, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                item = _load_submission_json(f.read())
        except (OSError, ValueError) as exc:
            warnings.append(f"{filename}: invalid JSON ({exc}) - skipped")
            continue
        if not isinstance(item, dict):
            warnings.append(f"{filename}: expected a JSON object - skipped")
            continue

        item = _normalise_submission(item, filename)
        title = item.get("title", "").strip()
        body = item.get("body", "").strip()
        if not title or not body:
            warnings.append(f"{filename}: title or body missing - skipped")
            continue

        raw_cat = item.get("category", "").strip().lower()
        cat = lookup.get(raw_cat, fallback_cat)
        if raw_cat and raw_cat not in lookup:
            warnings.append(f'{filename}: category "{item["category"]}" not recognised - filed under Reference')
        response_id = item["response_id"]
        digest = hashlib.sha256(response_id.encode("utf-8")).hexdigest()
        article_id = 200000 + int(digest[:8], 16)
        article = build_article(
            art_id=article_id,
            cat=cat,
            cat_short_map=cat_short,
            title=title,
            body=body,
            user_tags_raw=item.get("tags", ""),
            images=[],
            source_url=item.get("source_url", ""),
            source="tally",
        )
        articles.append(article)
    return articles, warnings
