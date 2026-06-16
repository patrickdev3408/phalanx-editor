# Phalanx Data Editor

A single-file static web editor for the Phalanx game data in Supabase — hosted on
GitHub Pages (the `phalanx-editor` public repo), usable from any device.

`index.html` is **the whole app**: it's the friend's polished editor UI (from PR #2,
~1550 lines, vanilla JS — per-table views, search, tier filters, dirty-change
tracking, dropdowns from real enums) with its data layer **ported from the
original FastAPI backend to supabase-js**. No build step, no server, no secrets
beyond the **publishable** (anon) key, which is public by design — Row-Level
Security gates writes (anyone reads; only signed-in users write).

## How the port works
The bottom `<script>` in `index.html` overrides the FastAPI seams the original
UI used, leaving the UI + state model untouched:
- `boot` → Supabase Auth gate, then `loadFromSupabase()` (queries the 7 tables,
  rebuilds the exact payload `ingest()` expects + builds the enums client-side).
- `doSave`/`openSaveDialog` → upsert the dirty records straight to Supabase
  (extracted columns mirror `tools/supabase/load_supabase.py`).
- `doRefresh` → reload from Supabase. `renderArt` → a note (art lives in the game
  repo, not Supabase). The PR/branch header chrome is dropped.

## Use
Open the Pages URL, sign in with a Supabase Auth user (dashboard → Authentication
→ Users → Add user, Auto Confirm), edit, **Save to Supabase**. Then run the
**Publish data from Supabase** GitHub Action (in the game repo) to write the edits
into `data/*.json` for the game.

## Backend / publish
Schema, loader, publish-back script, and the publish Action live in the main
(private) game repo under `tools/supabase/`. This `tools/data-editor/` folder is
the canonical copy of the editor; it's mirrored into the public `phalanx-editor`
repo (which GitHub Pages serves). When `index.html` changes here, copy it there
and push.
