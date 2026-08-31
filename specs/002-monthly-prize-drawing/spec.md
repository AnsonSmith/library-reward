# Feature Specification: Monthly Homeroom Prize Drawing

**Feature Branch**: `002-monthly-prize-drawing`
**Created**: 2026-08-31
**Status**: Implemented
**Supersedes**: the weekly cadence in `specs/001-weekly-prize-drawing/spec.md`. Everything
that specification says about eligibility, turn-taking, the reveal, data quality,
privacy, and delivery still holds; only the cadence and the shape of the input change.
**Input**: User description: "I need to update this app so that we can run only monthly reward drawings. This means we will need to be able to upload multiple weekly circulation reports (with overdue books) and if a student appears in any of these reports they are ineligible for the monthly drawing for their homeroom."

## Why

The library keeps exporting a circulation report every week, but the prize drawing now
happens once a month. A single week's report would let a child who was three weeks
overdue win, as long as they returned the book before the report the librarian happened
to bring. Pooling the month's reports is what makes the month's drawing mean what the
children are told it means.

## Clarifications

### Session 2026-08-31

- Q: What makes a student ineligible when they appear in an uploaded report?
  → A: **Overdue rows only.** The rule from FR-009 is unchanged: fines, lost-book
  charges, and refunds do not disqualify. "Appears in any report" means "appears with a
  genuinely overdue item in any report".
- Q: What defines a drawing period?
  → A: **The calendar month**, derived from the drawing date. One winner per homeroom
  per calendar month. The librarian never has to set or name a period.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pool a month of circulation reports (Priority: P1)

The librarian selects the patron roster plus every weekly circulation report the month
produced — four or five files, in any order, added in as many trips to the file picker
as she needs. The app sorts them out by their column headers, pools every circulation
row, and shows her which children can win this month.

**Why this priority**: This is the whole change. Without it the monthly drawing is a
weekly drawing run less often, with three weeks of overdue books invisible.

**Independent Test**: Supply one roster and four circulation reports where a student is
overdue in only the first. Confirm that student is excluded from their homeroom's
candidate list, and that the app reports all four files by name.

**Acceptance Scenarios**:

1. **Given** four weekly circulation reports and a roster, **When** the librarian loads
   them in any order, **Then** the app identifies each file by its headers and builds
   candidate lists from all of them together.
2. **Given** a student overdue in the first report and absent from the three that
   follow, **When** the candidate lists are built, **Then** that student is not a
   candidate this month.
3. **Given** a student who appears in several reports for fines or refunds only,
   **When** the candidate lists are built, **Then** that student remains a candidate,
   however many reports carry them.
4. **Given** the same student overdue in three different reports, **When** the summary
   is shown, **Then** they are counted once as a student sitting out, and each overdue
   row is still counted in the row totals.
5. **Given** only a roster, or only circulation reports, **When** the librarian tries to
   load them, **Then** the app says exactly what is missing rather than proceeding.
6. **Given** two files that both look like the roster, **When** the librarian loads
   them, **Then** the app names both and asks for one roster.

---

### User Story 2 - See which week each finding came from (Priority: P2)

Every row the app sets aside — an unmatched patron, an unreadable due date — names the
report it came from, and the import summary breaks the counts down per report.

**Why this priority**: With one file, "the circulation report" was unambiguous. With
five, a librarian who is told a due date could not be read has no way to act on it
unless she knows which week's export to look at. It also makes a botched export
visible: a report that came through with no rows looks exactly like a quiet week.

**Independent Test**: Load reports where week 1 has an unmatched patron and week 2 has
an unreadable due date; confirm the "Set aside" screen attributes each to the right file.

**Acceptance Scenarios**:

1. **Given** several reports, **When** the import summary is shown, **Then** each report
   is listed with its row count, its overdue count, and how many students it was the
   first to disqualify.
2. **Given** a report with a header row and no data rows, **When** the summary is shown,
   **Then** that report is listed and called out rather than silently omitted.
3. **Given** a set-aside circulation row, **When** it is displayed, **Then** it names the
   report it came from. Roster rows, having one possible source, name the roster.

---

### User Story 3 - Carry a school year of weekly history across the change (Priority: P1)

A librarian who has already run weekly drawings loads her existing backup file, or opens
the updated app on a Chromebook that already holds weekly history, and whose-turn-it-is
is exactly as it was.

**Why this priority**: Turn-taking is the fairness promise. Losing it mid-year would put
children back into rounds they have already had a turn in, and the failure would only
show up as an argument in front of a class.

**Independent Test**: Load a v1 backup with four weekly wins and confirm all four
survive, each filed under the month it was drawn in.

**Acceptance Scenarios**:

1. **Given** a backup file written by the weekly version, **When** it is loaded, **Then**
   every win is kept, each filed under the calendar month of the date it was drawn, and
   the librarian is told the migration happened.
2. **Given** a browser cache holding weekly wins, **When** the updated app starts,
   **Then** the same migration happens and no win is lost.
3. **Given** a month that contains several migrated weekly wins, **When** turn-taking is
   evaluated, **Then** every one of those students is still counted as having had a turn.

## Requirements *(mandatory)*

Requirements are numbered continuing from `001`, and amend it where noted.

- **FR-101**: The app MUST accept one patron roster and one or more circulation reports
  in a single import, in any selection order, identified by column headers rather than
  file name.
- **FR-102**: Files MUST accumulate across successive uses of the file picker, and any
  chosen file MUST be removable before the import runs.
- **FR-103**: The same file MUST NOT be counted twice within one import.
- **FR-104**: A student MUST be ineligible for the month's drawing when ANY of the
  imported circulation reports shows them holding a genuinely overdue item. This amends
  FR-008 from `001`; it does NOT amend FR-009 — fines, lost-book charges, and refunds
  still do not disqualify.
- **FR-105**: A later report showing an item returned MUST NOT restore eligibility for
  that month.
- **FR-106**: Overdue status MUST be evaluated against the drawing date. Export dates are
  not present in the files, and evaluating against the drawing date only ever widens the
  disqualified set, which is the safe direction.
- **FR-107**: A drawing period MUST be the calendar month of the drawing date. This
  amends FR-015 from `001`, which used the ISO week.
- **FR-108**: At most one winner per homeroom per calendar month MUST be recorded; a
  replacement MUST remain explicit and confirmed, as in FR-034.
- **FR-109**: The import summary MUST report, per circulation report: its file name, its
  row count, its overdue row count, and the number of students it was the first report
  to disqualify. Those last figures MUST sum to the total number of students sitting out.
- **FR-110**: A circulation report contributing no data rows MUST still be listed in the
  summary and called out.
- **FR-111**: Every set-aside circulation row MUST name the report it came from.
- **FR-112**: Winner history written by the weekly version (backup format v1, or a
  browser cache holding `weekKey`) MUST be read without loss, each win filed under the
  calendar month of its recorded drawing date. The librarian MUST be told when a backup
  file was migrated.
- **FR-113**: A migrated month holding more than one win MUST be preserved as recorded.
  FR-108 governs new drawings, not history.

### Key Entities

- **CirculationRow** gains `sourceFile`, the report it was read from.
- **SetAsideRow** gains `sourceFile`, null for roster rows.
- **ImportSummary** replaces `circulationFileName` with `circulationFiles`, a per-report
  breakdown, and gains `studentsBlockedByOverdue`.
- **WinRecord** replaces `weekKey` with `monthKey` (`YYYY-MM`).
- **DrawingSession** (was `WeekSession`) holds `circulationFileNames` rather than one name.

## Success Criteria *(mandatory)*

- **SC-101**: A student overdue in exactly one of a month's reports does not appear in
  any candidate list for that month, and does appear the following month.
- **SC-102**: Importing the same circulation report N times changes no candidate list.
- **SC-103**: A roster of ~1,000 students plus five circulation reports of 300 rows each
  imports in under 3 seconds, holding the budget from SC-002.
- **SC-104**: A v1 backup of N weekly wins loads as N wins, with no student losing or
  gaining a turn in any round.

## Out of Scope

- Naming or choosing a period by hand. The month comes from the drawing date.
- Any weekly drawing mode. The app runs monthly drawings only.
- Reading a report's own export date. The files do not carry one.
