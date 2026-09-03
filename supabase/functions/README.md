## Edge Function: create-trip-member

Deploy `create-trip-member` as a Supabase Edge Function. It uses the server-side `SUPABASE_SERVICE_ROLE_KEY` automatically available to Edge Functions and must never be put in frontend files.

The function verifies that the caller is an active admin of the selected trip, then creates a confirmed Auth user, profile, and trip member atomically (deleting the Auth user if DB insertion fails).
