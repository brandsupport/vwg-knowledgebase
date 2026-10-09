#!/usr/bin/env python3
"""
Build script for the VWG Brand Support Knowledgebase.

Combines
    src/template.html          the app (CSS + JS)
    data/site_data.json        base content (original tips + Notion articles)
    data/articles.xlsx         OPTIONAL - articles submitted through a form into Excel
    data/gsheet_config.json    OPTIONAL - points at a live Google Sheet (Tally's
                                 Google Sheets integration) to pull articles from
into one self-contained, deployable file, plus a small text-only chatbot index.

Usage:
    pip install -r requirements.txt
    python3 build.py          -> writes dist/index.html and dist/chatbot-index.json
"""
import base64
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(ROOT, "src", "template.html")
DATA_PATH = os.path.join(ROOT, "data", "site_data.json")
XLSX_PATH = os.path.join(ROOT, "data", "articles.xlsx")
GSHEET_CONFIG_PATH = os.path.join(ROOT, "data", "gsheet_config.json")
IMAGES_DIR = os.path.join(ROOT, "data", "images")
OUT_DIR = os.path.join(ROOT, "dist")
OUT_PATH = os.path.join(OUT_DIR, "index.html")
CHATBOT_INDEX_PATH = os.path.join(OUT_DIR, "chatbot-index.json")

EXT_MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp"}
HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")


def resolve_images(article):
    """Images in site_data.json are stored as file paths under data/ (e.g.
    "article_images/a59_1.png"); the built page needs them inlined as data: URIs."""
    out = []
    for ref in article.get("images", []):
        if ref.startswith("data:"):
            out.append(ref)
            continue
        path = os.path.join(ROOT, "data", ref)
        ext = os.path.splitext(ref)[1].lower()
        if not os.path.isfile(path) or ext not in EXT_MIME:
            print(f"  WARNING: article {article['id']}: image {ref} not found - skipped")
            continue
        with open(path, "rb") as f:
            out.append(f"data:{EXT_MIME[ext]};base64," + base64.b64encode(f.read()).decode("ascii"))
    article["images"] = out


def ensure_search_text(article):
    if not article.get("search_text"):
        plain = HTML_TAG_RE.sub(" ", article["html"])
        article["search_text"] = (article["title"] + " " + plain + " " + " ".join(article["tags"])).lower()


def build_chatbot_index(data):
    """Return a compact text-only index for retrieval; never include image payloads."""
    categories = {c["id"]: c.get("title", c.get("short", "Other"))
                  for c in data.get("categories", [])}
    entries = []
    for article in data.get("articles", []):
        # This receives the already-filtered/approved article list from the build pipeline.
        plain = html.unescape(HTML_TAG_RE.sub(" ", article.get("html", "")))
        plain = WHITESPACE_RE.sub(" ", plain).strip()
        title = str(article.get("title", "")).strip()
        tags = [str(tag).strip() for tag in article.get("tags", []) if str(tag).strip()]
        if not title or not plain and not tags:
            continue
        article_id = article["id"]
        entries.append({
            "id": article_id,
            "title": title,
            "category": categories.get(article.get("cat"), "Other"),
            "tags": tags,
            "text": plain[:12000],
            "excerpt": plain[:240],
            "url": f"#/article/{article_id}",
        })
    return {"version": 1, "articles": entries}


def main():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Base data never contains team-submitted articles; drop any just in
    # case so rebuilding twice can't create duplicates.
    data["articles"] = [a for a in data["articles"] if a.get("source") not in ("excel", "gsheet")]

    if os.path.exists(XLSX_PATH):
        from import_excel import load_excel_articles
        excel_articles, warnings = load_excel_articles(XLSX_PATH, data["categories"], IMAGES_DIR)
        data["articles"] = excel_articles + data["articles"]
        print(f"Excel: {len(excel_articles)} approved article(s) added from data/articles.xlsx")
        for w in warnings:
            print("  WARNING:", w)
    else:
        print("Excel: data/articles.xlsx not found - skipping")

    if os.path.exists(GSHEET_CONFIG_PATH):
        from import_gsheet import load_gsheet_articles_from_config
        gsheet_articles, warnings = load_gsheet_articles_from_config(
            GSHEET_CONFIG_PATH, data["categories"], IMAGES_DIR)
        # newest-submitted-anywhere-first: put these ahead of the Excel batch too
        data["articles"] = gsheet_articles + data["articles"]
        print(f"Google Sheet: {len(gsheet_articles)} approved article(s) added")
        for w in warnings:
            print("  WARNING:", w)
    else:
        print("Google Sheet: data/gsheet_config.json not found - skipping")

    for a in data["articles"]:
        resolve_images(a)
        ensure_search_text(a)

    seen, dupes = set(), set()
    for a in data["articles"]:
        (dupes if a["id"] in seen else seen).add(a["id"])
    if dupes:
        raise SystemExit(f"Duplicate article ids {sorted(dupes)} - every article needs a unique id")

    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        shell = f.read()
    if "__SITE_DATA__" not in shell:
        raise SystemExit("template.html is missing the __SITE_DATA__ placeholder")

    # Escape "</" so the JSON can't close the surrounding <script> tag.
    safe_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    final_html = shell.replace("__SITE_DATA__", safe_json)
    for placeholder, filename in (("__VW_LOGO__", "vw-logo.png"), ("__FAVICON__", "favicon.png"),
                                  ("__APPLE_ICON__", "apple-touch-icon.png")):
        path = os.path.join(ROOT, "src", filename)
        if os.path.exists(path):
            with open(path, "rb") as f:
                uri = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
        else:
            print(f"  WARNING: src/{filename} not found - logo/favicon will be blank")
            uri = ""
        final_html = final_html.replace(placeholder, uri)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(final_html)
    with open(CHATBOT_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(build_chatbot_index(data), f, ensure_ascii=False, separators=(",", ":"))
    print(f"Built {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1e6:.2f} MB, {len(data['articles'])} articles)")
    print(f"Built {CHATBOT_INDEX_PATH} (text-only chatbot retrieval index)")


if __name__ == "__main__":
    main()
