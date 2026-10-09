# AI chatbot API (Cloudflare Workers)

This Worker retrieves matching entries from the generated `chatbot-index.json` and asks Workers AI to answer from those excerpts.

## Deploy
1. Create a Cloudflare account and enable Workers AI.
2. Install Wrangler and authenticate: `npm install --save-dev wrangler`, then `npx wrangler login`.
3. In `wrangler.toml`, replace both placeholder origins with the exact deployed knowledgebase origin. The index URL must point to the deployed `chatbot-index.json`.
4. From this directory, deploy with `npx wrangler deploy`.
5. Configure a Cloudflare rate-limiting rule for the Worker (for example, limit POST requests per IP over a short window) and review Workers AI account limits/billing before broad use.
6. Configure the frontend `CHAT_API_URL` to the deployed Worker endpoint. Until this is set, the current interface continues local article matching.

## Safety and limitations
- No AI API key is embedded in the public site; Workers AI is accessed through the Worker binding.
- CORS restricts normal browser use to the configured origin, but CORS is not authentication; non-browser callers can spoof Origin. Add Cloudflare rate limiting and usage limits.
- Questions are limited to 600 characters; retrieved context is bounded and only matching indexed articles are sent to the model.
- Answers can still be wrong. Display source article links and ask users to verify important procedures there.
- Never put passwords, tokens, customer data, or other secrets in knowledgebase articles.
