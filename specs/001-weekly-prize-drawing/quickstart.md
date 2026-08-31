# Quickstart: Weekly Homeroom Prize Drawing

**Date**: 2026-08-30 | **Plan**: [plan.md](./plan.md)

Two audiences: the developer building it, and the librarian using it. Both matter — the second one is the acceptance test.

---

## For the developer

### Setup

```bash
npm install          # React, Vite, TypeScript, fflate, Vitest
npm run dev          # http://localhost:5173, hot reload
npm test             # Vitest — domain + parsing suites
npm run build        # → dist/LibraryReward.html (one file, nothing external)
```

### Do this first (before any UI work)

**The `file://` storage spike.** Everything about turn-taking assumes `localStorage` survives on a Chromebook opening a local file. Verify it on the real device:

1. Build a throwaway HTML file that writes a value to `localStorage` on load and displays whatever it read.
2. Save it to the Chromebook, open from the Files app, confirm the value survives a reload, a Chrome restart, and a reboot.
3. If it does not survive, switch to fallback ladder step 2 in [research.md](./research.md#r2) — history lives in memory and the backup file becomes a required, prominent part of every session, not an optional one.

Do not build screens on an unverified storage assumption.

### Build gate

`npm run build` must produce exactly one file in `dist/`, and that file must contain no `src=` or `href=` pointing at `http://`, `https://`, or a relative asset path. A bundle that quietly references an external asset works perfectly on a developer machine and fails in front of a class.

### Test data

`tests/fixtures/` holds anonymized workbooks built to the shapes in [contracts/input-files.md](./contracts/input-files.md). Include fixtures for the cases the real files cannot exercise:

- a circulation export **containing overdue rows** (the real reference export has none — see research R4)
- a row with a blank due date, and one with an unparseable due date
- barcodes with and without leading zeros for the same student
- a duplicate roster student (one `Active`, one `Inactive`)
- a homeroom where every student is overdue
- a homeroom one draw away from completing its round

The two real `.xlsx` files in the repo root contain live student names and should not be committed as fixtures.

### Order of work

1. `parsing/` + `domain/` with tests — this is where correctness lives, and it needs no UI.
2. `storage/` + backup export/import.
3. Import screen and homeroom list.
4. The draw screen and the reveal — the part to judge by eye, on a projector.
5. Winners summary, data-quality view, settings.

---

## For the librarian (the weekly routine)

1. **Export the two reports** from the library system: the patron roster and the circulation report showing checked-out items with their due dates.
2. **Open `LibraryReward.html`** from the Files app on the Chromebook. It opens in Chrome and works with no internet.
3. **Choose the two files.** The app shows what it read — how many students, how many homerooms, how many overdue items it found. If that last number looks wrong for the week, the wrong report was exported.
4. **Pick a homeroom.** You see how many children can win this week and how many are still waiting for their turn this round.
5. **Draw.** The names shuffle and slow to a stop on the winner. Press the skip control if a class is running short on time.
6. **Work through the homerooms.** Drawn ones are marked; pending ones stay on the list.
7. **Save the backup** at the end of the session — one button, saves a file to Downloads. Move it to your Google Drive folder. This file is what remembers whose turn it is; the browser's copy can be wiped by a device reset.
8. **Print or export** the week's winners to hand out prizes.

### Things the app will tell you rather than hide

- A homeroom where nobody can win this week (everyone left in the round has an overdue book).
- A student on the circulation report who isn't on the roster.
- A checked-out item whose due date it could not read.
- A week where it found zero overdue items — so you can tell "nobody is overdue" apart from "I exported the wrong report."

### What never appears on the screen the children see

Overdue status, fines, and whose turn has already been taken. The reveal cycles only through the names of children who can win.

---

## Acceptance walkthrough

Run this against the real files before calling it done:

| # | Check | Expected |
|---|---|---|
| 1 | Load both reference files | 975 active students, 67 homerooms, 7 students under `(No homeroom listed)` |
| 2 | Overdue count | 0 for the reference circulation export, stated plainly, not silently |
| 3 | Fines-only students | All 14 remain candidates |
| 4 | Swap the two files | Refused with an explanation, no partial results |
| 5 | Draw one homeroom | One candidate wins, animated, name readable across a room |
| 6 | Re-draw that homeroom | Warns before replacing; the replaced student returns to the waiting pool |
| 7 | Close and reopen | The week's winners are still there |
| 8 | Export then re-import backup | Identical history, confirmation shown before replacing |
| 9 | Simulate a full round | Everyone wins once, then the round resets and all are candidates again |
