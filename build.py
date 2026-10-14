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
    game_source = os.path.join(ROOT, "game.html")
    if os.path.isfile(game_source):
        with open(game_source, "r", encoding="utf-8") as f:
            game_html = f.read()
        # Reuse the exact same favicon and Apple touch icon embedded in the main page.
        for placeholder, filename in (("__VW_LOGO__", "vw-logo.png"),
                                      ("__FAVICON__", "favicon.png"),
                                      ("__APPLE_ICON__", "apple-touch-icon.png")):
            icon_path = os.path.join(ROOT, "src", filename)
            if os.path.exists(icon_path):
                with open(icon_path, "rb") as f:
                    icon_uri = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
            else:
                print(f"  WARNING: src/{filename} not found - game icon will be blank")
                icon_uri = ""
            game_html = game_html.replace(placeholder, icon_uri)
        with open(os.path.join(OUT_DIR, "game.html"), "w", encoding="utf-8") as f:
            f.write(game_html)
        print("Copied De-tag Challenge to dist/game.html with shared favicon")
        # Publish the real brand logos beside game.html so relative image URLs work on Pages.
        game_assets = os.path.join(ROOT, "assets", "game")
        if os.path.isdir(game_assets):
            shutil.copytree(game_assets, os.path.join(OUT_DIR, "assets", "game"), dirs_exist_ok=True)
            print("Copied game brand assets to dist/assets/game")
    crush_source = os.path.join(ROOT, "knowledge-crush.html")
    if os.path.isfile(crush_source):
        with open(crush_source, "r", encoding="utf-8") as f:
            crush_html = f.read()
        for placeholder, filename in (("__VW_LOGO__", "vw-logo.png"),
                                      ("__FAVICON__", "favicon.png"),
                                      ("__APPLE_ICON__", "apple-touch-icon.png")):
            icon_path = os.path.join(ROOT, "src", filename)
            if os.path.exists(icon_path):
                with open(icon_path, "rb") as f:
                    icon_uri = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
            else:
                icon_uri = ""
            crush_html = crush_html.replace(placeholder, icon_uri)
        with open(os.path.join(OUT_DIR, "knowledge-crush.html"), "w", encoding="utf-8") as f:
            f.write(crush_html)
        print("Copied Knowledge Crush to dist/knowledge-crush.html with shared favicon")
    solitaire_source = os.path.join(ROOT, "support-solitaire.html")
    if os.path.isfile(solitaire_source):
        with open(solitaire_source, "r", encoding="utf-8") as f:
            solitaire_html = f.read()
        for placeholder, filename in (("__VW_LOGO__", "vw-logo.png"),
                                      ("__FAVICON__", "favicon.png"),
                                      ("__APPLE_ICON__", "apple-touch-icon.png")):
            icon_path = os.path.join(ROOT, "src", filename)
            if os.path.exists(icon_path):
                with open(icon_path, "rb") as f:
                    icon_uri = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
            else:
                icon_uri = ""
            solitaire_html = solitaire_html.replace(placeholder, icon_uri)
        with open(os.path.join(OUT_DIR, "support-solitaire.html"), "w", encoding="utf-8") as f:
            f.write(solitaire_html)
        print("Copied Support Solitaire to dist/support-solitaire.html with shared favicon")
    games_hub_source = os.path.join(ROOT, "knowledge-games.html")
    if os.path.isfile(games_hub_source):
        with open(games_hub_source, "r", encoding="utf-8") as f:
            games_html = f.read()
        for placeholder, filename in (("__VW_LOGO__", "vw-logo.png"),
                                      ("__FAVICON__", "favicon.png"),
                                      ("__APPLE_ICON__", "apple-touch-icon.png")):
            icon_path = os.path.join(ROOT, "src", filename)
            if os.path.exists(icon_path):
                with open(icon_path, "rb") as f:
                    icon_uri = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
            else:
                icon_uri = ""
            games_html = games_html.replace(placeholder, icon_uri)
        with open(os.path.join(OUT_DIR, "knowledge-games.html"), "w", encoding="utf-8") as f:
            f.write(games_html)
        print("Copied Knowledge Games hub to dist/knowledge-games.html with shared favicon")
    # Publish Knowledge Rush and its sprite assets. The prototype references
    # ../Knowledge_rush_assets/... so preserve both directory names under dist.
    rush_source = os.path.join(ROOT, "knowledge-rush-prototype")
    rush_assets_source = os.path.join(ROOT, "Knowledge_rush_assets")
    if os.path.isdir(rush_source):
        rush_out = os.path.join(OUT_DIR, "knowledge-rush-prototype")
        shutil.copytree(rush_source, rush_out, dirs_exist_ok=True)
        rush_html_path = os.path.join(rush_out, "index.html")
        if os.path.isfile(rush_html_path):
            with open(rush_html_path, "r", encoding="utf-8") as f:
                rush_html = f.read()
            for placeholder, filename in (("__VW_LOGO__", "vw-logo.png"),
                                          ("__FAVICON__", "favicon.png"),
                                          ("__APPLE_ICON__", "apple-touch-icon.png")):
                icon_path = os.path.join(ROOT, "src", filename)
                if os.path.exists(icon_path):
                    with open(icon_path, "rb") as f:
                        icon_uri = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
                else:
                    icon_uri = ""
                rush_html = rush_html.replace(placeholder, icon_uri)
            with open(rush_html_path, "w", encoding="utf-8") as f:
                f.write(rush_html)
        print("Copied Knowledge Rush prototype to dist/knowledge-rush-prototype with shared favicon")
    if os.path.isdir(rush_assets_source):
        shutil.copytree(rush_assets_source, os.path.join(OUT_DIR, "Knowledge_rush_assets"), dirs_exist_ok=True)
        print("Copied Knowledge Rush sprite assets to dist/Knowledge_rush_assets")
    else:
        print("WARNING: Knowledge_rush_assets directory not found; Knowledge Rush sprites may not load")
    # Publish the standalone Subway Runner trial as a separate page.
    subway_preview_source = os.path.join(ROOT, "subway-surfers-preview.html")
    if os.path.isfile(subway_preview_source):
        subway_preview_out = os.path.join(OUT_DIR, "subway-surfers-preview")
        os.makedirs(subway_preview_out, exist_ok=True)
        shutil.copyfile(subway_preview_source, os.path.join(subway_preview_out, "index.html"))
        print("Copied standalone Subway Runner preview to dist/subway-surfers-preview")

    print(f"Built {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1e6:.2f} MB, {len(data['articles'])} articles)")
    print(f"Built {CHATBOT_INDEX_PATH} (text-only chatbot retrieval index)")


if __name__ == "__main__":
    main()
