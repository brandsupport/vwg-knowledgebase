"""
Shared logic between import_excel.py (Excel/Microsoft Forms) and
import_gsheet.py (Google Sheets/Tally): turning a row of plain-text answers
into the same article shape the site expects.
"""
import re
import os
import base64

ID_OFFSET = 5000  # team-submitted articles get ids 5000+ so they never clash with the base data

ALIASES = {
    "title": ["title", "article title"],
    "category": ["category"],
    "tags": ["tags", "tag"],
    "body": ["body", "article content", "content"],
    "images": ["images", "image", "screenshots", "screenshot", "attachments", "attachment"],
    "source": ["source link", "source", "link"],
    "status": ["status"],
    "id": ["id", "submission id"],
}
APPROVED = {"approved", "approve", "yes", "live", "published"}
IMAGE_EXTS = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".gif": "image/gif", ".webp": "image/webp"}

KEYWORD_TAGS = [
    (r'\baudi\b', 'Audi'), (r'\bsk[oó]da\b', 'Skoda'), (r'\bseat\b', 'SEAT'),
    (r'\bcupra\b', 'Cupra'), (r'\bvwcv\b', 'VWCV'), (r'\bvwpc\b', 'VWPC'),
    (r'\bsli\b', 'SLI'), (r'\bgis\b', 'GIS'), (r'\b(rav|raval)\b', 'RaV'),
    (r'\biva\b', 'IVA'), (r'\bdemo\b', 'Demo'), (r'\bfund', 'Funding'),
    (r'\bgrant', 'Grant'), (r'\btransfer', 'Transfer'), (r'de-?tag', 'De-Tag'),
    (r'\bquot', 'Quotation'), (r'\bpric', 'Pricing'), (r'\bdeliver', 'Delivery'),
    (r'\bdelay', 'Delays'), (r'\badopt', 'Adoption'), (r'\bv55\b', 'V55'),
    (r'\bdvla\b', 'DVLA'), (r'\bev\b|electric vehicle', 'EV'), (r'\bwarrant', 'Warranty'),
]

INLINE = re.compile(r'([\w.+-]+@[\w-]+\.[\w.-]+)|(\b[A-Z]{2,5}\d{3,5}-\d{2}\b)')
CALLOUT = re.compile(r'^(note|important|reminder|warning)\b', re.I)
URL_RE = re.compile(r'^https?://[^\s"\'<>]+$', re.I)


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))


def inline_html(text):
    text = re.sub(r'\*\*(.+?)\*\*', lambda m: '\x01' + m.group(1) + '\x02', text)
    out, pos = [], 0
    for m in INLINE.finditer(text):
        out.append(esc(text[pos:m.start()]))
        out.append(f'<code>{esc(m.group(0))}</code>')
        pos = m.end()
    out.append(esc(text[pos:]))
    return ''.join(out).replace('\x01', '<strong>').replace('\x02', '</strong>')


def body_to_html(body):
    html, buf, tag = [], [], None

    def flush():
        nonlocal buf, tag
        if buf:
            html.append(f'<{tag}>' + ''.join(f'<li>{inline_html(x)}</li>' for x in buf) + f'</{tag}>')
            buf, tag = [], None

    for raw in body.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        s = raw.strip()
        if not s:
            flush()
            continue
        if s.startswith('## '):
            flush(); html.append(f'<h3>{inline_html(s[3:])}</h3>'); continue
        if s.startswith('### '):
            flush(); html.append(f'<h4>{inline_html(s[4:])}</h4>'); continue
        m = re.match(r'^[-•*]\s+(.*)', s)
        if m:
            if tag != 'ul': flush(); tag = 'ul'
            buf.append(m.group(1)); continue
        m = re.match(r'^\d+[.)]\s+(.*)', s)
        if m:
            if tag != 'ol': flush(); tag = 'ol'
            buf.append(m.group(1)); continue
        flush()
        if CALLOUT.match(s):
            html.append(f'<div class="callout">⚠️ {inline_html(s)}</div>')
        else:
            html.append(f'<p>{inline_html(s)}</p>')
    flush()
    return ''.join(html)


def category_lookup(categories):
    lut = {}
    for c in categories:
        lut[c['short'].strip().lower()] = c['id']
        lut[c['title'].strip().lower()] = c['id']
        lut[str(c['id'])] = c['id']
    return lut


def clean_url(v):
    v = (v or '').strip()
    return v if URL_RE.match(v) else ''


def load_local_image(name, images_dir, warnings, row_label):
    """Looks up a bare filename in images_dir and returns a data: URI, or None."""
    name = name.replace('\\', '/').split('/')[-1]
    ext = os.path.splitext(name)[1].lower()
    if ext not in IMAGE_EXTS:
        warnings.append(f'{row_label}: "{name}" is not a supported image type (png/jpg/jpeg/gif/webp) - skipped')
        return None
    fpath = os.path.join(images_dir, name)
    if not os.path.isfile(fpath):
        warnings.append(f'{row_label}: image "{name}" not found in data/images/ - skipped')
        return None
    with open(fpath, 'rb') as imgf:
        b64 = base64.b64encode(imgf.read()).decode('ascii')
    return f'data:{IMAGE_EXTS[ext]};base64,{b64}'


def fetch_remote_image(url, warnings, row_label, timeout=15):
    """Downloads an image URL (e.g. a Tally file-upload link) and returns a data: URI, or None.
    Only usable where outbound network access exists (a GitHub Action runner) -
    returns None with a warning if the fetch fails for any reason (no network,
    expired link, wrong content type, too large)."""
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ctype = resp.headers.get('Content-Type', '').split(';')[0].strip().lower()
            if ctype not in IMAGE_EXTS.values():
                warnings.append(f'{row_label}: file at {url} is not a supported image type ({ctype}) - skipped')
                return None
            data = resp.read(8_000_000 + 1)
            if len(data) > 8_000_000:
                warnings.append(f'{row_label}: image at {url} is over 8MB - skipped')
                return None
            b64 = base64.b64encode(data).decode('ascii')
            return f'data:{ctype};base64,{b64}'
    except Exception as e:
        warnings.append(f'{row_label}: could not download image from {url} ({e}) - skipped')
        return None


def build_article(*, art_id, cat, cat_short_map, title, body, user_tags_raw,
                   images, source_url, source):
    """Assembles one article dict in the shape the site expects."""
    html = body_to_html(body)
    plain = re.sub(r'<[^>]+>', ' ', html)
    user_tags = [t.strip() for t in re.split(r'[,;\n]', user_tags_raw) if t.strip()]
    tags = [cat_short_map[cat]]
    for t in user_tags:
        if t.lower() not in [x.lower() for x in tags]:
            tags.append(t)
    for pat, tag in KEYWORD_TAGS:
        if len(tags) >= 6:
            break
        if tag.lower() not in [x.lower() for x in tags] and re.search(pat, title + ' ' + plain, re.I):
            tags.append(tag)
    return {
        'id': art_id,
        'cat': cat,
        'title': title,
        'tags': tags[:8],
        'html': html,
        'images': images,
        'source': source,
        'source_url': clean_url(source_url),
        'search_text': (title + ' ' + plain + ' ' + ' '.join(tags)).lower(),
    }
