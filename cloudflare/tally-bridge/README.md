# Tally Bridge Worker — VWG Knowledge Base

This is a **separate** Cloudflare Worker for Tally-to-GitHub intake. Do not replace the existing AI Assistant Worker.

## Flow

Tally webhook → this Worker → data/tally_submissions/<responseId>.json → existing GitHub Actions build/deploy → Knowledge Base.

The Worker preserves raw Tally JSON. The repository's existing import_tally.py maps labelled fields and image upload URLs, so the current article processing stays unchanged.

## Deploy in Cloudflare Dashboard

1. Open **Workers & Pages** and choose **Create** → **Worker**.
2. Name it vwg-tally-bridge and create/deploy the starter.
3. Open the Worker editor and replace its code with worker.js from this folder. Save and deploy.
4. Open **Settings → Variables and Secrets** and add these plain-text variables:
   - GITHUB_OWNER = brandsupport
   - GITHUB_REPO = vwg-knowledgebase
   - GITHUB_BRANCH = main
   - TALLY_FORM_ID = the actual form ID from a Tally webhook payload (recommended)
5. Add these as **Secrets**, not plain text:
   - GITHUB_TOKEN = a GitHub fine-grained personal access token limited to brandsupport/vwg-knowledgebase, with **Contents: Read and write** permission.
   - TALLY_SIGNING_SECRET = the signing secret configured for the Tally webhook.
6. Deploy again after setting variables/secrets.
7. Test https://<your-worker>.workers.dev/health in a browser. It should return {"ok":true,"service":"vwg-tally-bridge"}.

## Connect Tally

1. Open the published VWG Knowledgebase — Submit an Article form in Tally.
2. Go to **Integrations → Webhooks** and create a webhook for form responses.
3. Use https://<your-worker>.workers.dev/tally as the endpoint.
4. Enable a signing secret and use the same value as TALLY_SIGNING_SECRET.
5. No custom HTTP headers are needed.
6. Keep the old Zap active only if it still works; once this bridge passes all tests, pause/disable the old Zap to avoid duplicate submissions.

## Security and reliability

- Requires the Tally-Signature HMAC SHA-256 signature.
- Optionally set TALLY_FORM_ID to reject webhooks from other forms.
- GitHub token is stored as a Cloudflare Secret and never returned by the Worker.
- Response IDs map to deterministic filenames; repeat deliveries are acknowledged without overwriting the original.
- Failures return a non-2xx response so Tally can retry.
- Image fields are preserved as Tally upload URLs. The existing importer accepts HTTPS image references; test a real image upload to confirm it remains accessible when the article is viewed.
- Only POST requests to /, /tally, and /webhook are accepted, plus GET /health.

## GitHub token

Create a fine-grained token under GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**. Restrict repository access to vwg-knowledgebase; grant only **Contents: Read and write**. Never paste the token into source code or chat.

## Testing before retiring Zapier

1. Health check returns HTTP 200.
2. Submit a text-only test article and confirm a new JSON file appears in data/tally_submissions/.
3. Confirm GitHub Actions succeeds and the article appears on the site.
4. Submit an article with an image and verify it renders.
5. Replay the same webhook and confirm it does not overwrite/create a second article.
6. Test invalid signatures are rejected.
