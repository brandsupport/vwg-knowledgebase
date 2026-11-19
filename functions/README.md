# Pages Functions authentication

AUTH_ENABLED is a staging switch. Until it is set to the exact text true, the existing Knowledge Base remains unchanged and publicly accessible.

When enabled:
- The global middleware protects all pages and static assets using D1-backed sessions.
- /login and /signup are the public authentication screens.
- Every self-service registration is a pending member account and requires manual administrator approval. Administrator privileges are granted separately from the public sign-up form.
- New signups remain pending until an administrator approves them.
- /admin provides approve, suspend, reactivate, promote/demote, remove and temporary-password actions.
- /api/favorites stores each signed-in colleague’s saved article IDs in D1; favorites are private to that user and cascade away if the account is deleted.
- /api/content stores new submissions and edit suggestions as pending D1 requests, and serves only approved D1 additions and article overrides.
- /api/content-admin/* is administrator-only and provides preview/review queues, approval/rejection, published contributions, and approved before/after revision history.
- /api/admin/notifications stores per-administrator alerts for new registrations, article submissions, suggested revisions and password recovery requests.
- /api/admin/password-requests lets administrators issue a one-time temporary password; the user must change it at next sign-in.
- /forgot-password creates a private recovery request and does not reveal whether an email address has an active account.
- /api/tally-ingest is a token-protected intake endpoint for the separately HMAC-verified Tally Bridge Worker; it queues responses rather than publishing them.
- The main navigation includes a Favorites view and a profile menu for Profile & settings, the admin dashboard, and sign-out.
- Apply migrations/0002_article_favorites.sql after 0001_auth.sql before using favorites.
- Temporary passwords force a password change at next login.
- Passwords are PBKDF2-HMAC-SHA-256 hashes and session cookies are Secure, HttpOnly and SameSite=Lax.

Password recovery is administrator-mediated because no email delivery provider is configured. Colleagues submit a request on /forgot-password; administrators issue a one-time temporary password in the Admin Dashboard and share it privately.

Apply migrations/0003_content_management.sql through 0006_admin_notifications_and_recovery.sql after the authentication and favorites migrations. See migrations/README.md and cloudflare/tally-bridge/README.md for the full D1 and Tally setup.

Important: old GitHub Pages and the public GitHub repository are separate public access routes. The content is not confidential until those are closed or made private and the chatbot index is moved off the public GitHub Pages URL.
