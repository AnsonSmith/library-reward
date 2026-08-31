# Phase 1 Data Model: Weekly Homeroom Prize Drawing

**Date**: 2026-08-30 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Two lifetimes exist in this app and must not be confused:

- **Session data** (roster, circulation rows, candidate lists) — built on import, held in memory, discarded when the tab closes. Never persisted.
- **Persistent data** (winner history, round state, settings) — survives across weeks in `localStorage` and in the exported backup file. Deliberately small.

---

## Session entities

### RosterEntry

One patron row from the roster export.

| Field | Type | Notes |
|---|---|---|
| `displayName` | string | As printed, `"Last, First Middle"`. Shown to the class. |
| `barcode` | string | Original text, e.g. `000100001`, `P 4242`. |
| `matchKey` | string | Normalized barcode (R5). The join key and the identity used in history. |
| `districtId` | string \| null | Present for most students; blank for some, duplicated for others. **Never** used for matching. |
| `patronType` | `"Student" \| "Faculty" \| "Other"` | Only `Student` can win (FR-007). |
| `status` | `"Active" \| "Inactive"` | Only `Active` can win (FR-007). |
| `homeroom` | string \| null | Teacher name; `null` when blank (7 active students in the sample). |

**Validation**
- `barcode` required and non-empty; a row without one cannot be matched and is reported as a data-quality issue.
- `patronType` and `status` unrecognized → mapped to `Other`/`Inactive` and counted in the summary rather than assumed eligible.
- Duplicate `matchKey` across rows → collapse to one entry, preferring `Active` over `Inactive` (FR-013). The discarded duplicate is counted.

### CirculationRow

One row from the circulation export. Only overdue rows disqualify.

| Field | Type | Notes |
|---|---|---|
| `displayName` | string | Not used for matching; useful for looking up unmatched rows. |
| `barcode` / `matchKey` | string | Join to `RosterEntry.matchKey`. |
| `transactionType` | string | e.g. `Unpaid Fines & Refunds`. Secondary signal only (R4). |
| `dueDate` | CalendarDate \| null | Parsed from Excel serial or text; `null` when blank. |
| `dueDateRaw` | string | Kept verbatim so an unparseable value can be shown to the librarian. |
| `itemTitle` | string \| null | For the data-quality list. |
| `fineReason` | string \| null | e.g. `Lost LM`, `Refund LM`. Never disqualifying on its own. |

**Derived**: `isOverdue` = `dueDate !== null && dueDate < drawDate` (FR-009, FR-010).
**Derived**: `isUndeterminable` = looks like a checkout but `dueDate === null` → surfaced, never silently treated as fine (FR-011).

### Homeroom

Derived from the roster, not stored.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Roster homeroom value; the special group `"(No homeroom listed)"` collects `homeroom === null` and is skippable (FR-014). |
| `students` | RosterEntry[] | Active students only. |
| `candidates` | RosterEntry[] | Students minus overdue holders minus current-round winners (FR-015). |
| `blockedByOverdue` | RosterEntry[] | Count shown to the librarian; **never** rendered on a class-facing screen (FR-031). |
| `alreadyWonThisRound` | RosterEntry[] | Same visibility rule. |
| `currentRound` | number | From persisted round state; defaults to 1. |
| `turnsTaken` / `turnsRemaining` | number | Drives the round meter (FR-020). |

**States**: `drawable` (≥1 candidate) · `noCandidates` (0 candidates — shown, never hidden, FR-030) · `drawnThisWeek` (a result already exists for the current week).

### ImportSummary

What the librarian sees to confirm she loaded the right week (FR-006, FR-039).

Holds: both file names, import timestamp, roster rows read, circulation rows read, overdue rows found, and counts set aside by reason — `faculty`, `inactive`, `noHomeroom`, `duplicateRoster`, `unmatchedCirculation`, `nonOverdue`, `undeterminableDueDate` — each with the affected rows attached for display.

---

## Persistent entities

### WinRecord

The single source of truth for turn-taking. Append-only in normal use; deletion is an explicit correction (FR-023).

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable id for correction/deletion. |
| `homeroom` | string | The homeroom **at the time of the win**. |
| `round` | number | The round this win belongs to. |
| `studentMatchKey` | string | Normalized barcode — identity across weeks. |
| `studentName` | string | Snapshot for display; the roster may later change. |
| `drawnOn` | CalendarDate | Date of the drawing. |
| `weekKey` | string | ISO week, e.g. `2026-W36`. Groups a week's winners (FR-033, FR-036). |
| `candidatePoolSize` | number | Recorded for auditability (FR-032). |

**Validation**: at most one record per (`homeroom`, `round`, `studentMatchKey`) — a student cannot take two turns in one round. At most one record per (`homeroom`, `weekKey`) unless the librarian explicitly confirms a replacement (FR-034).

### RoundState

| Field | Type | Notes |
|---|---|---|
| `homeroom` | string | Key. |
| `currentRound` | number | Starts at 1. |
| `startedOn` | CalendarDate | When this round began. |

**Transition** (evaluated on import and after each draw, per R7): if every active student currently on the roster for that homeroom has a `WinRecord` at `currentRound`, then `currentRound += 1` and all of that homeroom's students become candidates again (FR-017). Rounds advance independently per homeroom (FR-018).

### Settings

`schoolYearLabel` (e.g. `2026-2027`, used for backup filenames and the year-reset boundary), `lastBackupExportedOn`, and `reduceMotion`.

---

## Relationships

```text
RosterEntry ──matchKey──> CirculationRow        (many rows per student; any overdue one disqualifies)
RosterEntry ──homeroom──> Homeroom ──1:1──> RoundState
Homeroom ────1:many────> WinRecord (filtered by round → alreadyWonThisRound)
WinRecord ──studentMatchKey──> RosterEntry      (may dangle: student left the school — allowed, R7)
```

A `WinRecord` whose student is no longer on the roster is intentionally kept. It preserves the historical result while not blocking the round from completing (FR-022).

---

## Candidate derivation (the rule the whole app exists to compute)

```text
candidates(homeroom, drawDate) =
    roster
      .filter(patronType === "Student")
      .filter(status === "Active")
      .filter(homeroom matches)
      .dedupeBy(matchKey)
      .filter(NOT any circulation row with same matchKey where isOverdue)
      .filter(NOT any WinRecord with same matchKey, same homeroom, round === currentRound)
```

Each filter maps to a requirement and to a unit test: FR-007, FR-007, FR-012, FR-013, FR-009, FR-016.
