/**
 * VWG Knowledge Base — Tally-to-GitHub bridge.
 * This is a separate Worker: do not replace the existing AI Assistant Worker.
 *
 * Required secrets: TALLY_SIGNING_SECRET, GITHUB_TOKEN
 * Required variables: GITHUB_OWNER=brandsupport, GITHUB_REPO=vwg-knowledgebase,
 * GITHUB_BRANCH=main
 * Optional variable: TALLY_FORM_ID (recommended; use the formId from a Tally event)
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

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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

async function githubRequest(url, token, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    body: options.body,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    }
  });
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

    if (!env.TALLY_SIGNING_SECRET || !env.GITHUB_TOKEN) {
      return jsonResponse(503, { ok: false, error: "Worker secrets are not configured" });
    }
    if (!env.GITHUB_OWNER || !env.GITHUB_REPO || !env.GITHUB_BRANCH) {
      return jsonResponse(503, { ok: false, error: "GitHub repository settings are not configured" });
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

    const filePath = "data/tally_submissions/" + responseId + ".json";
    const apiUrl = "https://api.github.com/repos/" +
      encodeURIComponent(env.GITHUB_OWNER) + "/" +
      encodeURIComponent(env.GITHUB_REPO) + "/contents/" +
      filePath.split("/").map(encodeURIComponent).join("/") +
      "?ref=" + encodeURIComponent(env.GITHUB_BRANCH);

    try {
      // Idempotency: acknowledge retries without overwriting the original article.
      const existing = await githubRequest(apiUrl, env.GITHUB_TOKEN);
      if (existing.status === 200) {
        return jsonResponse(200, { ok: true, duplicate: true, responseId });
      }
      if (existing.status !== 404) {
        const detail = (await existing.text()).slice(0, 400);
        console.error("Tally bridge GitHub read/check failed", {
          status: existing.status,
          detail: detail
        });
        return jsonResponse(502, {
          ok: false, error: "Could not check GitHub submission file",
          status: existing.status, detail
        });
      }

      const content = JSON.stringify(payload, null, 2) + "\n";
      const put = await githubRequest(apiUrl, env.GITHUB_TOKEN, {
        method: "PUT",
        body: JSON.stringify({
          message: "Add Tally Knowledge Base submission " + responseId,
          content: toBase64(encoder.encode(content)),
          branch: env.GITHUB_BRANCH
        })
      });

      if (put.status === 201 || put.status === 200) {
        return jsonResponse(200, { ok: true, responseId: responseId, path: filePath });
      }

      // Cover the rare case where two copies of one submission arrive together.
      if (put.status === 409 || put.status === 422) {
        const check = await githubRequest(apiUrl, env.GITHUB_TOKEN);
        if (check.status === 200) return jsonResponse(200, { ok: true, duplicate: true, responseId });
      }

      const detail = (await put.text()).slice(0, 400);
      console.error("Tally bridge GitHub write failed", {
        status: put.status,
        detail: detail
      });
      return jsonResponse(502, {
        ok: false, error: "GitHub could not save the submission",
        status: put.status, detail
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
