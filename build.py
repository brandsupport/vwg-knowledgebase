#!/usr/bin/env python3
"""
Build script for the VWG Brand Support Knowledgebase.

Combines
    src/template.html          the app (CSS + JS)
    data/site_data.json        base content (original tips + Notion articles)
    data/articles.xlsx         OPTIONAL - legacy/manual Excel articles
    data/tally_submissions/    Tally submissions delivered directly to GitHub
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
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(ROOT, "src", "template.html")
DATA_PATH = os.path.join(ROOT, "data", "site_data.json")
XLSX_PATH = os.path.join(ROOT, "data", "articles.xlsx")
IMAGES_DIR = os.path.join(ROOT, "data", "images")
OUT_DIR = os.path.join(ROOT, "dist")
OUT_PATH = os.path.join(OUT_DIR, "index.html")
CHATBOT_INDEX_PATH = os.path.join(OUT_DIR, "chatbot-index.json")

EXT_MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp"}
HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")

BRAND_ASSETS = (
    ("__VW_LOGO__", "vw-logo.png"),
    ("__FAVICON__", "favicon.png"),
    ("__APPLE_ICON__", "apple-touch-icon.png"),
)
STATIC_HTML_PAGES = (
    ("game.html", "game.html", "Copied De-tag Challenge to dist/game.html with shared favicon"),
    ("knowledge-crush.html", "knowledge-crush.html", "Copied Knowledge Crush to dist/knowledge-crush.html with shared favicon"),
    ("support-solitaire.html", "support-solitaire.html", "Copied Support Solitaire to dist/support-solitaire.html with shared favicon"),
    ("knowledge-games.html", "knowledge-games.html", "Copied Knowledge Games hub to dist/knowledge-games.html with shared favicon"),
)


def load_brand_asset_uris():
    """Load shared branding assets once for all generated pages."""
    replacements = {}
    for placeholder, filename in BRAND_ASSETS:
        path = os.path.join(ROOT, "src", filename)
        if not os.path.isfile(path):
            print(f"  WARNING: src/{filename} not found - branding asset will be blank")
            replacements[placeholder] = ""
            continue
        with open(path, "rb") as asset_file:
            encoded = base64.b64encode(asset_file.read()).decode("ascii")
        replacements[placeholder] = f"data:image/png;base64,{encoded}"
    return replacements


def replace_brand_asset_placeholders(content, asset_uris):
    """Apply the same resolved branding assets to any HTML, CSS, or template."""
    for placeholder, uri in asset_uris.items():
        content = content.replace(placeholder, uri)
    return content


def publish_html_page(source_path, output_path, asset_uris, message):
    """Copy an HTML page while resolving the shared brand placeholders."""
    if not os.path.isfile(source_path):
        return False
    with open(source_path, "r", encoding="utf-8") as source_file:
        page = source_file.read()
    page = replace_brand_asset_placeholders(page, asset_uris)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as output_file:
        output_file.write(page)
    print(message)
    return True


def publish_frontend_assets(stylesheet_path, script_path, output_dir, asset_uris):
    """Publish the main app's CSS and JavaScript as separate maintainable files."""
    if not os.path.isfile(stylesheet_path):
        raise SystemExit(f"Missing frontend stylesheet: {stylesheet_path}")
    if not os.path.isfile(script_path):
        raise SystemExit(f"Missing frontend script: {script_path}")

    with open(stylesheet_path, "r", encoding="utf-8") as stylesheet_file:
        stylesheet = replace_brand_asset_placeholders(stylesheet_file.read(), asset_uris)
    os.makedirs(output_dir, exist_ok=True)
    stylesheet_output = os.path.join(output_dir, "knowledgebase.css")
    script_output = os.path.join(output_dir, "knowledgebase.js")
    with open(stylesheet_output, "w", encoding="utf-8") as stylesheet_file:
        stylesheet_file.write(stylesheet)
    shutil.copyfile(script_path, script_output)
    return stylesheet_output, script_output



def resolve_images(article):
    """Images in site_data.json are stored as file paths under data/ (e.g.
    "article_images/a59_1.png"); the built page needs them inlined as data: URIs."""
    out = []
    for ref in article.get("images", []):
        if ref.startswith("data:"):
            out.append(ref)
            continue
        # Tally file uploads are hosted remotely. Keep validated HTTPS URLs as
        # image sources; local repository images are still embedded as data URIs.
        if ref.startswith("https://") and not any(ch in ref for ch in ('<', '>', '"', "'")):
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
    data["articles"] = [a for a in data["articles"] if a.get("source") not in ("excel", "gsheet", "tally")]

    if os.path.exists(XLSX_PATH):
        from import_excel import load_excel_articles
        excel_articles, warnings = load_excel_articles(XLSX_PATH, data["categories"], IMAGES_DIR)
        data["articles"] = excel_articles + data["articles"]
        print(f"Excel: {len(excel_articles)} approved article(s) added from data/articles.xlsx")
        for w in warnings:
            print("  WARNING:", w)
    else:
        print("Excel: data/articles.xlsx not found - skipping")

    from import_tally import load_tally_articles
    tally_articles, warnings = load_tally_articles(data["categories"])
    data["articles"] = tally_articles + data["articles"]
    print(f"Tally: {len(tally_articles)} article(s) added from data/tally_submissions/")
    for w in warnings:
        print("  WARNING:", w)

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

    # Escape "</" so embedded JSON cannot close the surrounding script tag.
    safe_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    final_html = shell.replace("__SITE_DATA__", safe_json)

    brand_asset_uris = load_brand_asset_uris()
    final_html = replace_brand_asset_placeholders(final_html, brand_asset_uris)

    os.makedirs(OUT_DIR, exist_ok=True)
    publish_frontend_assets(
        os.path.join(ROOT, "src", "knowledgebase.css"),
        os.path.join(ROOT, "src", "knowledgebase.js"),
        OUT_DIR,
        brand_asset_uris,
    )
    with open(OUT_PATH, "w", encoding="utf-8") as output_file:
        output_file.write(final_html)
    with open(CHATBOT_INDEX_PATH, "w", encoding="utf-8") as output_file:
        json.dump(build_chatbot_index(data), output_file, ensure_ascii=False, separators=(",", ":"))

    for source_name, output_name, message in STATIC_HTML_PAGES:
        publish_html_page(
            os.path.join(ROOT, source_name),
            os.path.join(OUT_DIR, output_name),
            brand_asset_uris,
            message,
        )

    # Publish the De-tag Challenge's supporting brand assets.
    game_assets = os.path.join(ROOT, "assets", "game")
    if os.path.isdir(game_assets):
        shutil.copytree(game_assets, os.path.join(OUT_DIR, "assets", "game"), dirs_exist_ok=True)
        print("Copied game brand assets to dist/assets/game")

    # Publish Knowledge Rush and preserve its relative sprite paths.
    rush_source = os.path.join(ROOT, "knowledge-rush-prototype")
    rush_assets_source = os.path.join(ROOT, "Knowledge_rush_assets")
    if os.path.isdir(rush_source):
        rush_output = os.path.join(OUT_DIR, "knowledge-rush-prototype")
        shutil.copytree(rush_source, rush_output, dirs_exist_ok=True)
        rush_html_path = os.path.join(rush_output, "index.html")
        publish_html_page(
            rush_html_path,
            rush_html_path,
            brand_asset_uris,
            "Copied Knowledge Rush prototype to dist/knowledge-rush-prototype with shared favicon",
        )
    if os.path.isdir(rush_assets_source):
        shutil.copytree(rush_assets_source, os.path.join(OUT_DIR, "Knowledge_rush_assets"), dirs_exist_ok=True)
        print("Copied Knowledge Rush sprite assets to dist/Knowledge_rush_assets")
    else:
        print("WARNING: Knowledge_rush_assets directory not found; Knowledge Rush sprites may not load")
    print(f"Built {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1e6:.2f} MB, {len(data['articles'])} articles)")
    print(f"Built {CHATBOT_INDEX_PATH} (text-only chatbot retrieval index)")


if __name__ == "__main__":
    main()
