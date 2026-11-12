# ShotQuiver

**Archery Scoring & Practice Tracking.** Every arrow counts.

A mobile-first, local-first archery practice PWA built with Svelte 5, Vite, TypeScript, plain CSS, IndexedDB, and `vite-plugin-pwa`. No backend, accounts, analytics, remote fonts, or runtime network dependencies.

## Run

Previously named Trueflight. The existing IndexedDB database name and v1 backup format identifier are retained so saved sessions and older JSON backups continue to work. New exports use the ShotQuiver filename.

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

```sh
npm run check
npm test
npm run build
npm run preview
```

Use the production preview to test offline support; the service worker is intentionally disabled during development. Open the app online once and wait for **Ready for offline practice**, then reload offline. Install through the browser menu (or the in-app Install button when supported). On iOS, use Safari → Share → Add to Home Screen. Deployed PWAs require HTTPS; localhost is supported for development. Deploy `dist/` to any static HTTPS host.

## GitHub Pages

Repository: https://github.com/markamartinezdev/shotquiver

The app is configured for https://shotquiver.com/. In repository **Settings → Pages**, set **Source** to **GitHub Actions** and **Custom domain** to `shotquiver.com`. Domain verification alone does not connect the website. Each push to `main` runs type checks, tests, and a production build before deploying. The workflow can also be run manually from the Actions tab.

Local development and production use the root path `/`. The service worker, offline navigation fallback, icons, and assets use this root path. To return to the default GitHub project URL, change Vite's `base` to `/shotquiver/` and the service worker's `navigateFallback` to `/shotquiver/index.html`.

At Namecheap, replace the default parking/redirect records for `@` and `www`. Create four `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`. Set the `www` CNAME to `markamartinezdev.github.io`. Keep the GitHub verification TXT record. Once DNS and GitHub's certificate are ready, enable **Enforce HTTPS** in Pages settings.

Scores are stored in each browser, not on GitHub. To move scores from localhost to the hosted site, export JSON on localhost and import it on the hosted site.

## Implemented

- Automatic light/dark appearance follows the device setting, including live changes. Dark mode uses charcoal/teal surfaces and mint accents; official target colors remain unchanged.

- NFAA Indoor 300: 12 ends × 5 arrows at 20 yards, with selectable 40 cm single-spot or five-spot faces.
- NFAA Field: full 28-target rounds or 14-target practice units, four arrows per target; standard and Professional scoring options. Adult course layouts include the fan and three walk-ups. Choose each unscored target's layout to match your course; unused layouts swap within the unit to preserve its composition. Scored layouts are locked.
- Custom round builder: name, 1–100 ends, 1–12 arrows per end, distance/unit, 10–200 cm face, Indoor/Field scoring patterns or 1–10 equal-width scoring rings with optional X tracking. Custom settings are saved with the session and offered in the dropdown for reuse while that session remains in history.
- Round-specific score buttons, running totals, X counts, averages including misses, and a complete scorecard with the correct arrow columns and maximum score. Field scorecards include distances and face sizes.
- Button entry or touch/pointer target placement. Select arrow slots to edit; drag plotted markers or use 1 mm adjustment buttons. Closely grouped arrows can share positions. Button-only arrows have no invented coordinates.
- Shaft diameter setting (default 6 mm) determines higher-value line contact. Changing it recalculates all plotted arrows in that session. Numbered touch markers are enlarged for usability and do not represent shaft diameter.
- Immediate autosave after every edit, explicit end completion, previous-end editing, undo during the current opened session (100 actions), session notes, history, and deletion.
- Versioned JSON export/import with size and structure validation. Import adds unseen session IDs atomically and never replaces local IDs. Export includes incomplete sessions, notes, and coordinates.
- Offline app shell, install icons, and an update prompt that waits for pending saves before reloading.
- A Target Face selector offers compatible layouts: Indoor single/five-spot; Field single/four full faces; custom layouts matching the selected scoring pattern. Changing the face after any arrows are recorded starts a new session and preserves the previous scorecard in History. The chosen face is stored in IndexedDB and exported in backups; older backups default to single-spot.

The Indoor five-spot layout has five 16 cm circles on a 40 cm face. Each contains 4/8/12/16 cm rings, scored X/5/4/4, with X worth 5. Multiple arrows may land in any spot; gaps are misses even when the paper is blue. Field multiple-face layouts retain the prescribed individual face diameter for the course station; they do not crop away the outer scoring zones. Plot positions use normalized board coordinates, and shaft contact and 1 mm adjustments use the physical board scale. Custom five-spot patterns scale with the configured board diameter and are labeled accordingly.

## Rules verified before implementation

Reviewed November 11, 2026 against the [official NFAA Constitution & By-Laws, Article VI.E](https://nfaausa.com/about/constitution/official-nfaa-rounds) and [NFAA Range Guidelines & Round Summaries, section I.D](https://nfaausa.com/files/nfaa-range-guidelines-and-round-summaries-160223230435.pdf).

The standard unit is 60 arrows in three games of four five-arrow ends. The single-spot face is dull blue with a white 8 cm 5-ring and a 4 cm X-ring. The 4/3/2/1 zone diameters are 16/24/32/40 cm. An X is five points and a separate X count; it is not six points. A shaft touching a boundary scores the higher value. The app uses the arrow center and configured shaft radius to apply that rule, including the X boundary and outer edge. Five-spot scoring was checked against Article VI.E.5.10 on November 12, 2026. The rules guide documents the four-minute official end limit and halfway target swap; the app is a practice journal and does not enforce tournament timing, shoot-offs, or judging procedures. Vegas substitute faces require a different arrow/scoring format and are not included, nor are age-specific distances.

Rechecked five-spot scoring on November 12, 2026 against Article VI.E.5.10 and the [2026 Indoor Nationals rules](https://nfaausa.com/events/national-tournaments/nfaa-indoor-national-championships-2026): the implemented X/5/4/Miss values and repeated arrows on one spot match standard scoring. The [2026 Indoor Sectionals rules](https://nfaausa.com/events/national-tournaments/nfaa-indoor-sectional-championships-and-indoor-national-series-2026) additionally require a separate inside-out X count for tie-breaking on both face types. An inside-out X requires the entire shaft to be inside the X ring without touching it. That separate count is not implemented; the app currently tracks standard Xs only. Nationals uses inside-out scoring during a later shoot-off stage rather than ordinary round scoring.

## Structure

Field rules were verified November 12, 2026 against [NFAA Article VI.A](https://nfaausa.com/about/constitution/official-nfaa-rounds). Standard scoring is 5 for the black center, 4 for the white middle, and 3 for the outer black. X is 5 in standard scoring and 6 in Professional scoring, with a separate X count. Maximums are 560/672 for full standard/Pro rounds and 280/336 for practice units. Faces measure 20/35/50/65 cm; boundary diameters are 10/20/40/60/80/100% of face size. Shaft-contact scoring and 1 mm position nudges scale to each target's actual face size. Youth/Cub distances and alternate Expert scoring are not included.

Custom round configurations are immutable session snapshots, not executable rules. They survive reload and JSON export/import without a global registry entry. Equal-width rings are a personal practice pattern, not a claim of a governing body's target specification. Existing Indoor v1 backups remain supported; Field backups also validate the course-order permutation.

```text
src/lib/domain/types.ts       Shared round/session/arrow contracts
src/lib/domain/rounds.ts      Round registry, target geometry, position strategy
src/lib/domain/scoring.ts     Pure scoring, immutable arrow edits, statistics
src/lib/data/storage.ts      Native IndexedDB repository and atomic merges
src/lib/data/backup.ts        Versioned backup validation and serialization
src/lib/components/Target.svelte  SVG face and pointer interactions
src/lib/components/Icon.svelte    Small inline icon set
src/App.svelte               Session orchestration and application UI
src/app.css                  Responsive plain CSS
```

To add a round, register a `RoundDefinition`, provide its scoring strategy, allowed scores, target geometry, end/arrow counts, and optional station metadata. `sessionRound` resolves built-in or custom definitions; `endRound` resolves the actual face/distance for a particular Field target. Numeric score labels and an arrow-index argument accommodate future Animal strategies. Hunter and Animal remain disabled pending their own rules and UI. `CustomBuilder.svelte` owns the custom form; all scoring and configuration validation remain in the domain layer.

Data stays in the current browser profile and origin. Clearing site data removes it. Export backups for transfer or safekeeping. Failed saves show a persistent warning with retry and export actions. Undo is in-memory; scores and notes persist across reloads. Concurrent editing of one session in multiple tabs is not supported.

Application icons can be regenerated on Windows with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-icons.ps1`.

## Verification

- `npm run check`: no errors or warnings.
- `npm test`: 54 tests pass for Indoor/Field/custom round totals, single/multiple-face geometry, gap misses, shaft contact, immutable editing, custom settings and course-order validation, backup round-trips, and IndexedDB updates/merges/deletion.
- `npm run build`: builds the static app, manifest, and precached service worker.
- Chromium browser checks: a full 300/60-X round; previous-end editing and undo; clustered target placement, marker dragging, touch placement, 1 mm nudges, and clearing; invalid shaft input recovery; notes and scores surviving reload; offline reload and score entry; PWA update prompt; JSON export, duplicate-safe import, new-session import, and invalid backup rejection; history and keyboard dismissal of the native rules dialog.
- Responsive checks at 320, 390, 768, and 1440 px show no page-level horizontal overflow. The full scorecard scrolls horizontally on narrow screens.
- No browser console warnings or errors in the checked flows. Native installation was not exercised on physical iOS/Android devices.
- Field/custom browser checks: a complete 28-target Pro round scored 672 with 112 X; changing a station updated its face to 20 cm; a 2 × 3 custom round scored 38/60; mixed-round backups exported and imported; custom scores survived an offline reload after saving. Mobile checks include the builder, Field face, and 12-arrow custom rounds without X tracking. The browser warns before leaving while local saves are pending; wait for “Saved on this device” before closing.

The initial dependency audit reports 7 build-tool advisories (3 low, 4 moderate) through Svelte/Workbox dependencies, with no high or critical findings. npm's suggested PWA downgrade is a breaking change and is not applied automatically. The shipped app is static and has no server or production npm dependencies.
