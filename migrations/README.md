# VWG Knowledge Base authentication setup

Apply 0001_auth.sql once to the production D1 database before enabling authentication.

1. Cloudflare → Workers & Pages → D1 SQL database → Create database named vwg-kb-auth.
2. Open the database Console / SQL editor and run the complete contents of 0001_auth.sql.
3. Cloudflare → Workers & Pages → Pages → vwg-brandsupport-kb → Settings → Bindings.
4. Add a D1 database binding with variable name DB and select vwg-kb-auth.
5. Add production environment variable BOOTSTRAP_ADMIN_EMAIL with your work email.
6. Add production secret BOOTSTRAP_ADMIN_CODE with a random value at least 24 characters long.
7. Add production variable AUTH_ENABLED with the exact text true.
8. Redeploy Pages so the binding and variables take effect.

The first registration using the configured bootstrap email and code becomes the initial active administrator. Other registrations remain pending until approved. After creating your admin account, remove BOOTSTRAP_ADMIN_CODE from production settings. BOOTSTRAP_ADMIN_EMAIL can also be removed once the first admin exists.

Do not use a preview database for production accounts. Preview deployments should use a separate database or have AUTH_ENABLED unset.
