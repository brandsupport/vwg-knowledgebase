# VWG Brand Support Knowledgebase — Source

A static, single-page app: no server, no build tooling beyond Python. New
articles can come in two ways — pick one, or run both at once:

- **Live pipeline:** a Tally form writes straight to a Google Sheet; the
  site pulls approved rows from that sheet automatically on every build.
- **Manual pipeline:** a Microsoft Form writes to an Excel file you keep in
  the repo; you push the updated file when you're ready to publish a batch.

Either way, a GitHub Action rebuilds and redeploys the site automatically
whenever something relevant changes.

## Structure

```
├── build.py                   # combines everything below into dist/index.html
├── import_gsheet.py            # pulls approved rows from the live Google Sheet
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
│   ├── gsheet_config.json       # which Google Sheet to pull from (live pipeline)
│   ├── articles.xlsx            # Microsoft Forms responses land here (manual pipeline)
│   ├── article_images/          # screenshots for the base articles (referenced from site_data.json)
│   ├── images/                  # screenshots referenced by filename from either sheet
│   └── notion_pages_raw.json    # original Notion pulls, for reference
└── dist/
    └── index.html                # OUTPUT — the deployable file (don't hand-edit)
```

Both pipelines produce the same article shape and go through the same
Approved/Pending/Rejected gate — nothing is ever published without that
Status column being set to `Approved`.

---

## Live pipeline: Tally → Google Sheets → site

**Already set up and live right now:**
- Tally form: **https://tally.so/r/1AqROO**
- Google Sheet it writes to: the one at the `spreadsheet_id` in
  `data/gsheet_config.json`

1. **Someone submits the Tally form.** Tally's own Google Sheets
   integration appends a new row to the sheet automatically — no code
   involved.
2. **You review it.** Open the sheet, read the new row, and set its
   **Status** cell (column J) to `Approved`, `Pending`, or `Rejected`. This
   is the only cell you ever edit by hand.
3. **Push/trigger a build.** Because the sheet is pulled live over the
   network at build time, the GitHub Action needs to actually run — either
   wait for your next push, or trigger it manually from the repo's
   **Actions** tab → this workflow → **Run workflow**. (If you want it to
   re-check the sheet on a timer instead of only on push, see "Polling on a
   schedule" below.)
4. **Only `Approved` rows get published.** `Pending` and `Rejected` rows
   are read but skipped.

### One setting you need to check

The sheet is read via its public CSV export link, which means it must be
shared as **Anyone with the link: Viewer** (Share → General access, in
Google Sheets). Nothing else needs to be public — just this one sheet, and
only for reading. If that's not set, the build logs a clear warning and
simply skips the live pipeline for that run (it won't fail the whole
build).

### Editing the form or the sheet

- **Add/remove a question in Tally:** just edit the form in Tally's
  editor. As long as the column header it creates matches one of the
  recognised names (see `article_formatting.py` → `ALIASES`), it'll be
  picked up automatically. Unrecognised extra columns are simply ignored.
- **Reference material already in the sheet:** columns L and N hold a
  copy of the valid category names and the body-formatting cheat sheet, for
  whoever's reviewing. They're off to the side specifically so new
  submission rows (which only ever touch columns A–J) can't overwrite them.

### Polling on a schedule

The Action is set to re-check the live sheet **every 30 minutes**, even
with no code changes pushed, via this line in
`.github/workflows/deploy.yml`:

```yaml
schedule:
  - cron: "*/30 * * * *"   # every 30 minutes
```

So a row marked `Approved` in the sheet goes live within 30 minutes without
you needing to push anything. You can still trigger a build immediately
instead of waiting — repo's **Actions** tab → this workflow →
**Run workflow**.

A few things worth knowing about GitHub's scheduler:
- Times aren't exact. GitHub documents scheduled runs as "best effort" and
  they can be delayed, especially at the top of the hour when load is
  highest — `*/30` shares the same :00/:30 slots as half the internet's
  cron jobs. If you want more reliably-spaced runs, offset it slightly,
  e.g. `"7,37 * * * *"`.
- **Scheduled runs pause automatically after 60 days with no commits to
  the repo.** Pushing anything re-arms it. If the schedule seems to have
  stopped, that's almost always why — just push a small change (or
  re-enable it from the Actions tab) to restart it.
- Change the interval any time by editing that one `cron:` line — e.g.
  `"*/15 * * * *"` for every 15 minutes, or `"0 * * * *"` for hourly.

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
(unrecognised category, missing Title/Body, a sheet that isn't shared
publicly, duplicate IDs), then writes `dist/index.html`.

## Data model

`site_data.json` has `categories` (`{id, title, short, icon}`) and
`articles` (`{id, cat, title, tags, html, images, source, source_url}`; `images`
are file paths under `data/`, inlined into the page at build time, and
`search_text` is generated at build time). `import_excel.py` and `import_gsheet.py` both produce
objects in the same shape (`source: "excel"` or `"gsheet"`, ids offset so
neither can collide with the base data or each other), and `build.py`
merges all three lists at build time — `data/site_data.json` itself is
never modified by either import.

## Editing content directly (bypassing both forms)

- **Base articles/categories** → edit `data/site_data.json`, rebuild.
- **Styling, layout, behaviour** → edit `src/template.html`, rebuild.
- **A one-off article** → type it straight into a row in `data/articles.xlsx`
  (or the Google Sheet) and set Status to Approved; it doesn't have to come
  through either form.

## Deploying

**First time:** push this repo to GitHub, then in **Settings → Pages** set
Source to **GitHub Actions** (not "Deploy from a branch" — the workflow
handles that).

**Manually, without the Action:** run `python3 build.py` and upload/commit
`dist/index.html` yourself — it's a single static file, so it can be hosted
anywhere that serves static files.


## Feature documentation

See **[FEATURES.md](FEATURES.md)** for the complete feature guide, including the knowledgebase interface, article publishing and formatting, search and filtering, accessibility/responsive behaviour, the chatbot index and Worker integration, and the automated deployment pipeline.
