# Pages Functions authentication

AUTH_ENABLED is a staging switch. Until it is set to the exact text true, the existing Knowledge Base remains unchanged and publicly accessible.

When enabled:
- The global middleware protects all pages and static assets using D1-backed sessions.
- /login and /signup are the public authentication screens.
- The first administrator uses BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_CODE.
- New signups remain pending until an administrator approves them.
- /admin provides approve, suspend, reactivate, promote/demote, remove and temporary-password actions.
- /api/favorites stores each signed-in colleague’s saved article IDs in D1; favorites are private to that user and cascade away if the account is deleted.
- The main navigation includes a Favorites view and a profile menu for Profile & settings, the admin dashboard, and sign-out.
- Apply migrations/0002_article_favorites.sql after 0001_auth.sql before using favorites.
- Temporary passwords force a password change at next login.
- Passwords are PBKDF2-HMAC-SHA-256 hashes and session cookies are Secure, HttpOnly and SameSite=Lax.

Self-service password-reset emails are not enabled because they require an email delivery provider. Admin-issued temporary passwords are supported and must be shared privately.

See migrations/README.md for D1 setup.

Important: old GitHub Pages and the public GitHub repository are separate public access routes. The content is not confidential until those are closed or made private and the chatbot index is moved off the public GitHub Pages URL.
