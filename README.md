# VWG Brand Support Knowledgebase — Source

A static, single-page app: no server, no build tooling beyond Python. The live form intake is Tally → GitHub (via the existing Zapier automation) → knowledge base. Tally submissions are stored as JSON files in `data/tally_submissions/`; commits to that folder trigger an automatic build and deployment. Google Sheets is not used by this pipeline.

The legacy Excel importer is retained for compatibility with existing/manual content, but it is not part of the Tally flow.

## Structure

```
├── build.py                   # combines everything below into dist/index.html
├── import_tally.py             # imports Tally submissions delivered to GitHub
├── import_excel.py             # reads data/articles.xlsx, returns approved articles
├── article_formatting.py       # shared logic (body formatting, tags, images)
├── requirements.txt            # pip install -r requirements.txt  (just openpyxl)
├── .github/workflows/
│   └── deploy.yml               # rebuilds + deploys to GitHub Pages on every push
├── src/
│   ├── template.html            # the app shell: all CSS + all JS
│   ├── vw-logo.png              # header/footer logo (used as a mask, coloured by CSS)
│   ├── favicon.png              # browser-tab icon
│   └── apple-touch-icon.png     # iPhone/Android home-screen icon
├── data/
│   ├── site_data.json           # base content: the original Tips & Tricks doc
│   │                             #   + the Notion import (137 articles)
│   ├── articles.xlsx            # legacy/manual Excel articles (optional)
│   ├── article_images/          # screenshots for the base articles (referenced from site_data.json)
│   ├── images/                  # screenshots referenced by filename
│   └── notion_pages_raw.json    # original Notion pulls, for reference
└── dist/
    └── index.html                # OUTPUT — the deployable file (don't hand-edit)
```

Tally JSON submissions are published when they are committed to `data/tally_submissions/`. The importer currently publishes every valid JSON file in that folder, so the Zapier automation should only commit submissions that are ready to go live. The optional Excel importer retains its separate approval-status gate.

---

## Live pipeline: Tally → GitHub → site

**Google Sheets is no longer used by the Tally publishing pipeline.**

- Tally form: **https://tally.so/r/1AqROO**
- The existing Tally-to-GitHub Zapier automation must create a JSON file for each submission under `data/tally_submissions/` on the `main` branch. The repository importer does not poll Tally directly; it reads the files delivered to GitHub.
- A commit to `data/tally_submissions/` triggers the `Build and deploy knowledgebase` GitHub Action automatically. Once the build and deployment succeed, the new tip appears on the live page.
- There is no Google Sheet approval step. The importer currently publishes every valid JSON submission in that folder, so only commit submissions that are ready to publish.

If a tip does not appear, check the Zapier run history, confirm the JSON file landed in `data/tally_submissions/`, and inspect the GitHub Actions run for that commit.

---

## Manual pipeline: Microsoft Form → Excel → site

1. **Someone submits the Microsoft Form** (Title, Category, Tags, Body,
   Source link). Forms writes the response as a new row into
   `data/articles.xlsx`, in a sheet called **Articles**.
2. **You review it** the same way — set the **Status** cell (column L,
   shaded yellow) to `Approved`, `Pending`, or `Rejected`.
3. **You save the workbook and push it** (or upload it through GitHub's
   web UI) to `data/articles.xlsx` in this repo, on the `main` branch.
4. **GitHub Actions rebuilds automatically** on that push.

### Setting up the Microsoft Form (one-time)

1. In Microsoft Forms, create a new form with these questions, in this
   order (names matter — see `data/articles.xlsx` → the **How to use**
   sheet for the exact formatting rules to put in the question
   descriptions):
   - **Title** — short text, required
   - **Category** — choice, required. Copy the 15 options from the
     **Categories** sheet in `articles.xlsx` (column A).
   - **Tags** — short text, optional. "Comma-separated, e.g. Audi, De-Tag"
   - **Body** — long text, required. Mention in the description: blank
     line = new paragraph, `- ` = bullet, `## ` = heading, `Note: ` =
     highlighted box.
   - **Source link** — short text, optional.
   - *(optional)* **Images** — see below.
2. In the Form's **Responses** tab, click **Open in Excel** (or the **⋯**
   menu → **Export to Excel**) once — this creates the linked workbook.
   Rename/move that file to `data/articles.xlsx` in this repo, matching the
   column layout already in the template.
3. Add one more column at the end named **Status**, and shade it so
   reviewers notice it.
4. From then on, every new Form response appears as a new row in that same
   workbook. Re-download/sync it into the repo whenever you're ready to
   review and publish a batch.

### Adding images / screenshots (either pipeline)

1. Upload the image file itself to `data/images/` in the repo (dragging it
   into GitHub's web UI works fine).
2. In the **Images** (or **Screenshots**) cell for that row, type the
   filename — e.g. `screenshot1.png`, or `step1.png, step2.png` for more
   than one.

A misspelled or missing filename just skips that image with a warning — it
never breaks the build.

**Tally forms specifically:** if a submitter attaches a file directly in
the form's file-upload question, Tally stores it as a URL in the
Screenshots column rather than a filename. The live pipeline handles this
automatically — it downloads the file at build time and embeds it, no
manual step needed. (This only works because the GitHub Action runner has
internet access; it's skipped with a warning if you run `build.py` on a
machine with no network, e.g. offline.)

**Microsoft Forms specifically:** a file-upload question saves to OneDrive
instead, which the build can't reach automatically — download it from
there, upload it to `data/images/`, then type its filename into the Images
column by hand.

---

## Rebuilding locally

```bash
pip install -r requirements.txt
python3 build.py
```

Prints how many articles were pulled from each source and any warnings
(unrecognised category, missing Title/Body, a malformed Tally submission, duplicate IDs), then writes `dist/index.html`.

## Data model

`site_data.json` has `categories` (`{id, title, short, icon}`) and
`articles` (`{id, cat, title, tags, html, images, source, source_url}`; `images`
are file paths under `data/`, inlined into the page at build time, and
`search_text` is generated at build time). `import_excel.py` and `import_tally.py` produce
objects in the same shape (`source: "excel"` or `"tally"`). `build.py`
merges imported articles with `data/site_data.json`; the base file itself is
never modified by either import.

## Editing content directly (bypassing Tally)

- **Base articles/categories** → edit `data/site_data.json`, rebuild.
- **Styling, layout, behaviour** → edit `src/template.html`, rebuild.
- **A one-off article** → type it straight into a row in `data/articles.xlsx`
  and set Status to Approved; it does not have to come through Tally.

## Deploying

**First time:** push this repo to GitHub, then in **Settings → Pages** set
Source to **GitHub Actions** (not "Deploy from a branch" — the workflow
handles that).

**Manually, without the Action:** run `python3 build.py` and upload/commit
`dist/index.html` yourself — it's a single static file, so it can be hosted
anywhere that serves static files.


## Feature documentation

See **[FEATURES.md](FEATURES.md)** for the complete feature guide, including the knowledgebase interface, article publishing and formatting, search and filtering, accessibility/responsive behaviour, the chatbot index and Worker integration, and the automated deployment pipeline.
