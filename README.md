# Phalanx Data Editor

Static web editor for the Phalanx game data in Supabase — hosted here on GitHub
Pages so it can be used from any device. No build step, no secrets: it talks to
Supabase directly via the **publishable** (anon) key in `config.js`, protected by
Row-Level Security (anyone may read; only signed-in users may write).

## Use
Open the Pages URL, sign in with a Supabase Auth user (dashboard → Authentication
→ Users), pick a table, edit, Save.

## Host (GitHub Pages)
Settings → Pages → Build and deployment → **Deploy from a branch** → `main` → `/ (root)`.

## Backend
The schema, data loader, publish-back script, and the "publish to game" GitHub
Action live in the main (private) game repo under `tools/supabase/`. This repo is
only the hosted editor UI; updates are copied from the game repo's
`tools/data-editor/`.
