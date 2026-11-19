# Tally Bridge Worker — VWG Knowledge Base

This is the separate Cloudflare Worker that receives Tally webhooks. Do not replace the AI Assistant Worker.

## New moderated flow

Tally webhook → Tally Bridge Worker (HMAC signature verification) → Pages Function /api/tally-ingest (shared secret) → D1 content_requests (pending) → administrator preview and approval → published D1 article.

The Worker no longer commits new Tally submissions directly into the live GitHub article source. This ensures new Tally submissions cannot bypass administrator approval. Existing published articles remain unchanged.

## Worker configuration

In Cloudflare → Workers & Pages → select the Tally Bridge Worker → Settings → Variables and Secrets, configure:

**Plain-text variable**
- KB_INGEST_URL = https://vwg-brandsupport-kb.pages.dev/api/tally-ingest
- TALLY_FORM_ID = the form ID from a real Tally webhook payload (recommended)

**Secrets**
- TALLY_SIGNING_SECRET = the signing secret configured in Tally
- KB_INGEST_TOKEN = a random value with at least 32 characters

In Cloudflare Pages → vwg-brandsupport-kb → Settings → Variables and Secrets → Production, add a **Secret**:

- TALLY_INGEST_TOKEN = the exact same value as the Worker secret KB_INGEST_TOKEN

Never send either token in chat or commit it to GitHub. Keep the existing D1 binding named DB on Pages.

## Connect Tally

1. Keep the current Tally form and webhook endpoint. The bridge continues to verify the Tally HMAC signature.
2. Add Announcements and Hub Articles as options in the existing Category question. Keep the other categories unchanged.
3. Keep the webhook pointed at the current Tally Bridge Worker /tally endpoint.
4. Once the new Worker secrets and Pages secret are configured and deployed, a new Tally response should be added to the administrator's New submissions queue.
5. It should not appear in the published Knowledge Base until an administrator approves it.

## Built-in Knowledge Base form

The Knowledge Base also has its own Submit an article entry in the profile menu. It includes the same core fields: title, category, tags, article content, screenshot/image links and source link. It supports the two new categories and sends all requests directly to the D1 approval queue.

## Security and reliability

- Tally webhooks must have a valid Tally-Signature HMAC-SHA256 header.
- The bridge checks the optional form ID to reject unrelated forms.
- The shared Worker-to-Pages secret protects the intake endpoint.
- Response IDs are stored uniquely, so repeated webhook deliveries do not create duplicate review requests.
- Tally images are accepted as HTTPS upload URLs; administrators can preview images before approval.
- Failed forwarding returns a non-2xx response so Tally can retry.
