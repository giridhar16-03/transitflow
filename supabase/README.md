Supabase setup for Transitflow

1) Create Supabase Project
   - Go to https://app.supabase.com and create a new project

2) Enable Google Auth
   - Dashboard -> Authentication -> Providers -> Google
   - Provide Google OAuth client ID/secret and add redirect URLs (e.g. http://localhost:5173)

3) Get API keys
   - Project Settings -> API
   - Copy `URL` and `anon key` for client usage
   - Copy `service_role` key and keep it server-only

4) Deploy SQL
   - Run the SQL from `supabase/sql/schema.sql` and `supabase/sql/policies.sql` in the SQL editor

5) Edge Function (optional)
   - Use `supabase/edge/generate_secret.js` as an example to mint per-driver secrets using the `service_role` key

6) Env vars for this project
   - Create a `.env` file at project root with:
     VITE_SUPABASE_URL=your-supabase-url
     VITE_SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (server only)

7) Client usage
   - See `src/lib/supabaseClient.js`, `src/hooks/useDriverLocation.js`, and `src/hooks/usePublicDrivers.js` for examples.
