#!/usr/bin/env python3
"""
Pulls rows from a Google Sheet (the one Tally's "Google Sheets" integration
writes to) and converts approved rows into knowledgebase articles.

The sheet is read via its public CSV export URL:
    https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>
which means the spreadsheet must be shared as "Anyone with the link: Viewer"
(Share -> General access). Nothing else needs to be public - only this one
spreadsheet, and only for reading.

Configure which sheet to pull from in data/gsheet_config.json:
    {
      "spreadsheet_id": "12jm0IB84L5NjXh4DfLUQRZrL1xegbolsyX9Bibfae0I",
      "gid": "0"
    }
If that file doesn't exist, the Google Sheets step is skipped entirely (the
Excel pipeline still runs on its own).

Columns: same names/meaning as import_excel.py (Title, Category, Tags,
Body, Images/Screenshots, Source link, Status) - whatever Tally named them
is fine, matched the same case-insensitive way. The "Images"/"Screenshots"
column can hold either:
  - a bare filename (looked up in data/images/, same as the Excel sheet), or
  - one or more http(s) URLs (Tally's own file-upload links) - these are
    downloaded and embedded automatically. Downloading only works where
    outbound internet access exists (a GitHub Action runner); it is skipped
    with a warning when run somewhere offline.
"""
import csv
import io
import os
import urllib.request
from article_formatting import (
    ALIASES, APPROVED, ID_OFFSET, category_lookup, load_local_image,
    fetch_remote_image, build_article,
)


def _csv_url(spreadsheet_id, gid):
    return f'https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid}'


def _fetch_csv_rows(url, timeout=20):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode('utf-8-sig', errors='replace')
    return list(csv.reader(io.StringIO(raw)))


def _find_header(rows):
    for r_idx in range(min(10, len(rows))):
        headers = [c.strip().lower() for c in rows[r_idx]]
        cols = {}
        for key, names in ALIASES.items():
            for i, h in enumerate(headers):
                if h in names:
                    cols[key] = i
                    break
        if 'title' in cols and 'body' in cols:
            return r_idx, cols
    return None, None


def load_gsheet_articles(spreadsheet_id, gid, categories, images_dir):
    """Returns (articles, warnings)."""
    warnings = []
    try:
        rows = _fetch_csv_rows(_csv_url(spreadsheet_id, gid))
    except Exception as e:
        return [], [f'Could not read the Google Sheet ({e}). '
                     f'Make sure it is shared as "Anyone with the link: Viewer".']

    header_row, cols = _find_header(rows)
    if header_row is None:
        return [], ['The Google Sheet has no row with both a "Title" and a "Body" column - skipped.']

    if 'status' not in cols:
        warnings.append('No Status column found in the Google Sheet - every row will be published.')

    cat_lut = category_lookup(categories)
    cat_short = {c['id']: c['short'] for c in categories}
    fallback_cat = cat_lut.get('reference')

    def cell(row, key):
        i = cols.get(key)
        if i is None or i >= len(row):
            return ''
        return row[i].strip()

    articles = []
    for offset, row in enumerate(rows[header_row + 1:], start=1):
        if not any(c.strip() for c in row):
            continue
        title, body = cell(row, 'title'), cell(row, 'body')
        if not title and not body:
            continue
        if 'status' in cols and cell(row, 'status').lower() not in APPROVED:
            continue
        if not title or not body:
            warnings.append(f'Row {header_row + offset + 1}: skipped (Title and Body are both required)')
            continue

        row_label = f'Row {header_row + offset + 1}'
        raw_cat = cell(row, 'category')
        cat = cat_lut.get(raw_cat.lower())
        if cat is None:
            cat = fallback_cat
            warnings.append(f'{row_label}: category "{raw_cat}" not recognised - filed under Reference')

        raw_id = cell(row, 'id')
        try:
            art_id = ID_OFFSET + 10_000 + int(raw_id)  # offset again so gsheet/xlsx ids can't collide
        except ValueError:
            art_id = ID_OFFSET + 10_000 + header_row + offset

        images = []
        for item in cell(row, 'images').replace(';', ',').split(','):
            item = item.strip()
            if not item:
                continue
            if item.lower().startswith(('http://', 'https://')):
                uri = fetch_remote_image(item, warnings, row_label)
            else:
                uri = load_local_image(item, images_dir, warnings, row_label)
            if uri:
                images.append(uri)

        articles.append(build_article(
            art_id=art_id, cat=cat, cat_short_map=cat_short,
            title=title, body=body, user_tags_raw=cell(row, 'tags'),
            images=images, source_url=cell(row, 'source'), source='gsheet',
        ))

    articles.sort(key=lambda a: a['id'], reverse=True)
    return articles, warnings


def load_gsheet_articles_from_config(config_path, categories, images_dir):
    if not os.path.exists(config_path):
        return [], []
    import json
    cfg = json.load(open(config_path, encoding='utf-8'))
    return load_gsheet_articles(cfg['spreadsheet_id'], cfg.get('gid', '0'), categories, images_dir)


if __name__ == '__main__':
    import json, sys
    root = os.path.dirname(os.path.abspath(__file__))
    data = json.load(open(os.path.join(root, 'data', 'site_data.json'), encoding='utf-8'))
    images_dir = os.path.join(root, 'data', 'images')
    if len(sys.argv) > 1:
        arts, warns = load_gsheet_articles(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '0',
                                            data['categories'], images_dir)
    else:
        arts, warns = load_gsheet_articles_from_config(
            os.path.join(root, 'data', 'gsheet_config.json'), data['categories'], images_dir)
    print(f'{len(arts)} article(s) would be published')
    for a in arts:
        print(f'  #{a["id"]}  [{a["tags"][0]}]  {a["title"]}  images={len(a["images"])}')
    for w in warns:
        print('  WARNING:', w)
