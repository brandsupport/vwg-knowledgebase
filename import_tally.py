"""Import articles submitted through the Tally -> GitHub Zapier flow."""
import hashlib
import json
import os
import re

from article_formatting import build_article, category_lookup

ROOT = os.path.dirname(os.path.abspath(__file__))
SUBMISSIONS_DIR = os.path.join(ROOT, "data", "tally_submissions")


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
                item = json.load(f)
        except (OSError, ValueError) as exc:
            warnings.append(f"{filename}: invalid JSON ({exc}) - skipped")
            continue
        title = str(item.get("title", "")).strip()
        body = str(item.get("body", "")).strip()
        if not title or not body:
            warnings.append(f"{filename}: title or body missing - skipped")
            continue
        raw_cat = str(item.get("category", "")).strip().lower()
        cat = lookup.get(raw_cat, fallback_cat)
        response_id = str(item.get("response_id") or os.path.splitext(filename)[0]).strip()
        digest = hashlib.sha256(response_id.encode("utf-8")).hexdigest()
        article_id = 200000 + int(digest[:8], 16)
        article = build_article(
            art_id=article_id,
            cat=cat,
            cat_short_map=cat_short,
            title=title,
            body=body,
            user_tags_raw=str(item.get("tags", "")),
            images=[],
            source_url=str(item.get("source_url", "")),
            source="tally",
        )
        articles.append(article)
    return articles, warnings
