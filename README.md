# tmnt-story: endless Turtle Mania dialogue on Cloudflare

A Cloudflare Worker (Workers AI, no outside API key) writes fresh speech-bubble lines for every
Turtle Mania scene pool (117 pools: cold opens, briefings, investigation, setbacks, lair talks, taunts, closes...).
Each speaker is prompted from the show bible (one voice prompt per character). Every line is checked
(3 rows x 27 chars, ASCII, no swearing, right speaker) before it is stored. A cron job adds new lines every 30 minutes.

Players run the updater; it drops the new pools into the game folder as loose files.
OpenBOR reads loose files before the .pak, and falls back to the built-in pool if a file is missing,
so the game always works offline.

## Deploy with GitHub (same way as your relay)
1. Create a GitHub repo (e.g. `tmnt-story`) and upload this folder's contents.
2. Repo Settings > Secrets and variables > Actions > add:
   - `CLOUDFLARE_API_TOKEN` (Cloudflare template "Edit Cloudflare Workers" + permission Workers AI > Read; your relay token works if it has those)
   - `CLOUDFLARE_ACCOUNT_ID`
   - `ADMIN_TOKEN` (any long random password; only you use it)
3. Actions tab > "Deploy tmnt-story" > Run workflow. Your URL appears in the Cloudflare dashboard under Workers (`https://tmnt-story.<you>.workers.dev`).
4. Seed it now instead of waiting for cron: open `https://tmnt-story.<you>.workers.dev/admin/generate?n=12&key=ADMIN_TOKEN` in a browser and refresh it about 10 times (12 pools each; ~117 pools total). Or just wait: cron fills everything in about 15 hours.
5. Open `/health`, it shows the pack version. `/admin/stats?key=ADMIN_TOKEN` shows lines per pool.

## Player side
- Windows: put `Update_Turtle_Mania.bat` + `Update_Turtle_Mania.ps1` next to the game exe, edit the URL line at the top of the .ps1, double-click before playing.
- Python (any OS): `python tm_update.py <game folder> --url https://tmnt-story.<you>.workers.dev`
- Delete the `data` folder next to the exe to go back to the built-in story. Android: needs the engine to fetch it itself (not built yet).

## Endpoints
- `GET /pack?since=N` public: pools changed after version N (cached 5 min)
- `GET /health` public
- `GET /admin/generate?n=6&pools=cold_mall,taunt_slash`, `GET /admin/stats`, `POST /admin/note` (season flavour note added to every prompt), all need `Authorization: Bearer ADMIN_TOKEN`

## Notes
- Model: `@cf/meta/llama-3.1-8b-instruct` (change `MODEL` in src/index.js). Free-tier AI allowance is enough for the default cron.
- `src/data.json` is built from the game's pools + show bible by `mk_worker_data.py`; re-run it after the game gets new pools/stages.
- Local test: `npm test`.
