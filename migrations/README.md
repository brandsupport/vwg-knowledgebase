# VWG Knowledge Base authentication setup

Apply the migrations to the production D1 database in this order: 0001_auth.sql, 0002_article_favorites.sql, then 0003_content_management.sql, 0004_article_recycle_bin.sql and 0005_user_avatars.sql. The fifth migration adds a selectable profile avatar to each user account.

1. Cloudflare → Workers & Pages → D1 SQL database → Create database named vwg-kb-auth.
2. Open the database Console / SQL editor and run the complete contents of 0001_auth.sql.
3. Run the complete contents of 0002_article_favorites.sql in the same database to create the saved-articles table.
4. Run the complete contents of 0003_content_management.sql to create the content approval and revision tables.
5. Run 0004_article_recycle_bin.sql and 0005_user_avatars.sql in the same D1 database if they have not already been applied.
6. Cloudflare → Workers & Pages → Pages → vwg-brandsupport-kb → Settings → Bindings.
7. Add a D1 database binding with variable name DB and select vwg-kb-auth.
8. Add production environment variable BOOTSTRAP_ADMIN_EMAIL with your work email.
9. Add production secret BOOTSTRAP_ADMIN_CODE with a random value at least 24 characters long.
10. Add production variable AUTH_ENABLED with the exact text true.
11. Redeploy Pages so the binding and variables take effect.

The first registration using the configured bootstrap email and code becomes the initial active administrator. Other registrations remain pending until approved. After creating your admin account, remove BOOTSTRAP_ADMIN_CODE from production settings. BOOTSTRAP_ADMIN_EMAIL can also be removed once the first admin exists.

Do not use a preview database for production accounts. Preview deployments should use a separate database or have AUTH_ENABLED unset.

## Content approval and Tally intake

- The Knowledge Base's built-in Submit an article form creates pending requests in D1.
- Article edits are stored as pending revisions. The current published article remains unchanged until an administrator approves the revision.
- Approved new articles are published from D1 and appear in the correct category. Approved revisions are applied as per-article overrides; the original source article remains intact.
- The Pages Function /api/tally-ingest receives verified Tally payloads only when the Tally Bridge Worker sends the shared token.
- Add a production Secret named TALLY_INGEST_TOKEN to the Pages project. Use a randomly generated value of at least 32 characters. Set the exact same value as the Secret KB_INGEST_TOKEN on the Tally Bridge Worker. Never send either value in chat.
- Set the Tally Bridge Worker's plain-text variable KB_INGEST_URL to https://vwg-brandsupport-kb.pages.dev/api/tally-ingest.
- Keep TALLY_SIGNING_SECRET configured on the bridge. The bridge verifies Tally's signature before forwarding a response to the approval queue.
- Add Announcements and Hub Articles to the category question in the external Tally form. The built-in Knowledge Base form already includes both categories.
- Once these settings are deployed, new external Tally responses enter the same admin submission queue instead of being committed directly as published articles.
