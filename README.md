# UploadNPlay

Upload HTML5 games as ZIP files, extract them in the browser, publish their files to Supabase Storage, and play them from dedicated game pages.

## Local setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Put the Supabase project URL and public anon key into the two Vite variables.
5. In Supabase SQL Editor, run `supabase/schema.sql`, then `supabase/storage.sql`, then `supabase/storage-policies.sql`.
6. Enable Email / Magic Link authentication in Supabase Auth.
7. Run `npm run dev`.

## Upload format

A game ZIP must contain an `index.html` either at the root or inside a folder. Files are extracted client-side and uploaded under a unique game ID, preserving relative asset paths.

## Security

The player iframe uses `sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"`. Games are served from Supabase Storage rather than the UploadNPlay application origin. Never put a Supabase service-role key in frontend code; only the public anon key belongs in the browser.
