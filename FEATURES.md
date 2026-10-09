# VWG Brand Support Knowledgebase — Feature Guide

This guide describes the main features and how the pieces fit together. The site is a static single-page application built into `dist/index.html`; the build also produces `dist/chatbot-index.json` for chatbot retrieval.

## 1. Knowledgebase website

- **Single-page article experience:** articles open within the site, with stable hash links such as `#/article/123`.
- **Category-based browsing:** articles are organised using the categories defined in `data/site_data.json`.
- **Search and discovery:** article titles, body text and tags are indexed into searchable text during the build.
- **Tags and article metadata:** articles can include tags, a source label and a source URL.
- **Images and screenshots:** supported images are embedded into the generated page, so published articles do not depend on separate image requests at runtime.
- **Responsive layout:** the interface is designed to adapt to smaller screens as well as desktop.
- **Theme support:** the interface defines dark and light colour themes.
- **Brand styling:** VWG logo assets, custom typography, neon accent styling, and matching favicon / touch icons are included.
- **Rich article formatting:** submitted plain text can be converted to paragraphs, headings, numbered and bulleted lists, bold text, inline code for email-like identifiers and reference codes, and highlighted note / warning callouts.

## 2. Article publishing and review

Articles can come from three sources:

1. **Base content** in `data/site_data.json`, including the original tips and imported Notion content.
2. **Tally → Google Sheets** through `import_gsheet.py`.
3. **Microsoft Forms → Excel workbook** through `import_excel.py`.

Both form-based imports use the shared logic in `article_formatting.py`, so they produce the same article structure and formatting.

### Approval gate

Only rows whose Status value is recognised as approved are published. The importer accepts values such as `Approved`, `Approve`, `Yes`, `Live`, or `Published` (case-insensitive). Pending or rejected rows are not added to the published site.

### Tally / Google Sheets pipeline

- Tally can append form submissions to the connected Google Sheet using Tally's integration.
- The importer recognises common column-header aliases; extra unrecognised columns are ignored.
- The configured sheet is read through its CSV export, so it must be shared as **Anyone with the link — Viewer** for the build runner to read it.
- Tally file-upload URLs can be fetched during the online build and embedded as images. If a URL has expired or fetching fails, the build emits a warning and skips that image.
- The GitHub Actions workflow schedules a rebuild every 30 minutes, and can also be run manually from the Actions tab.

### Microsoft Forms / Excel pipeline

- Form responses are imported from `data/articles.xlsx`.
- Reviewers set the Status cell before publishing.
- The workbook must be updated in the repository when you want the latest batch processed.
- Microsoft Forms uploads stored in OneDrive need to be downloaded and added to `data/images/`; enter the uploaded filename in the workbook.

### Images and content safety

- Supported image formats are PNG, JPG/JPEG, GIF and WebP.
- For sheet/workbook rows, upload local images into `data/images/` and enter their filenames in the Images/Screenshots cell.
- Missing or unsupported images are skipped with warnings rather than stopping the build.
- Base content images are referenced under `data/` and embedded at build time.
- The build does not overwrite `data/site_data.json` with imported form content; imported articles are merged for that build.

## 3. Chatbot retrieval index

The build creates `dist/chatbot-index.json` alongside the web page.

- The index is **text-only** and intentionally excludes image payloads.
- Each eligible entry includes an article ID, title, category, tags, plain-text article body, short excerpt and in-site article URL.
- HTML is stripped and entities are decoded before text is indexed.
- The article text is capped at 12,000 characters per entry; the excerpt is capped at 240 characters.
- The index is generated from the article set after the same approval filtering as the website, so unapproved form submissions are not intentionally exposed through the generated retrieval index.
- The published index is available at `https://brandsupport.github.io/vwg-knowledgebase/chatbot-index.json`.

### External chatbot Worker

A separately deployed Cloudflare Worker can use the published index to retrieve relevant knowledgebase articles and answer questions. Its configuration is separate from this repository and is managed in Cloudflare. The known deployment uses:

- Worker endpoint: `https://white-feather-df3a.mohamed-elqabbany.workers.dev/`
- Allowed website origin: `https://brandsupport.github.io`
- Knowledgebase index URL: `https://brandsupport.github.io/vwg-knowledgebase/chatbot-index.json`

The Worker is not deployed by the GitHub Pages workflow. Changes to Worker code or its environment variables must be deployed separately in Cloudflare. The retrieval index and site content, by contrast, are generated and published by this repository's workflow.

The chatbot is intended to ground responses in relevant articles rather than return unrelated results. Always verify important answers against the article links shown to users; retrieval quality depends on the question and the available published content.

## 4. Automated build and deployment

The workflow in `.github/workflows/deploy.yml`:

- Runs on pushes to `main` that change relevant data, source files or build scripts.
- Can be started manually with `workflow_dispatch`.
- Runs on a 30-minute schedule to refresh the live Google Sheet import.
- Installs Python dependencies, runs `python3 build.py`, uploads the `dist/` output and deploys it to GitHub Pages.

The generated `dist/index.html` is output, not the source of truth. Edit the source files and let the workflow rebuild it rather than hand-editing the generated page.

## 5. Local development

Requirements: Python 3.11 is used by the deployment workflow.

```bash
pip install -r requirements.txt
python3 build.py
```

The build prints import counts and warnings, then writes:

- `dist/index.html` — the deployable knowledgebase page.
- `dist/chatbot-index.json` — the chatbot retrieval index.

## 6. Where to make changes

| Change | Edit |
|---|---|
| Base articles or categories | `data/site_data.json` |
| Tally / Google Sheets mapping and configuration | `import_gsheet.py`, `data/gsheet_config.json` |
| Microsoft Forms / Excel import | `import_excel.py`, `data/articles.xlsx` |
| Shared article formatting, aliases and tags | `article_formatting.py` |
| Layout, styling and browser behaviour | `src/template.html` |
| Build output and chatbot index generation | `build.py` |
| Build and deploy schedule | `.github/workflows/deploy.yml` |
| External chatbot API and retrieval logic | Cloudflare Worker dashboard (deployed separately) |

For detailed form setup, sheet sharing, image handling and review instructions, see the main [README](README.md).
