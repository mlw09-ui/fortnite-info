# fortnite-info — Fortnite cosmetics fansite

Static site (plain HTML/CSS/JS) on GitHub Pages. See `SPEC.md` for what it does.

## How it works

- `build.ps1` downloads all items and today's item shop from fortnite-api.com and writes
  `data/items.json`, `data/detail/*.json` and `data/shop.json` (generated, not in git) and adds today's prices to
  `data/prices.json` (in git: the price history only grows, never delete it).
- `.github/workflows/daily.yml` runs `build.ps1` every day at 00:15 UTC, on every push to `main`
  and by hand. It commits `data/prices.json` back and publishes the site to GitHub Pages.

## Run it locally (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:8080.

## Pages

- `index.html` — search with filters · `item.html?id=…` — item details, styles, set, 3D video
- `shop.html` — today's item shop · `langst-niet-gezien.html` — longest unseen · `favorieten.html` — favorites (localStorage)

Every page has the same header menu; on phones it is a 2×2 grid.

## Pushing changes with GitHub Desktop

The repository is managed with GitHub Desktop (no git command line needed).

1. Change files in this folder as usual.
2. In GitHub Desktop, click **Fetch origin**, then **Pull origin** if it appears. The daily build commits
   `data/prices.json` every day, so your copy is always a little behind.
3. If you ran `build.ps1` locally, `data/prices.json` shows as changed: right-click it → **Discard changes**
   before pulling. The copy on GitHub is the real price history; never commit an older one over it.
4. Type a short summary at the bottom left, click **Commit to main**, then **Push origin**.
5. The push starts the "Daily build" workflow: about 3–5 minutes later the live site is updated
   (check the **Actions** tab for a green ✓).

## Maintenance

- New Fortnite season: add one line at the bottom of `seasons.json` and commit it.
- Run the build by hand: **Actions → Daily build → Run workflow**.
- A red ✗ in the Actions tab means a build failed; the live site keeps the previous version.
