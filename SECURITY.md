# Security

## Reporting a problem

If you find a security issue, please report it privately through GitHub: **Security → Report a vulnerability** on this repository. Don't open a public issue. You'll get a reply as soon as possible.

## How the site is protected

- **No accounts, no secrets in the browser.** The site only reads public game data. The Supabase key in the code is the public, read-only *publishable* key.
- **Database:** every table has row-level security and allows reads only. Anonymous visitors can read just the newest catalogue release. The storage bucket is public for reading images, and nobody can upload, overwrite or delete files without the service key.
- **Website:** a strict Content Security Policy, `X-Frame-Options: DENY`, HSTS, `nosniff`, a tight Permissions-Policy and a same-origin opener policy (`next.config.ts`). Share links and saved recipes are treated as untrusted input and parsed strictly (`lib/forge-slots.ts`).
- **Vercel Firewall:** automatic DDoS protection, a rate limit of 600 requests per minute per IP (429 after that), and Bot Protection.
- **Repository:** secret scanning with push protection, CodeQL scanning on every change, Dependabot updates, and pinned GitHub Actions.

## Publishing new game data

New catalogue releases are inserted with the database owner role. If `pg_net` is needed to fetch the file, create it only for that job, revoke it from the public roles straight away, and drop it afterwards:

```sql
create extension if not exists pg_net with schema extensions;
revoke usage on schema net from anon, authenticated, public;
-- fetch and insert the release
drop extension pg_net;
```
