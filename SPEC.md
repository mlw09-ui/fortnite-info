# Fortnite Cosmetics Website — Spec

**Site name:** fortnite-info. It appears as the logo in the header of every page and at the end of every page title (e.g. "Vandaag in de shop — fortnite-info").

A fan website where you type the name of a Fortnite skin, pickaxe, glider or back bling and instantly see where it came from, when it was last available, and which styles (variants) it has.

**Language:** site interface in Dutch, item names and descriptions in English (fetch the API with `language=en`).

Files in this folder:
- `SPEC.md` — this file
- `seasons.json` — every Fortnite season with start dates (used to turn a date into a season)

---

## 1. Data

- Fetch all items **once at build time** from `https://fortnite-api.com/v2/cosmetics/br`.
- Keep only outfits (skins), pickaxes, gliders and back blings.
- Save them as a local cached JSON file. **Never call the API on page load.**
- Fields used: `name`, `description`, `type`, `rarity`, `series`, `set`, `images`, `introduction`, `shopHistory`, `variants`, `showcaseVideo`.
- `shopHistory` is only returned when the request adds `responseFlags=4` (`/v2/cosmetics/br?language=en&responseFlags=4`).
- `showcaseVideo` is a YouTube video ID of the in-game showcase. Not every item has one: on 23 November 2026, 3,485 of the 8,921 kept items had one (2,047 of 3,062 skins, fewer pickaxes, gliders and back blings). The shop data (`/v2/shop`, `brItems`) has the same field, but every shop item with a video already has it in the cosmetics data, so the site only reads it from `/v2/cosmetics/br`.
- Do **not** use the `added` field as a release date (it's when the item appeared in game files, often weeks before release).

### Date → season
To find which season a date belongs to: pick the **last** entry in `seasons.json` whose `start` ≤ that date.

### Date format
Always show season and date together, dates in Dutch:
`14 maart 2024 · Chapter 5 Season 2`

---

## 2. Home page

- Big search bar, centered, autofocused. Placeholder: "Zoek een skin, pickaxe, glider of back bling..."
- Filter buttons under it: **Alles / Skins / Pickaxes / Gliders / Back Blings**
- Navigation links in the header: **Home / Vandaag in de shop / Langst niet gezien / Favorieten**
- **Filter bar** under the type buttons, with three dropdowns and a "Wissen" (reset) link:
  - **Chapter:** Alle chapters / Chapter 1 … current chapter (from `seasons.json`).
  - **Seizoen:** disabled ("Kies eerst een chapter") until a chapter is chosen; then lists that chapter's seasons from `seasons.json`, including OG, Remix and mini seasons. Changing chapter resets the season.
  - **Sorteren:** Beste match (default, see live search) / Naam A → Z / Naam Z → A / Nieuwste eerst / Oudste eerst / Rarity (hoog → laag).
  - Chapter and season filter on the item's **introduction** season.
  - Filters and sorting work together with the search bar and the type buttons, and also work with an empty search bar (e.g. "all Chapter 2 Season 4 skins, A → Z").
  - Show a result count above the grid ("12 resultaten") and "Niks gevonden met deze filters." when empty.
- Each card shows a small tag with its introduction season, e.g. "C5 S2".
- **Live search:**
  - Filter results instantly on every keystroke — no Enter or search button.
  - Case-insensitive, partial matches. More letters → fewer results.
  - Sort: names that **start with** the query first, then names that **contain** it.
  - Show at most 60 results, then a note like "en 1.240 meer — typ verder om te verfijnen".
  - Lazy-load images so it stays fast.
  - Empty search bar and no filters → show a few random featured items. Empty search bar with a filter set → show all items matching the filters (still max 60 at a time).
- Results are cards in a grid: image, name, type, rarity.

---

## 3. Item page

1. Image, name, type, rarity, description
2. **Uitgekomen in:**
   - First `shopHistory` date + its season.
   - If `shopHistory` is empty: the `introduction` season with its date range from `seasons.json` (e.g. "Chapter 2 Season 1 (okt 2019 – feb 2020)").
3. **Laatst verkrijgbaar:**
   - Most recent `shopHistory` date + its season + how many days ago.
   - How many times it has been in the shop.
   - If `shopHistory` is empty: "Nooit in de item shop (battle pass / event / anders)".
4. **Laatste prijs:** see section 3c. Show e.g. "1.500 V-Bucks — los gekocht, op 3 november 2026". If no price is known: "Prijs nog onbekend". If `shopHistory` is empty: "Niet te koop (battle pass / event)".
5. **Varianten:**
   - The big image is always the item's full render (`images.featured`, else `images.icon`). Styles never replace it: the variant images from the API are small icons and look bad stretched.
   - If the item has `variants`: show every style (e.g. gold, chrome) as a row of tiles. Each tile shows the style icon at its natural size at most (never upscaled), centered on the rarity background, with the style name below.
   - Clicking a style highlights its tile and shows its icon larger (still never upscaled) in a small preview box next to the tiles. The first style is selected when the page opens.
   - Otherwise: "Geen varianten".
5b. **Bekijk in 3D:** if the item has a `showcaseVideo`, embed that YouTube video with `https://www.youtube-nocookie.com/embed/<id>` (lazy-loaded, 16:9). If it has none, hide the section.
6. **Uit dezelfde set:** if the item has a `set`, show all other items in that set (e.g. the matching pickaxe, glider and back bling) as clickable cards. Otherwise hide this section.
7. **Favoriet-knop:** a heart button to add/remove the item from favorites.
8. Header: back button ("Terug"), the logo, the same menu as the other pages (Home / Vandaag in de shop / Langst niet gezien / Favorieten) and a small search bar. When the window is too narrow for one row, the menu moves to its own row under the back button and search bar.

---

## 3b. Extra pages

### Vandaag in de shop
- Fetch the current item shop from `https://fortnite-api.com/v2/shop` at build time (same daily rebuild as the rest of the data, no manual work).
- Show only skins, pickaxes, gliders and back blings that are in today's shop, as cards linking to their item page.
- Show the shop date at the top: "Item shop van 22 november 2026".
- The Fortnite shop resets at 00:00 UTC, so the daily GitHub Action should run shortly after that (e.g. 00:15 UTC).

On "Vandaag in de shop", every card also shows its price in V-Bucks (from the shop data). Bundles show the bundle price and say "Bundel" (plus the bundle's name when it differs from the item's name). If an item is sold both separately and in a bundle, the card shows the separate price. A discounted price also shows the regular price struck through.
- Same type buttons as the home page. If the shop data is older than today (the daily build hasn't run yet), show a short notice.

## 3c. Prices

The cosmetics endpoint has **no prices**, and `shopHistory` only has dates. Prices only exist in the **daily shop** (`/v2/shop`, per entry: `finalPrice`, `regularPrice`, and whether it is a bundle). So the site builds its own price history:

- On every daily build, read today's shop and save, per item: date, price, and whether it was sold separately or only in a bundle.
- Store this in `data/prices.json` **in the repository** and let the GitHub Action commit it back, so it grows every day and is never lost.
- On the item page, show the most recent **single-item** price. If the item was only seen in a bundle, show the bundle price with "(in bundel)".
- Items that haven't been in the shop since the site went live have no price yet → "Prijs nog onbekend". This fills up over time.
- Do **not** guess prices from rarity.

### Langst niet gezien
- List of shop items sorted by how long ago they were last in the shop (longest first).
- Only items that have a `shopHistory` (battle pass items never come back, so they don't belong here).
- Each card shows: image, name, last shop date + season, and "X dagen niet gezien".
- Same filter buttons as the home page (Alles / Skins / Pickaxes / Gliders / Back Blings).
- Show 60 cards at a time with a "Toon meer" button.

### Favorieten
- A heart on every card and on the item page toggles favorite.
- Favorites are saved in the browser (localStorage, no accounts). Wrap reads/writes in try/catch so the site still works if storage is unavailable.
- The Favorieten page shows all favorited items as cards, newest favorite first; removing a heart there removes the card right away. If the browser blocks storage, show a notice that favorites disappear when the page is closed. Empty state: "Nog geen favorieten. Klik op een ♥ om er een toe te voegen."

---

## 4. Design

- Dark background (near-black / dark navy).
- Card backgrounds use rarity colors: common grey, uncommon green, rare blue, epic purple, legendary orange. If the item has a `series` (Icon, Marvel, Gaming Legends…), use its colors/background image from the API instead.
- Bold, slightly slanted headings using the free Google Font **"Luckiest Guy"**.
- Item page: big image left, info right; below that the variants (preview box + row of style tiles), then "Bekijk in 3D".
- Must work well on **mobile**. On phones the header menu is a 2×2 grid of buttons, so all four links are always visible (no sideways scrolling).
- Footer: "Fansite, niet verbonden aan Epic Games."

---

## 5. Build order

Build one step at a time. Stop after each step so it can be tested.

1. **Home page + item page** (sections 1–4, without sets and favorites yet). Nothing else.
2. **Test** with: a battle pass skin (e.g. Black Knight — should say "Nooit in de item shop"), a shop skin that returns often, and a skin with gold/chrome styles.
3. **Hosting + daily refresh:** deploy for free on **GitHub Pages** (the user has a GitHub account) and set up a GitHub Action that rebuilds the site **every day at 00:15 UTC** (just after the shop reset) so shop data stays current. The same Action saves today's prices to `data/prices.json` and commits it (section 3c). **Do this step as early as possible**: price history only starts on the day it first runs.
4. **Extras:** sets on the item page, favorites, and the "Vandaag in de shop" and "Langst niet gezien" pages (section 3b).
5. **Browse pages:** Type → Chapter → Season → items.
6. Design polish.

## 6. Maintenance

When a new Fortnite season starts, add one line at the bottom of `seasons.json`.
