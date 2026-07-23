# Terminus database

The Terminus backend is a dedicated Supabase (Postgres) project. This directory
holds the SQL that defines the operational data plane.

## Migrations

- `migrations/0001_core_domain.sql` — the full V1 core domain: identity and
  authorization (organizations, roles, permissions, memberships), the domain
  records (missions, objectives, comments, tags, files, links), operations
  (modules, protocols, approvals, agents, signals), and the immutable event
  backbone (events, audit log, outbox) with RLS on every exposed table and the
  `mission_log` view the UI reads.

## Applying it

This project is managed outside the Supabase CLI link, so apply the migration
through the dashboard:

1. Open the project → **SQL Editor** → **New query**.
2. Paste the entire contents of `migrations/0001_core_domain.sql`.
3. **Run**. It executes as one transaction; a clean run creates all tables,
   policies, functions, triggers, seed roles/permissions, and the
   `mission_log` view.

To confirm: **Table Editor** should list `organizations`, `missions`,
`objectives`, `approval_requests`, `events`, `audit_log`, and the rest, all
with RLS enabled.

## Notes

- Requires the `pgvector` and `pgcrypto` extensions (created into the
  `extensions` schema by the migration — both are available on Supabase).
- RLS is deny-by-default. Reads and writes require an authenticated user whose
  membership role grants the relevant permission, so the app needs Supabase
  Auth sign-in before data appears — an anonymous client sees nothing. Wiring
  auth + the first organization is the next milestone after this migration.
- The `outbox` table intentionally has **no** client policy; it is a private
  delivery concern for a service-role worker only.
