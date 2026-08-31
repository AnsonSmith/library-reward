# Phase 0 Research: Weekly Homeroom Prize Drawing

**Date**: 2026-08-30 | **Plan**: [plan.md](./plan.md)

All Technical Context unknowns are resolved below. Two items carry residual risk that must be retired by a spike on the actual Chromebook before UI work begins; both have defined fallbacks, so neither blocks planning.

---

## R1. How the app reaches a Chromebook

**Decision**: Ship one self-contained `LibraryReward.html`. The librarian saves it to her Chromebook (Downloads or a Google Drive folder visible in the Files app) and double-clicks it; ChromeOS opens it in Chrome at a `file://` URL. No install, no admin rights, no runtime, no internet.

**Rationale**: A Chromebook cannot run a native installer, so Electron, Tauri, and a Python/Node launcher are all off the table regardless of district policy. A single file is the only delivery that needs nothing from IT and nothing from the network. Updates are "replace one file," which she can do by saving a new copy over the old one.

**Alternatives considered**:
- *Hosted static page installed as a PWA* — **now built as a standing fallback** (`npm run build:web`, deployed by `.github/workflows/deploy.yml`): technically the better ChromeOS citizen — a launcher icon, a real HTTPS origin (which makes storage behavior boring and reliable), offline via service worker, and automatic updates. Rejected as the primary path because it requires hosting and an initial network fetch, and the app's whole privacy posture is easier to state honestly when nothing is ever fetched. **The bundle is built so this remains available**: the same source produces both shapes, so if `file://` storage proves fragile (R2) or updates become a chore, switching is a deployment decision, not a rewrite. The hosted build adds a manifest, icons, and a network-first service worker (offline after first load, and never pinned to a stale build). Its one blocker is not technical: GitHub Pages on a free plan requires a public repository, and the student roster exports are still in this repo's history — see README, "Before this repo goes anywhere".
- *Chrome extension / packaged app*: needs developer mode or district deployment through the admin console. Rejected.

---

## R2. What actually works under `file://` (SPIKE REQUIRED)

**Decision**: Design to the lowest common denominator of `file://` and verify on the real device first. The bundle uses only capabilities that are safe there:

| Capability | Decision | Why |
|---|---|---|
| Script loading | Single inline classic script (Vite `output.format: 'iife'` + `vite-plugin-singlefile`) | External and cross-origin module fetches fail under `file://`. An inline classic script has nothing to fetch. |
| Code splitting / `import()` | Forbidden | Dynamic import resolves to a `file://` fetch and fails. |
| Web workers | Forbidden | Worker construction from `file://` is blocked. Parsing ~1,100 rows is fast enough on the main thread. |
| Reading the spreadsheets | `<input type="file">` → `File.arrayBuffer()` | Plain file inputs work everywhere, including `file://`. Avoids the File System Access API, which is not dependable on an opaque origin. |
| Saving the backup | `Blob` + `URL.createObjectURL` + `<a download>` | Lands in Downloads; she moves it to Drive. Avoids `showSaveFilePicker`. |
| IndexedDB | **Not used** | Chrome denies IndexedDB on `file://` origins. |
| Persistent history | `localStorage`, with fallbacks | See below. |

**Residual risk**: `localStorage` availability on `file://` in current Chrome/ChromeOS is the one thing this plan cannot verify from a development machine, and everything about turn-taking depends on it. **Spike (first implementation task)**: build a throwaway single HTML file that writes to `localStorage`, and confirm on her Chromebook that the value survives a page reload, a browser restart, and a device reboot.

**Fallback ladder, in order**:
1. `localStorage` works → primary store, backup file is belt-and-braces.
2. `localStorage` unavailable or wiped by policy → the app runs with history in memory and **requires** loading the backup file at the start of each session and saving it at the end; the UI makes this a prominent, unmissable step rather than a silent failure.
3. Either way, the app detects at startup whether storage is readable and says so plainly instead of quietly losing a school year.

**Non-negotiable regardless of outcome**: the JSON backup export exists and is the system of record the librarian can hold onto. Browser storage is treated as a cache of it, never as the only copy.

---

## R3. Reading `.xlsx` without a spreadsheet library

**Decision**: Parse the workbooks directly — unzip with `fflate`, then read `xl/sharedStrings.xml` and `xl/worksheets/sheet1.xml` with the browser's built-in `DOMParser`.

**Rationale**: The app needs a rectangle of cells from one sheet, nothing else — no formulas, no styling, no writing. That is roughly 100 lines. This approach was validated against both real export files before writing this plan: it read all 1,071 roster rows and all 18 circulation rows correctly, including shared strings and inline strings. `fflate` is ~15 KB, which matters when everything must inline into one file.

**Alternatives considered**:
- *SheetJS (`xlsx`)*: the obvious default, rejected on two counts. The version published to npm (0.18.5) carries a known prototype-pollution advisory (CVE-2023-30533) and current versions are distributed from the vendor's own CDN rather than npm, which is awkward for a reproducible offline build. It also adds roughly a megabyte to a file that must be double-clicked.
- *ExcelJS*: larger still, and built for writing workbooks we never write.
- *Asking the librarian to export CSV instead*: would remove the parsing problem entirely, but adds a manual conversion step every week to a routine whose whole point is removing manual steps.

**Consequence**: the parser owns its own edge cases — shared vs. inline strings, sparse rows with missing cells, and columns identified by header text rather than position (a column inserted upstream must not silently shift the meaning of the data).

---

## R4. Excel dates, and deciding what is overdue

**Decision**: Treat a numeric due-date cell as an Excel serial date (days since 1899-12-30, accounting for the spreadsheet 1900 leap-year quirk) and a text cell as a parsed calendar date. An item is overdue when its due date is strictly before the local calendar date of the drawing; due today is not overdue (FR-010). "Today" is injected into the domain layer so this is testable without clock games.

**Rationale**: The sample circulation export stores dates as serial floats — `Fine Assessed Date` values like `45798.55032407407` confirm the format — so a bare number is expected in the `Due` column too. Comparing whole calendar days rather than timestamps avoids a book due at 3pm counting as overdue during a 9am drawing.

**Open dependency (carried from the spec)**: the sample export contains **zero** overdue rows — every row is `Unpaid Fines & Refunds` with an empty `Due` column. Under the clarified rule, that file disqualifies nobody. The implementation handles this correctly and says so out loud (FR-006, FR-011), but the librarian still needs to confirm the library system can export currently-checked-out items with due dates. **Until a real export containing overdue rows exists, the overdue path is verified only against synthesized fixtures.**

**Alternatives considered**: inferring "overdue" from transaction type text alone (e.g. a row labeled `Overdue`). Rejected as the primary rule because the label vocabulary of an unseen export is guesswork, whereas "has a due date, and it has passed" is defensible. Transaction-type text is used only as a secondary signal for flagging rows that look like checkouts but have no readable due date.

---

## R5. Matching students between the two reports

**Decision**: Join on patron barcode, normalized by trimming whitespace, uppercasing, dropping a leading `P` prefix and internal spaces, and stripping leading zeros before comparison. Keep the original string for display.

**Rationale**: Measured against the real files: all 17 circulation rows matched a roster barcode, while `District ID` is blank for some students and duplicated across 8 of them — so barcode is the only trustworthy key. Roster barcodes appear in several shapes (`000100001`, `020100008`, `P 4242` for faculty), and spreadsheet round-trips are notorious for eating leading zeros, so normalization is required rather than optional.

**Safety property**: normalization only ever widens what matches. A missed match would wrongly make an overdue student eligible, which is the failure mode that embarrasses the librarian in front of a class, so any circulation row that fails to match a roster entry is surfaced in the data-quality summary (FR-038) rather than dropped.

**Alternatives considered**: matching on patron name. Rejected — names collide, the two files format them differently, and the roster already shows near-duplicate name entries (`Quill, JoAnne` vs `Quill, Joanne`).

---

## R6. Fair random selection

**Decision**: Select with `crypto.getRandomValues` using rejection sampling to avoid modulo bias, behind an injectable RNG interface so tests can drive it deterministically.

**Rationale**: SC-008 asks for no noticeable deviation from equal chance across a school year, and SC-007 requires exact turn-taking. Both are testable only if randomness is injectable. `Math.random()` would likely be fine in practice, but rejection sampling over a CSPRNG costs nothing here and removes the argument entirely.

---

## R7. Turn-taking across the school year

**Decision**: Model a round as *state derived from the winner history*, not as a stored flag per student. For a homeroom, the current round number is stored, and a student is "already had their turn" if the history contains a win for them in that homeroom at that round number. A round advances when every student **currently on the roster** for that homeroom has a win in the current round.

**Rationale**: Deriving eligibility from history rather than mutable per-student flags makes the roster churn requirements fall out naturally: a student who arrives mid-year has no win in the current round and is immediately eligible (FR-021); a student who leaves simply stops appearing on the roster and cannot block a reset (FR-022); correcting a mistaken winner is a deletion from history, which automatically returns that student to the pool (FR-023). Flags would require reconciliation logic on every import.

**Consequence**: round completion is evaluated against each week's roster, so it is recomputed on import rather than stored as a decision made once.

**Alternatives considered**: storing `hasWon` on a persisted student record. Rejected — it duplicates state that the history already implies, and the two would drift the first time a roster changed or a winner was corrected.

---

## R8. Build and bundling

**Decision**: Vite + React + TypeScript for development; `vite-plugin-singlefile` with `build.rollupOptions.output.format = 'iife'`, `assetsInlineLimit: Infinity`, and CSS code-splitting disabled, producing `dist/LibraryReward.html`. System font stack only — no web fonts. Any images are inline SVG or data URIs.

**Rationale**: Gives a normal dev loop with hot reload while the shipped artifact stays a single double-clickable file. The `iife` format sidesteps the inline-module edge cases under `file://` entirely.

**Build gate**: a check that `dist/` contains exactly one file and that the HTML contains no `src=`/`href=` pointing at `http`, `https`, or a relative asset path. This is the kind of regression that would only ever be discovered by a librarian holding a broken app in front of a class.

---

## R9. Making the reveal whimsical without dependencies

**Decision**: Hand-rolled CSS animations plus a small canvas confetti burst, driven by `requestAnimationFrame`. A name-shuffle build-up (names cycling fast, then slowing to a stop on the winner) with a celebratory finish. Respect `prefers-reduced-motion` by shortening rather than removing the build-up, and always offer a skip control (FR-029).

**Rationale**: Animation libraries would add weight to a file that must inline everything, and the effect needed is simple and specific. Slowing a shuffle to a stop reads to a child as a fair drawing in a way an instant result does not.

**Deliberate constraint from the spec**: the reveal cycles only through candidate names. Students who cannot win are never rendered on a class-facing screen at all, which satisfies FR-031 by construction rather than by remembering to hide something.

**Alternatives considered**: a spinning wheel with one wedge per student. Rejected — with 25+ students the wedges are unreadable on a projector, and it visibly enumerates exactly who was excluded.

---

## R10. Privacy posture

**Decision**: Roster and circulation data live in memory for the session only and are never written to storage. Persisted history holds only what turn-taking requires: homeroom, student identifier, display name, round number, and date drawn. The app makes no network requests of any kind. The librarian can clear all stored data (FR-040).

**Rationale**: This is a roster of elementary school children. Minimizing what is written to disk, and being able to state plainly that nothing leaves the device, is worth more than any convenience feature that would compromise it.
