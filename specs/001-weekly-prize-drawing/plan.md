# Implementation Plan: Weekly Homeroom Prize Drawing

**Branch**: `001-weekly-prize-drawing` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-weekly-prize-drawing/spec.md`

## Summary

A self-contained browser app that a school librarian runs on her Chromebook each week. She picks the two spreadsheets exported from the library system; the app parses them locally, subtracts students holding overdue items, subtracts students who have already won in their homeroom's current round, and presents each homeroom's candidates. She then runs a whimsical animated drawing per homeroom, and the app remembers winners across weeks so every student gets a turn before anyone repeats.

Technical approach: one static bundle — HTML, CSS, and JavaScript inlined into a single file with no network calls at runtime. Spreadsheets are unzipped and parsed in the browser with a small purpose-built OOXML reader (no heavyweight spreadsheet library). Turn-taking history persists in browser storage, backed by an explicit JSON backup file the librarian saves to Google Drive. All student data stays on the device; the app never transmits anything.

## Technical Context

**Language/Version**: TypeScript 5.x targeting ES2020, compiled to a single bundle
**Primary Dependencies**: React 19 + Vite (build only); `fflate` for ZIP decompression; browser-native `DOMParser` for OOXML. No runtime network dependencies, no CDN, no web fonts, no spreadsheet library.
**Storage**: `localStorage` for winner/round history (small, ~2,500 records/year), plus a versioned JSON backup file the user exports and re-imports. Roster and circulation data are held in memory only and never persisted.
**Testing**: Vitest for unit and integration tests over the pure domain and parsing modules, using fixture spreadsheets derived from the real exports. One Playwright smoke test for the import → draw → export flow (optional, deferred to end).
**Target Platform**: ChromeOS (Chromebook), Chrome 120+. Must also work when opened from `file://` with no internet connection. The same bundle works unchanged if later served from an HTTPS URL.
**Project Type**: Single-project static web application (client-only, no backend)
**Performance Goals**: Both files parsed and all candidate lists built in under 3 seconds for ~1,100 roster rows (spec allows 10s); reveal animation holds 60 fps on Chromebook-class hardware.
**Constraints**: Fully offline; no install, no admin rights, no runtime; no dynamic `import()`, no web workers, no external script/style/font fetches (all blocked or unreliable under `file://`); winner name legible from the back of a classroom; no student's overdue or turn status ever rendered on a class-facing screen.
**Scale/Scope**: ~1,000 students, ~70 homerooms, ~36 school weeks per year; single user, single device; roughly 6 screens (Import, Homerooms, Draw, Winners, Data Quality, Settings/Backup).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the unmodified Spec Kit template — no principles have been ratified for this project, so there are no project-specific gates to evaluate. The plan is therefore held to the template's default posture (simplicity, testability, no unjustified complexity):

| Default gate | Status | Evidence |
|--------------|--------|----------|
| Simplicity / YAGNI | PASS | Single project, no backend, no database, no auth, two runtime dependencies (one of which is 15 KB). Rejected Electron/Tauri, a server, and a full spreadsheet library. |
| Testability | PASS | All eligibility, round, date, and matching logic lives in pure functions with injected randomness and injected "today", tested directly without a browser. |
| Observability | PASS | The data-quality summary is the user-facing log: every row set aside is counted and attributable. |
| No premature abstraction | PASS | Storage is a single small module behind one interface, justified only because `file://` storage behavior must be verified on the actual device (see Phase 0 spike). |

**Post-Phase-1 re-check**: PASS — the design added no projects, services, or dependencies beyond those listed above. Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-weekly-prize-drawing/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── input-files.md   # What the two spreadsheet exports must contain
│   ├── backup-file.md   # Versioned JSON history export/import format
│   └── domain-api.md    # Pure-function contracts for the core logic
├── checklists/
│   └── requirements.md  # Spec quality checklist (complete)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── domain/                   # Pure, framework-free, fully unit-tested
│   ├── identifiers.ts        # Barcode normalization + matching (FR-008)
│   ├── eligibility.ts        # Overdue determination + candidate building (FR-007..FR-015)
│   ├── rounds.ts             # Turn-taking rounds, resets, roster churn (FR-016..FR-024)
│   ├── drawing.ts            # Unbiased random selection with injected RNG (FR-026)
│   └── types.ts              # Domain types shared across layers
├── parsing/                  # Spreadsheet ingestion
│   ├── xlsxReader.ts         # unzip + sharedStrings + sheet → rows of cells
│   ├── excelDate.ts          # Excel serial ↔ calendar date, with the 1900 bug
│   ├── headerMap.ts          # Locate columns by header text, report what's missing
│   ├── rosterReport.ts       # Roster export → RosterEntry[]
│   ├── circulationReport.ts  # Circulation export → CirculationRow[]
│   └── identifyReport.ts     # Which file is which; detect a swapped selection (FR-004)
├── storage/
│   ├── historyStore.ts       # Load/save winner history; storage-availability probe
│   └── backupFile.ts         # Export/import the versioned JSON backup
├── ui/
│   ├── screens/              # Import, Homerooms, Draw, Winners, DataQuality, Settings
│   ├── components/           # WheelReveal, Confetti, HomeroomCard, RoundMeter, etc.
│   └── styles/               # Projector-scale typography, high-contrast theme
├── app/
│   ├── App.tsx               # Screen routing and top-level state
│   └── session.ts            # In-memory weekly session (never persisted)
└── main.tsx

tests/
├── unit/                     # domain/ and parsing/ — the bulk of the suite
├── integration/              # Whole-file ingestion → candidate lists, using fixtures
├── fixtures/                 # Anonymized .xlsx built from the real export shapes
└── e2e/                      # Optional Playwright smoke test

public/                       # Nothing fetched at runtime; build inlines everything
dist/
└── LibraryReward.html        # The single deliverable file
```

**Structure Decision**: Single-project static web app. The layering is deliberate and load-bearing rather than ceremonial: `domain/` and `parsing/` hold every rule that must be provably correct (who is disqualified, whose turn it is, which student matched which row) and are testable without a browser or a DOM; `ui/` holds the parts that must be judged by eye in front of children. `dist/LibraryReward.html` is the only artifact the librarian ever touches.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
