# Pages Functions authentication

AUTH_ENABLED is a staging switch. Until it is set to the exact text true, the existing Knowledge Base remains unchanged and publicly accessible.

When enabled:
- The global middleware protects all pages and static assets using D1-backed sessions.
- /login and /signup are the public authentication screens.
- The first administrator uses BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_CODE.
- New signups remain pending until an administrator approves them.
- /admin provides approve, suspend, reactivate, promote/demote, remove and temporary-password actions.
- Temporary passwords force a password change at next login.
- Passwords are PBKDF2-HMAC-SHA-256 hashes and session cookies are Secure, HttpOnly and SameSite=Lax.

Self-service password-reset emails are not enabled because they require an email delivery provider. Admin-issued temporary passwords are supported and must be shared privately.

See migrations/README.md for D1 setup.

Important: old GitHub Pages and the public GitHub repository are separate public access routes. The content is not confidential until those are closed or made private and the chatbot index is moved off the public GitHub Pages URL.
