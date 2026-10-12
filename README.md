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

---

# Knowledgebase features and operations

## 🗺️ Start here — the big picture

The knowledgebase is a static website generated by Python and published with GitHub Pages. Content is gathered from the base article library and optional form-driven sources, checked for approval, formatted consistently, then built into the site.

```text
📝 Tally form ──► Google Sheet ──┐
                                │
📋 Microsoft Form ─► Excel ─────┼─► ✅ Approval filter
                                │          │
📚 Base articles ───────────────┘          ▼
                                   🧱 Python build
                                      │       │
                                      ▼       ▼
                               🌐 Website  🤖 Chatbot index
                                      │
                                      ▼
                               🚀 GitHub Pages
```

> 💡 **Important distinction:** the website and chatbot index are built and deployed by this repository's GitHub Actions workflow. The chatbot API itself runs separately in Cloudflare and must be deployed there independently.

## 🧩 Feature directory

| Area | What it does |
|---|---|
| 🔎 Browse & search | Find articles by title, body text, category and tags |
| 🗂️ Categories | Group knowledge into the categories defined in the source data |
| 📰 Rich articles | Turn plain-text submissions into readable, consistently formatted articles |
| 🛡️ Approval gate | Keep pending or rejected submissions out of the published article set |
| 📝 Tally → GitHub | Import Tally JSON files delivered to the repository |
| 📋 Forms → Excel | Import approved rows from the workbook stored in the repository |
| 🖼️ Images | Embed supported screenshots and uploaded images into the built page |
| 🤖 Chatbot index | Generate a text-only article index for retrieval |
| 🌗 Interface | Responsive layout, light/dark themes and VWG branding |
| ⚙️ Automation | Build, refresh and publish through GitHub Actions |

---

## 🌐 1. The website experience

### 🔎 Search and discovery
- Searchable text is generated from article titles, body content and tags.
- Articles are organised using the categories in `data/site_data.json`.
- Articles can carry tags, a source label and a source URL.
- Articles open inside the single-page app and can have stable hash links such as `#/article/123`.

### 🎨 Interface and branding
- Responsive layout for desktop and smaller screens.
- Light and dark colour themes.
- VWG logo assets, custom typography, neon accent styling, favicon and touch icons.
- Article images are embedded during the build, avoiding separate image requests at runtime.

### 📰 Article formatting
Plain-text article bodies can be formatted into:
- Paragraphs and section headings
- Numbered and bulleted lists
- **Bold text** and inline code for identifiers or reference codes
- Highlighted note and warning callouts

The Tally and Excel importers share `article_formatting.py`, helping articles from different sources look consistent.

---

## 🛡️ 2. The publishing rules

### Publication rules

**Publication depends on source.** Tally JSON files are published when valid and committed to `data/tally_submissions/`; the legacy Excel importer uses a Status approval filter. The legacy Excel importer recognises approval values such as `Approved`, `Approve`, `Yes`, `Live` and `Published` (case-insensitive). Tally JSON submissions are published when committed, so the external automation must only send tips ready to go live.

| Source | Publication rule |
|---|---|
| Tally JSON | Valid files committed to `data/tally_submissions/` are published; only commit ready-to-publish tips |
| Legacy Excel | Requires an approved Status value |

The importers merge submitted articles into the build output; they do **not** overwrite `data/site_data.json`.

### 🧱 Where content comes from
1. **Base library** — articles and categories stored in `data/site_data.json`, including the original tips and imported Notion content.
2. **Tally submissions** — JSON files under `data/tally_submissions/`, read by `import_tally.py`.
3. **Workbook** — approved Microsoft Forms entries read by `import_excel.py`.

IDs are assigned so imported entries can coexist with the base content.

---

## 📝 3. Live pipeline — Tally → GitHub → website

### 🔄 How it flows
1. Someone submits the [Tally form](https://tally.so/r/1AqROO).
2. The Tally-to-GitHub automation commits a JSON file under `data/tally_submissions/` on `main`.
3. That commit triggers GitHub Actions to build and deploy the website and chatbot index.
4. The tip appears on the live site after the workflow succeeds.

**Important:** the repository importer reads JSON files committed to GitHub; it does not fetch submissions directly from Tally. No Google Sheet or 30-minute polling schedule is used. Confirm the external automation is configured to write to `data/tally_submissions/`.

### ✅ Publishing checklist
- [ ] Confirm the title, category, tags and body are complete.
- [ ] Check the source link and any screenshots.
- [ ] Ensure the automation only commits submissions ready for publication; the importer does not apply a Tally approval-status gate.
- [ ] Confirm the JSON file was committed under `data/tally_submissions/`.
- [ ] Check that the latest GitHub Actions run completed successfully.

---

## 📋 4. Legacy/manual pipeline — Microsoft Forms → Excel → website

> 🟡 **Batch publishing:** responses are prepared in an Excel workbook, reviewed, then committed to the repository when ready to publish.

### 🔄 How it flows
1. A person submits the Microsoft Form.
2. Responses are exported or synced into `data/articles.xlsx`.
3. A reviewer sets the Status cell to `Approved`, `Pending` or `Rejected`.
4. The updated workbook is committed to the repository.
5. GitHub Actions rebuilds and deploys the site.

### 🧾 Suggested form fields
- **Title** — required, short text
- **Category** — required, selected from the supported category list
- **Tags** — optional, comma-separated
- **Body** — required, long text
- **Source link** — optional
- **Images** — optional; see the image workflow below

Use the workbook's **How to use** and **Categories** sheets as the reference for exact formatting rules and valid category options. The workbook includes a Status column for review.

### ✅ Reviewer checklist
- [ ] Confirm the title and category.
- [ ] Format the body using the conventions below.
- [ ] Check the source URL and image filenames.
- [ ] Set Status to an approved value.
- [ ] Save and commit the updated `data/articles.xlsx` file.

---

## ✍️ 5. Writing articles that are easy to read

The body formatter recognises plain-text conventions, so contributors do not need to write HTML.

| To create | Type this in the body |
|---|---|
| New paragraph | Leave a blank line |
| Heading | `## Heading text` |
| Bullet | `- Item text` |
| Numbered step | `1. Step text` |
| Highlighted note | `Note: Put the helpful note here` |
| Warning callout | `Warning: Explain the risk here` |
| Bold emphasis | Use the supported bold-text convention described in the workbook's instructions |

> ✨ **Writing tip:** keep one action or idea per step. Use a clear title, short paragraphs and screenshots where they help someone complete a task.

---

## 🖼️ 6. Images and screenshots

### 📁 Images from a submission or workbook
1. Upload the image file into `data/images/` in the repository.
2. Enter the exact filename in the row's **Images** or **Screenshots** cell.
3. For multiple images, enter comma-separated filenames, for example `step1.png, step2.png`.

Supported formats: **PNG, JPG/JPEG, GIF and WebP**. Missing or unsupported images are skipped with warnings rather than stopping the entire build.

### ☁️ Uploaded images from Tally
Tally file-upload answers can be URLs. The online build attempts to download and embed them. If a URL has expired or fetching fails, the build emits a warning and skips that image.

### 🧷 Microsoft Forms uploads
Microsoft Forms uploads are stored in OneDrive and are not fetched automatically by this pipeline. Download the image, add it to `data/images/`, then enter its filename in the workbook.

### 📚 Base article images
Base content can reference files under `data/`; those files are embedded into the generated page at build time.

---

## 🤖 7. Chatbot retrieval index

The build creates `dist/chatbot-index.json` alongside the website.

### 📦 What each entry contains
- Article ID, title and category
- Tags and plain-text article body
- Short excerpt
- In-site article URL

### 🧹 How it is prepared
- HTML is stripped and HTML entities are decoded.
- Image payloads are excluded; the index is text-only.
- Article text is capped at **12,000 characters** per entry.
- Excerpts are capped at **240 characters**.
- The index is generated from the article set after the approval filtering used by the site.

**Published index:** https://brandsupport.github.io/vwg-knowledgebase/chatbot-index.json

### ☁️ External Cloudflare Worker
The separate Worker uses the published index to retrieve potentially relevant articles and help ground chatbot answers.

| Setting | Current configuration |
|---|---|
| Worker endpoint | https://white-feather-df3a.mohamed-elqabbany.workers.dev/ |
| Allowed website origin | `https://brandsupport.github.io` |
| Knowledgebase index | `https://brandsupport.github.io/vwg-knowledgebase/chatbot-index.json` |

> ⚠️ **Deployment boundary:** the repository workflow does not deploy the Worker. Worker code and environment variables are managed and deployed separately in Cloudflare. Changes to article content flow through the repository's build; Worker changes require a Cloudflare deployment.

**Quality tip:** verify important chatbot answers against the article links shown to users. Retrieval quality depends on the question and the published content.

---

## ⚙️ 8. Build and deployment automation

The workflow lives at `.github/workflows/deploy.yml`.

### 🚀 What it does
- Runs on pushes to `main` that change relevant source, data or build files.
- Supports manual runs through `workflow_dispatch`.
- Installs Python dependencies.
- Runs `python3 build.py`.
- Uploads the generated `dist/` output and deploys it to GitHub Pages.

### 📦 Generated outputs
| File | Purpose |
|---|---|
| `dist/index.html` | Deployable website |
| `dist/chatbot-index.json` | Text-only chatbot retrieval index |

**Do not hand-edit generated output.** Make changes to source files and let the workflow rebuild them.

---

## 🧑‍💻 9. Run a build locally

The deployment workflow uses Python 3.11.

```bash
pip install -r requirements.txt
python3 build.py
```

The build prints import counts and warnings, then generates the two files listed above.

---

## 🧭 10. Where to make changes

| If you want to change… | Start here |
|---|---|
| Base articles or categories | `data/site_data.json` |
| Tally JSON import | `import_tally.py`, `data/tally_submissions/` |
| Microsoft Forms / Excel import | `import_excel.py`, `data/articles.xlsx` |
| Formatting, aliases and tags | `article_formatting.py` |
| Layout, styling and browser behaviour | `src/template.html` |
| Build logic and chatbot index | `build.py` |
| Build/deploy schedule | `.github/workflows/deploy.yml` |
| Cloudflare chatbot API | Cloudflare Worker dashboard (separate deployment) |

### 🗂️ Repository map

```text
build.py                         🧱 Build website + retrieval index
import_excel.py                  📋 Read approved workbook rows
article_formatting.py            ✨ Shared article formatting
requirements.txt                 📦 Python dependencies
.github/workflows/deploy.yml     🚀 Build and deploy automation
src/template.html                🎨 Website shell, CSS and JavaScript
src/vw-logo.png                  🏷️ VWG logo asset
src/favicon.png                  🌐 Browser favicon
src/apple-touch-icon.png         📱 Touch icon
data/site_data.json              📚 Base articles and categories
data/articles.xlsx               📋 Microsoft Forms workbook
data/article_images/             🖼️ Base article images
data/images/                     🖼️ Sheet/workbook images
data/notion_pages_raw.json       🗃️ Raw Notion source reference
dist/index.html                  📦 Generated website (output)
dist/chatbot-index.json          🤖 Generated retrieval index (output)
```

---

## 🆘 Quick troubleshooting

| Symptom | First thing to check |
|---|---|
| New Tally response is missing | Was the JSON file committed to `data/tally_submissions/`? Did the GitHub Actions build and deploy succeed? |
| Excel article is missing | Is Status approved? Was the updated workbook committed? |
| Image does not appear | Check spelling, extension and folder; review build warnings |
| Website has not updated | Check the latest GitHub Actions run and its logs |
| Chatbot gives unrelated results | Check that the relevant article is published and present in the index; review retrieval behaviour in Cloudflare |
| Website works but chatbot endpoint does not | Remember the Worker is deployed separately from GitHub Pages |

## ✅ The simple rule to remember

**Submit in Tally → Commit JSON to GitHub → Build → Publish.**

If something is missing, check the Tally-to-GitHub automation, confirm the JSON file exists in the repository, then inspect the build logs and image paths.

---

*Maintained in the repository README alongside the VWG Brand Support Knowledgebase source code.*
