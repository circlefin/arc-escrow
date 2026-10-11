# Security Policy

## Reporting a Vulnerability
Please do not file public issues on Github for security vulnerabilities. All security vulnerabilities should be reported to Circle privately, through Circle's [Bug Bounty Program](https://hackerone.com/circle-bbp). Please read through the program policy before submitting a report.

## Deployment Security Considerations

This sample application is designed for **local and testnet development only** and ships with several security trade-offs that must be addressed before any deployment with real user data:

### Row Level Security (RLS) Disabled

Migration [`20241112173214_remove_rsl_policies_for_development.sql`](supabase/migrations/20241112173214_remove_rsl_policies_for_development.sql) explicitly disables RLS and drops all associated policies on the following core tables:

- `profiles`
- `wallets`
- `transactions`
- `escrow_agreements`
- `dispute_resolutions`

This was done to simplify local development. The original RLS policies are preserved in [`20241112172956_create_initial_schema.sql`](supabase/migrations/20241112172956_create_initial_schema.sql).

**The Supabase anon key is exposed to the browser by design** (via `NEXT_PUBLIC_SUPABASE_ANON_KEY`). With RLS disabled, this key grants unrestricted read/write access to all rows in the tables above via the PostgREST API, independent of any application-level checks.

### Before Deploying to Production

1. **Re-enable RLS** on all five tables and recreate policies that enforce per-user access control, mirroring the original policies in the initial schema migration. The application's server-side routes currently rely on RLS being disabled for certain operations (e.g., Circle webhook handlers update rows without a user session); those routes will need a **service-role key** or database functions with `SECURITY DEFINER` to maintain functionality.

2. **Audit all application queries** to ensure they operate within the scope of the new RLS policies. The current code uses the anon key for both browser and server clients; introduce a `SUPABASE_SERVICE_ROLE_KEY` for privileged server-side operations that must bypass RLS.

3. **Restrict the anon key** at the network level (Supabase API settings) or replace direct PostgREST access with a dedicated backend that enforces authorization.

Deploying this reference implementation without these changes would allow any authenticated (or unauthenticated) client to read or modify data belonging to other users.