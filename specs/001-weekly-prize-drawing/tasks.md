---
description: "Task list for Weekly Homeroom Prize Drawing"
---

# Tasks: Weekly Homeroom Prize Drawing

**Input**: Design documents from `/specs/001-weekly-prize-drawing/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. plan.md commits to Vitest over the domain and parsing layers, and [contracts/domain-api.md](./contracts/domain-api.md) enumerates the properties that must hold. Test tasks cover `src/domain/` and `src/parsing/` — the logic that decides who wins — not the UI, which is judged by eye.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1–US5, mapping to the user stories in spec.md

## Path Conventions

Single project at repository root: `src/`, `tests/`, `dist/`. Paths follow the structure in plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A working dev loop and a build that produces exactly one file.

- [X] T001 Initialize Vite + React 19 + TypeScript project at repository root: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`
- [X] T002 [P] Add runtime dependency `fflate` and dev dependencies (`vitest`, `@vitest/coverage-v8`, `typescript`, `@types/react`) in `package.json` — no spreadsheet library, no animation library, no CDN references
- [X] T003 [P] Configure Vitest in `vitest.config.ts` with a `node` environment for `src/domain` and `src/parsing` suites
- [X] T004 [P] Configure ESLint and Prettier in `eslint.config.js` and `.prettierrc`, including a rule banning dynamic `import()` and `new Worker` (both fail under `file://` per research R2)
- [X] T005 Configure single-file output in `vite.config.ts`: `vite-plugin-singlefile`, `build.rollupOptions.output.format = 'iife'`, `assetsInlineLimit: Infinity`, CSS code-splitting disabled, output named `dist/LibraryReward.html`
- [X] T006 Write the build gate in `scripts/check-single-file.mjs`: fail the build unless `dist/` contains exactly one file and that file contains no `src=`/`href=` referencing `http://`, `https://`, or a relative asset path; wire it into `npm run build`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The device-reality spike, shared types, and the parsing primitives every story depends on.

**⚠️ CRITICAL**: T007 gates all persistence design. Do not build screens on an unverified storage assumption.

- [ ] T007 ⚠️ **SPIKE** — Build `spike/storage-probe.html` (a standalone file that writes and reads `localStorage`, showing what it read) and verify on the librarian's actual Chromebook that the value survives a page reload, a Chrome restart, and a device reboot when opened from the Files app via `file://`. Record the outcome in `specs/001-weekly-prize-drawing/research.md` under R2. If it fails, adopt fallback ladder step 2 (in-memory history + mandatory backup file) before writing `src/storage/`
- [X] T008 [P] Define shared domain types in `src/domain/types.ts` per [data-model.md](./data-model.md): `RosterEntry`, `CirculationRow`, `Homeroom`, `ImportSummary`, `WinRecord`, `RoundState`, `Settings`, `CalendarDate`
- [X] T009 [P] Implement `normalizeBarcode` in `src/domain/identifiers.ts` per [contracts/domain-api.md](./contracts/domain-api.md): trim → uppercase → drop leading `P` and internal whitespace → strip leading zeros
- [X] T010 [P] Unit tests for barcode normalization in `tests/unit/identifiers.test.ts`: idempotence; `"000100001"`/`" 100001 "`/`"100001"` collapse to one key; `"P 4242"` → `"4242"`; empty input matches nothing; two distinct roster students never collide
- [X] T011 [P] Implement Excel serial ↔ calendar date conversion in `src/parsing/excelDate.ts` (days since 1899-12-30, honoring the 1900 leap-year quirk), plus text-date parsing, returning `null` for unparseable values
- [X] T012 [P] Unit tests for date handling in `tests/unit/excelDate.test.ts`: the observed serial `45798.55032407407` converts correctly; whole-day comparison ignores time-of-day; blank and garbage values return `null`
- [X] T013 Implement the OOXML reader in `src/parsing/xlsxReader.ts`: unzip with `fflate`, read `xl/sharedStrings.xml` and the first worksheet with `DOMParser`, return rows of cells keyed by column letter; handle shared strings, inline strings, and sparse rows where cells are omitted
- [X] T014 Unit tests for the reader in `tests/unit/xlsxReader.test.ts`: shared vs inline strings, a sparse row that omits middle cells does not shift later columns, an empty sheet, a non-zip file rejected cleanly
- [X] T015 Implement header-based column mapping in `src/parsing/headerMap.ts`: locate columns by header text case-insensitively and whitespace-tolerantly, return the list of missing required headers rather than throwing
- [X] T016 [P] Build anonymized fixtures in `tests/fixtures/` matching the shapes in [contracts/input-files.md](./contracts/input-files.md), including cases the real exports cannot exercise: a circulation file **containing overdue rows**, a blank due date, an unparseable due date, the same student with and without leading zeros, a duplicate roster student (one Active/one Inactive), a homeroom where everyone is overdue, and a homeroom one draw from completing its round. Do not commit the real `.xlsx` files as fixtures — they contain live student names
- [X] T017 Create the app shell in `src/app/App.tsx` and `src/app/session.ts`: screen switching, in-memory-only weekly session state, and projector-scale base styles in `src/ui/styles/` using a system font stack (no web fonts)

**Checkpoint**: Parsing primitives tested, storage reality known, shell renders. User stories can begin.

---

## Phase 3: User Story 1 - Build this week's eligible list (Priority: P1) 🎯 MVP

**Goal**: Load the two exports and show every homeroom with the students who can win this week.

**Independent Test**: Load the two reference files; confirm 975 active students across 67 homerooms, 7 under `(No homeroom listed)`, and that every student holding an overdue item is absent from every candidate list.

### Tests for User Story 1

- [X] T018 [P] [US1] Tests for `determineOverdue` in `tests/unit/eligibility.overdue.test.ts`: a past due date is `overdue`; due today is `notOverdue` (FR-010); a blank due date is `notOverdue`; a checkout-looking row with an unreadable due date is `undeterminable` (FR-011); a fine, a lost-book charge, and a refund are each `notOverdue` on their own (FR-009)
- [X] T019 [P] [US1] Conservation test for `buildHomerooms` in `tests/unit/eligibility.partition.test.ts`: every roster row lands in exactly one bucket — candidate or a counted set-aside reason — and roster row count equals candidates plus all set-asides (FR-039)
- [X] T020 [P] [US1] Tests for candidate derivation in `tests/unit/eligibility.candidates.test.ts`: faculty and inactive excluded (FR-007); duplicate roster entries collapse to one, preferring Active (FR-013); blank homeroom never joins a real homeroom (FR-014); a student with one overdue item and five fines is excluded exactly once; output is independent of input row order
- [X] T021 [P] [US1] Tests for report identification in `tests/unit/identifyReport.test.ts`: roster recognized by `Patron Type` + `Homeroom`; circulation by `Patron Barcode` + `Due`; a swapped pair is detected (FR-004); two unrecognizable files are refused with an explanation
- [X] T022 [P] [US1] Integration test in `tests/integration/import.test.ts` over the fixtures: full ingestion produces the expected homeroom count, candidate counts, and a zero-overdue week reported as valid rather than as an error

### Implementation for User Story 1

- [X] T023 [P] [US1] Implement roster parsing in `src/parsing/rosterReport.ts` → `RosterEntry[]`, mapping `Name`/`Barcode`/`Patron Type`/`Status`/`Homeroom`, treating unrecognized type or status as set-aside rather than eligible, and never using `District ID` for matching
- [X] T024 [P] [US1] Implement circulation parsing in `src/parsing/circulationReport.ts` → `CirculationRow[]`, retaining `dueDateRaw` verbatim so an unparseable value can be shown to the librarian
- [X] T025 [US1] Implement `src/parsing/identifyReport.ts` to classify each selected file and detect a swapped selection (FR-004)
- [X] T026 [US1] Implement `determineOverdue` in `src/domain/eligibility.ts` (FR-009, FR-010, FR-011)
- [X] T027 [US1] Implement `buildHomerooms` in `src/domain/eligibility.ts` applying the filter chain from [data-model.md](./data-model.md): student-only → active-only → group by homeroom → dedupe by `matchKey` → drop overdue holders → drop current-round winners (round input stubbed to 1 until US3)
- [X] T028 [US1] Populate `ImportSummary` in `src/domain/eligibility.ts` with per-reason counts and the affected rows attached for later display (FR-006, FR-039)
- [X] T029 [US1] Build the import screen in `src/ui/screens/ImportScreen.tsx`: two `<input type="file">` pickers, `File.arrayBuffer()` reading, no File System Access API
- [X] T030 [US1] Implement plain-language file error states in `src/ui/screens/ImportScreen.tsx`: unreadable file, not one of the two reports, missing a required column named explicitly, files swapped (FR-005)
- [X] T031 [US1] Show the load confirmation in `src/ui/screens/ImportScreen.tsx`: both file names, roster rows read, circulation rows read, and **overdue rows found**, so a wrong export is visible immediately (FR-006)
- [X] T032 [US1] Build the homeroom list in `src/ui/screens/HomeroomListScreen.tsx`: every homeroom with its candidate count, expandable to names, `(No homeroom listed)` clearly separated and skippable (FR-014, FR-015)
- [X] T033 [US1] Render `noCandidates` homerooms in `src/ui/screens/HomeroomListScreen.tsx` as visible and labeled rather than omitted (FR-030 precondition)

**Checkpoint**: The librarian can load two files and see correct per-homeroom candidate lists. This alone replaces the manual cross-referencing.

---

## Phase 4: User Story 2 - Draw a winner with a whimsical reveal (Priority: P1)

**Goal**: Pick a homeroom, run an animated drawing, announce one winner in front of a class.

**Independent Test**: With candidate lists loaded (or a stubbed list), select a homeroom, draw, and confirm exactly one candidate is announced with an animated reveal and that repeated draws vary.

### Tests for User Story 2

- [X] T034 [P] [US2] Tests for `drawWinner` in `tests/unit/drawing.test.ts`: returns `null` for an empty pool without throwing (FR-030); never returns a non-candidate; with a seeded RNG the result is deterministic
- [X] T035 [P] [US2] Uniformity test in `tests/unit/drawing.uniformity.test.ts`: over 1,000 seeded draws on one pool, every candidate is selected at least once and no selection rate deviates meaningfully from equal chance (SC-008)

### Implementation for User Story 2

- [X] T036 [US2] Implement `drawWinner` in `src/domain/drawing.ts` using rejection sampling over an injected `Rng`, with `crypto.getRandomValues` as the production source (FR-026)
- [X] T037 [P] [US2] Build the name-shuffle reveal in `src/ui/components/NameShuffle.tsx`: names cycle fast then decelerate to a stop on the winner, driven by `requestAnimationFrame`
- [X] T038 [P] [US2] Build the celebration burst in `src/ui/components/Confetti.tsx` as a small self-contained canvas animation with no external library
- [X] T039 [US2] Build the drawing screen in `src/ui/screens/DrawScreen.tsx`: select a homeroom and start a draw in no more than two actions (FR-025, SC-005)
- [X] T040 [US2] Wire the reveal to cycle **only** candidate names in `src/ui/screens/DrawScreen.tsx`, so students who cannot win never appear on a class-facing screen (FR-031)
- [X] T041 [US2] Add the skip control in `src/ui/screens/DrawScreen.tsx` to jump straight to the result (FR-029)
- [X] T042 [US2] Add projector-scale winner typography in `src/ui/styles/` — readable from the back of a classroom, high contrast (FR-028)
- [X] T043 [US2] Handle the single-candidate case in `src/ui/screens/DrawScreen.tsx`: the reveal still plays and the app notes there was only one candidate
- [X] T044 [US2] Handle the no-candidates case in `src/ui/screens/DrawScreen.tsx`: refuse the draw with child-appropriate, non-blaming wording that never names a reason tied to a student (FR-030, FR-031)

**Checkpoint**: The weekly event works end to end for a single homeroom.

---

## Phase 5: User Story 3 - Give every student a turn before anyone repeats (Priority: P1)

**Goal**: Per-homeroom rounds that persist across weeks, so every child wins once before anyone wins twice.

**Independent Test**: Simulate repeated weekly drawings for one homeroom and confirm every student wins exactly once before any student wins a second time, then that the round restarts cleanly.

### Tests for User Story 3

- [X] T045 [P] [US3] Tests for round advancement in `tests/unit/rounds.test.ts`: a round advances only when every currently rostered active student has a win at the current round (FR-017); rounds advance per homeroom independently (FR-018); advancing is idempotent
- [X] T046 [P] [US3] Tests for roster churn in `tests/unit/rounds.churn.test.ts`: a student new to the roster is immediately a candidate (FR-021); a student who won and then left does not block a reset (FR-022); a departed student's win record is retained
- [X] T047 [P] [US3] Test winner correction in `tests/unit/rounds.correction.test.ts`: deleting a `WinRecord` returns that student to the waiting pool with no other state to repair (FR-023)
- [X] T048 [P] [US3] School-year simulation in `tests/integration/schoolYear.test.ts`: across simulated weekly draws, every student in a homeroom wins exactly once before anyone wins twice, and the round resets afterward (SC-007)
- [X] T049 [P] [US3] Backup round-trip tests in `tests/unit/backupFile.test.ts`: export → import yields identical history; an unknown higher `version` is refused; an invalid file changes nothing; `rounds` missing or inconsistent with `wins` is rebuilt from `wins` and reported

### Implementation for User Story 3

- [X] T050 [US3] Implement `currentRoundFor`, `advanceRoundsIfComplete`, and `turnsRemaining` in `src/domain/rounds.ts` per [contracts/domain-api.md](./contracts/domain-api.md), deriving turn state from `WinRecord[]` rather than per-student flags (research R7)
- [X] T051 [US3] Wire the current-round filter into `buildHomerooms` in `src/domain/eligibility.ts`, replacing the T027 stub, and populate `alreadyWonThisRound` (FR-016)
- [X] T052 [US3] Implement `src/storage/historyStore.ts`: load/save `WinRecord[]`, `RoundState[]`, and `Settings` to `localStorage`, following whichever path T007 established
- [X] T053 [US3] Add a startup storage-availability probe in `src/storage/historyStore.ts` that reports plainly when history cannot be read or written, rather than silently starting an empty year (research R2)
- [X] T054 [US3] Implement `src/storage/backupFile.ts` export: versioned JSON per [contracts/backup-file.md](./contracts/backup-file.md), saved via `Blob` + `<a download>` named `library-reward-history-<schoolYear>.json`
- [X] T055 [US3] Implement `src/storage/backupFile.ts` import: validate fully before committing anything, then **replace** rather than merge, behind a confirmation showing both sides ("this file has N wins through <week>; you currently have M")
- [X] T056 [US3] Build the round meter in `src/ui/components/RoundMeter.tsx` showing turns taken and turns remaining per homeroom (FR-020)
- [X] T057 [US3] Surface round state in `src/ui/screens/HomeroomListScreen.tsx` so the librarian sees who is still waiting for a turn before drawing
- [X] T058 [US3] Build backup controls in `src/ui/screens/SettingsScreen.tsx`: export, import, last-exported date, and a warning that the browser's copy can be wiped by a device reset
- [X] T059 [US3] Build history correction and year reset in `src/ui/screens/SettingsScreen.tsx`: correct or remove a recorded winner (FR-023), clear turn-taking for a new school year for all homerooms or one (FR-024), and clear all imported data (FR-040)

**Checkpoint**: Turn-taking is correct and survives a week, a browser restart, and a device swap.

---

## Phase 6: User Story 4 - Work through all homerooms and keep the week's winners (Priority: P2)

**Goal**: Track progress across ~70 homerooms in one sitting and hand the results to someone.

**Independent Test**: Draw several homerooms, confirm each is marked complete with its winner and the rest marked pending, then export or print a list containing exactly those results.

- [X] T060 [P] [US4] Implement ISO week keys in `src/domain/weekKey.ts` and test in `tests/unit/weekKey.test.ts` (e.g. `2026-W36`), including year boundaries
- [X] T061 [US4] Record complete `WinRecord` values on each draw in `src/ui/screens/DrawScreen.tsx`: homeroom, student, round, `weekKey`, date drawn, and `candidatePoolSize` (FR-032)
- [X] T062 [US4] Mark drawn-this-week homerooms in `src/ui/screens/HomeroomListScreen.tsx` and keep pending ones visible (FR-033)
- [X] T063 [US4] Implement re-draw confirmation in `src/ui/screens/DrawScreen.tsx`: warn before replacing an existing winner for the week, and return the replaced student to the waiting pool (FR-034, US4 scenario 3)
- [X] T064 [US4] Enforce at most one record per (homeroom, weekKey) except via explicit replacement in `src/storage/historyStore.ts`, and at most one per (homeroom, round, student) (data-model validation rules)
- [X] T065 [US4] Build the winners summary in `src/ui/screens/WinnersScreen.tsx`: this week's winners by homeroom, plus remaining homerooms (FR-033)
- [X] T066 [US4] Add a print stylesheet in `src/ui/styles/print.css` producing a clean one-page winners list (FR-036)
- [X] T067 [US4] Add CSV/text export of the week's winners in `src/ui/screens/WinnersScreen.tsx` via `Blob` + `<a download>` (FR-036)
- [X] T068 [US4] Restore the in-progress week on reload in `src/app/session.ts` so closing and reopening preserves drawn winners without re-importing files (FR-035, FR-037)

**Checkpoint**: A full weekly session is practical for 67 homerooms.

---

## Phase 7: User Story 5 - See what the files could not tell us (Priority: P3)

**Goal**: Make every set-aside row visible so a genuinely overdue student never wins by accident.

**Independent Test**: Load fixtures containing a known unmatched circulation row and a known blank-homeroom student; confirm both appear with counts and identifying detail.

- [X] T069 [P] [US5] Test summary completeness in `tests/unit/importSummary.test.ts`: every set-aside reason is counted and every counted row is retrievable for display (FR-039)
- [X] T070 [US5] Build the data-quality screen in `src/ui/screens/DataQualityScreen.tsx` with sections per reason: faculty, inactive, no homeroom, duplicate roster entries, unmatched circulation rows, non-overdue rows, undeterminable due dates
- [X] T071 [US5] List unmatched circulation rows in `src/ui/screens/DataQualityScreen.tsx` with patron name, barcode, and title so the librarian can look them up (FR-038)
- [X] T072 [US5] Highlight undeterminable due dates in `src/ui/screens/DataQualityScreen.tsx`, showing `dueDateRaw` verbatim (FR-011)
- [X] T073 [US5] Add explicit zero-overdue messaging in `src/ui/screens/DataQualityScreen.tsx` and on the import confirmation, distinguishing "nobody is overdue this week" from "the wrong report was exported" (US5 scenario 2)
- [X] T074 [US5] Report blank-homeroom students in `src/ui/screens/DataQualityScreen.tsx` and link to the `(No homeroom listed)` group (FR-014)
- [X] T075 [US5] Link the data-quality summary from the import confirmation in `src/ui/screens/ImportScreen.tsx` so it is discoverable without being in the way

**Checkpoint**: Nothing the files could not answer is hidden.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T076 [P] Add `prefers-reduced-motion` handling in `src/ui/components/NameShuffle.tsx` and `src/ui/components/Confetti.tsx`: shorten the build-up rather than removing it (research R9)
- [X] T077 [P] Verify contrast and legibility across all screens in `src/ui/styles/`, targeting a projector at classroom distance
- [X] T078 Privacy audit across `src/`: confirm no network calls of any kind, that roster and circulation data are never written to storage, and that only `WinRecord` fields listed in data-model.md persist (FR-040, research R10)
- [X] T079 Performance check in `tests/integration/performance.test.ts`: full ingestion of ~1,100 roster rows plus candidate derivation completes in under 3 seconds (SC-002 allows 10)
- [X] T080 Run `npm run build` and confirm the T006 gate passes: exactly one file in `dist/`, no external references
- [ ] T081 Verify `dist/LibraryReward.html` on the real Chromebook opened from the Files app: file picker, draw, backup export, and reload-persistence all work under `file://`
- [ ] T082 Execute the nine-step acceptance walkthrough in [quickstart.md](./quickstart.md) against the real reference files and record results
- [X] T083 [P] Write `README.md` for the librarian: how to save the file, the weekly routine, and why the backup file matters
- [ ] T084 [P] Add the optional Playwright smoke test in `tests/e2e/weekly-flow.spec.ts` covering import → draw → export
- [ ] T085 Confirm with the librarian that the library system can export checked-out items with due dates, re-run T082 against a real export containing overdue rows, and record the confirmed export settings in `README.md` — the reference circulation file has no overdue rows, so the overdue path is otherwise verified only against fixtures we wrote ourselves (research R4)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**. T007 specifically gates T052–T055
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2; consumes US1 candidate lists but is testable against a stubbed list
- **US3 (Phase 5)**: depends on Phase 2 and on T027 existing (T051 replaces its stub)
- **US4 (Phase 6)**: depends on US2 (draws to record) and US3 (history to store)
- **US5 (Phase 7)**: depends on US1 (`ImportSummary` is populated in T028)
- **Polish (Phase 8)**: depends on the stories being delivered

### User Story Dependencies

- **US1 (P1)**: independent. The MVP.
- **US2 (P1)**: independent of US3–US5; needs a candidate list, real or stubbed
- **US3 (P1)**: independent of US2 and US4 at the domain level — `rounds.ts` is pure and fully testable before any UI exists
- **US4 (P2)**: genuinely depends on US2 + US3; it is the workflow wrapper around them
- **US5 (P3)**: depends only on US1

### Within Each Story

Tests before implementation · parsing before domain · domain before UI · pure logic before anything that renders.

### Parallel Opportunities

- T002–T004 in Setup
- T008–T012 and T016 in Foundational (T013 → T014 → T015 are sequential; T013 blocks T023/T024)
- All US1 test tasks T018–T022 together; then T023 and T024 together
- T037 and T038 while T036 is in progress
- All US3 test tasks T045–T049 together
- T076, T077, T083, T084 in Polish
- With more than one developer: after Phase 2, US1 / US2 / US3 domain work can proceed simultaneously

---

## Parallel Example: User Story 1

```bash
# All US1 tests together:
Task: "Tests for determineOverdue in tests/unit/eligibility.overdue.test.ts"
Task: "Conservation test for buildHomerooms in tests/unit/eligibility.partition.test.ts"
Task: "Tests for candidate derivation in tests/unit/eligibility.candidates.test.ts"
Task: "Tests for report identification in tests/unit/identifyReport.test.ts"
Task: "Integration test in tests/integration/import.test.ts"

# Then both parsers together:
Task: "Implement roster parsing in src/parsing/rosterReport.ts"
Task: "Implement circulation parsing in src/parsing/circulationReport.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → Phase 2 Foundational (**T007 spike first**)
2. Phase 3 US1
3. **STOP and VALIDATE** against the real reference files: 975 active students, 67 homerooms, 7 unassigned, zero overdue reported plainly
4. This is already useful — it replaces the manual spreadsheet work even with no drawing screen

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → correct candidate lists (MVP)
3. + US2 → the weekly event works for one homeroom; demo it to the librarian before building further
4. + US3 → fair turn-taking that survives across weeks; this is the point where the backup file must be explained to her
5. + US4 → a practical 68-homeroom session with printable results
6. + US5 → nothing hidden
7. + Polish → ship `dist/LibraryReward.html`

### Sequencing Notes

- **T007 before any storage code.** If `localStorage` does not survive on the Chromebook, US3's persistence design changes shape and the backup file becomes mandatory rather than a safety net.
- **T085 is not optional polish.** Until a real export containing overdue rows exists, the single most important rule in the app — who is disqualified — has been exercised only against fixtures we wrote ourselves.
- Demo after US2 rather than at the end. The reveal is the part that needs a human's eye, and it is cheap to adjust early.

---

## Notes

- `[P]` = different files, no dependency on incomplete work
- Every task names its file path; commit after each task or logical group
- Tests cover `src/domain/` and `src/parsing/` because that is where being wrong is invisible; the UI is validated by the quickstart walkthrough and by watching a class use it
- The two real `.xlsx` files in the repo root contain live student names — keep them out of fixtures and out of commits

**Total tasks**: 85 (Setup 6 · Foundational 11 · US1 16 · US2 11 · US3 15 · US4 9 · US5 7 · Polish 10)

---

## Status at end of `/speckit.implement`

**80 of 85 tasks complete.** 112 automated tests pass; `npm run build` produces a
self-contained `dist/LibraryReward.html` (240 KB) that boots and renders.

Five tasks are **not** complete, and none of them can be finished from a developer
machine:

| Task | Why it is still open |
|---|---|
| T007 | The `localStorage`-on-`file://` spike needs the librarian's actual Chromebook. `spike/storage-probe.html` is built and ready to run; the app already handles the failure case (it detects unusable storage at startup and says so), so this verifies rather than blocks. |
| T081 | Verifying the built file on the real Chromebook — same reason. |
| T082 | The nine-step acceptance walkthrough is automated where possible (`tests/integration/referenceFiles.test.ts` covers steps 1–3 against the real exports); the interactive steps need the device. |
| T084 | Playwright smoke test — skipped deliberately. `tests/integration/bundle.test.ts` boots the actual built file in jsdom and asserts it renders, which covers the same regression at a fraction of the weight. |
| T085 | Confirming the library system can export checked-out items with due dates. This one matters most: see below. |

### The gap that still matters

The reference circulation export contains **zero overdue rows** — all 17 are
`Unpaid Fines & Refunds` with an empty `Due` column. Under the clarified rule, it
disqualifies nobody. The overdue path is therefore verified only against fixtures
we wrote ourselves. Until a real export containing overdue items exists, the single
most important rule in the app is untested against real data.

### Corrections made during implementation

- The reference roster figures in the specs were wrong and have been corrected
  everywhere: **975 active students, 67 homerooms, 7 active students with no
  homeroom** (not 978/68/10, which counted inactive students and treated the blank
  homeroom as a group). Verified twice, independently.
- The real workbooks store every cell as an **inline string** with an empty
  `sharedStrings.xml`. This is now recorded in `contracts/input-files.md`.
- One file was added beyond the planned structure: `src/parsing/ingest.ts`, which
  orchestrates read → identify → parse → build so the whole ingestion path is
  testable without a browser.
