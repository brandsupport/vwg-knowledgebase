/**
 * VWG Knowledge Base — Tally-to-GitHub bridge.
 * This is a separate Worker: do not replace the existing AI Assistant Worker.
 *
 * Required secrets: TALLY_SIGNING_SECRET, KB_INGEST_TOKEN
 * Required variable: KB_INGEST_URL=https://vwg-brandsupport-kb.pages.dev/api/tally-ingest
 * Optional variable: TALLY_FORM_ID (recommended; use the formId from a Tally event)
 *
 * Verified Tally responses are forwarded to Pages Functions and enter the
 * administrator approval queue. This Worker no longer commits submissions
 * directly into the published knowledge-base source.
 */
const encoder = new TextEncoder();
const MAX_BODY_BYTES = 2000000;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyTallySignature(payload, received, secret) {
  if (!received || !secret) return false;
  // Matches Tally's documented example: HMAC-SHA256 of JSON.stringify(parsedPayload).
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)))
  );
  return constantTimeEqual(received.trim(), toBase64(signatureBytes));
}

function safeResponseId(payload) {
  const candidate =
    (payload && payload.data && payload.data.responseId) ||
    (payload && payload.data && payload.data.submissionId) ||
    payload.response_id ||
    payload.eventId;
  if (typeof candidate !== "string" || !candidate.trim()) return null;
  const safe = candidate.trim().replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 100);
  return safe || null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(200, { ok: true, service: "vwg-tally-bridge" });
    }
    if (request.method !== "POST" || !["/", "/tally", "/webhook"].includes(url.pathname)) {
      return jsonResponse(404, { ok: false, error: "Not found" });
    }

    if (!env.TALLY_SIGNING_SECRET || !env.KB_INGEST_TOKEN || !env.KB_INGEST_URL) {
      return jsonResponse(503, { ok: false, error: "Tally approval intake settings are not configured" });
    }
    let ingestUrl;
    try {
      ingestUrl = new URL(env.KB_INGEST_URL);
      if (ingestUrl.protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      return jsonResponse(503, { ok: false, error: "KB_INGEST_URL must be a valid HTTPS endpoint" });
    }

    const raw = await request.text();
    if (encoder.encode(raw).byteLength > MAX_BODY_BYTES) {
      return jsonResponse(413, { ok: false, error: "Payload too large" });
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON" });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return jsonResponse(400, { ok: false, error: "Expected a JSON object" });
    }

    let verified = false;
    try {
      verified = await verifyTallySignature(
        payload,
        request.headers.get("Tally-Signature"),
        env.TALLY_SIGNING_SECRET
      );
    } catch {
      verified = false;
    }
    if (!verified) return jsonResponse(401, { ok: false, error: "Invalid Tally signature" });

    if (payload.eventType && payload.eventType !== "FORM_RESPONSE") {
      return jsonResponse(200, { ok: true, ignored: "Unsupported event type" });
    }
    if (env.TALLY_FORM_ID && (!payload.data || payload.data.formId !== env.TALLY_FORM_ID)) {
      return jsonResponse(403, { ok: false, error: "Unexpected Tally form" });
    }

    const responseId = safeResponseId(payload);
    if (!responseId) {
      return jsonResponse(400, { ok: false, error: "Submission response ID is missing" });
    }

    try {
      const intake = await fetch(ingestUrl.href, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.KB_INGEST_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: raw
      });
      const detail = await intake.text();
      if (!intake.ok) {
        console.error("Tally approval intake failed", {
          status: intake.status,
          responseId: responseId,
          detail: detail.slice(0, 400)
        });
        return jsonResponse(502, {
          ok: false,
          error: "Could not add the Tally response to the approval queue",
          status: intake.status
        });
      }
      let result = {};
      try { result = JSON.parse(detail); } catch {}
      return jsonResponse(200, {
        ok: true,
        responseId: responseId,
        status: result.status || "pending",
        requestId: result.requestId || null
      });
    } catch (error) {
      // Non-2xx lets Tally's retry schedule try again. Log a safe diagnostic in Cloudflare.
      console.error("Tally bridge request failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      return jsonResponse(502, { ok: false, error: "Temporary bridge error; retry delivery" });
    }
  }
};
