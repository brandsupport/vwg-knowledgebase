#!/usr/bin/env python3
"""
Build script for the VWG Brand Support Knowledgebase.

Combines
    src/template.html          the app (CSS + JS)
    data/site_data.json        base content (original tips + Notion articles)
    data/articles.xlsx         OPTIONAL - articles submitted through a form into Excel
    data/gsheet_config.json    OPTIONAL - points at a live Google Sheet (Tally's
                                 Google Sheets integration) to pull articles from
into one self-contained, deployable file.

Usage:
    pip install -r requirements.txt
    python3 build.py          -> writes dist/index.html
"""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(ROOT, "src", "template.html")
DATA_PATH = os.path.join(ROOT, "data", "site_data.json")
XLSX_PATH = os.path.join(ROOT, "data", "articles.xlsx")
GSHEET_CONFIG_PATH = os.path.join(ROOT, "data", "gsheet_config.json")
IMAGES_DIR = os.path.join(ROOT, "data", "images")
OUT_DIR = os.path.join(ROOT, "dist")
OUT_PATH = os.path.join(OUT_DIR, "index.html")


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

    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        shell = f.read()
    if "__SITE_DATA__" not in shell:
        raise SystemExit("template.html is missing the __SITE_DATA__ placeholder")

    # Escape "</" so the JSON can't close the surrounding <script> tag.
    safe_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    final_html = shell.replace("__SITE_DATA__", safe_json)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(final_html)
    print(f"Built {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1e6:.2f} MB, {len(data['articles'])} articles)")


if __name__ == "__main__":
    main()
