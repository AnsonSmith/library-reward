# Feature Specification: Weekly Homeroom Prize Drawing

**Feature Branch**: `001-weekly-prize-drawing`
**Created**: 2026-08-30
**Status**: Draft
**Input**: User description: "I want to generate a standalone app that my wife (an elementary school librarian) can run each week. We will pick one student from each homeroom that has returned their library book that week (no outstanding late checkouts) and they will win a prize. We will supply two excel files each week, 1 will be a roster of each student (with student id and homeroom columns) PatronNameListJob829811.xlsx in this example, and 2 will be a list of students with overdue books (also with student ids, and homeroom columns) PatronCircReportJob829808.xlsx in this example. we will need to process those files and create a list of potential winners for each homeroom (student roster - students with overdue books). We should then give the teacher an easy way to select a homeroom and select a random winner for that week. Since this for an elementary school, this selection process sould be fun and whimsical."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build this week's eligible list from the two reports (Priority: P1)

The librarian starts the app, points it at the week's two exported spreadsheets (the patron roster and the outstanding-items report), and immediately sees every homeroom with the list of students who can win this week — the active students in that homeroom, minus anyone holding an overdue item, minus anyone who has already won during the current round. She can confirm the numbers look right before anything is drawn.

**Why this priority**: This is the entire data foundation and, on its own, already replaces the manual spreadsheet cross-referencing the librarian does today. Even with no drawing feature at all, a correct per-homeroom candidate list delivers the core value.

**Independent Test**: Supply the two sample files, confirm the app reports 975 active students across 67 homerooms, shows each homeroom's candidate count, and that every student holding an overdue item is absent from the candidate lists.

**Acceptance Scenarios**:

1. **Given** a roster file and an outstanding-items file for the week, **When** the librarian loads both, **Then** the app displays a list of homerooms, each with a count of students who can win this week and the ability to view their names.
2. **Given** a student holding an item whose due date has passed, **When** the candidate lists are built, **Then** that student does not appear as a candidate in any homeroom.
3. **Given** a student who appears on the report only for a fine, a lost-book charge, or a refund, **When** the candidate lists are built, **Then** that student remains a candidate.
4. **Given** an outstanding-items report containing several overdue rows for the same student, **When** the candidate lists are built, **Then** that student is excluded once and no error is raised.
5. **Given** the two files are selected in the wrong order (outstanding-items file chosen as the roster), **When** the librarian loads them, **Then** the app detects the mismatch and explains which file is expected in which slot rather than producing a wrong list.
6. **Given** a roster containing faculty and inactive patrons, **When** the candidate lists are built, **Then** only active students appear as candidates.

---

### User Story 2 - Draw a winner with a fun, whimsical reveal (Priority: P1)

The librarian picks a homeroom, starts the drawing, and the app plays a short, playful animated reveal (building suspense, then celebrating) before landing on one randomly chosen candidate. The reveal is designed to be projected in front of a class of elementary students.

**Why this priority**: This is the moment the feature exists for. It is what the students see, and it is what turns a spreadsheet chore into a weekly event.

**Independent Test**: With candidate lists loaded, select any homeroom, run the draw, and confirm a single candidate from that homeroom is announced with an animated reveal, and that repeated draws over many runs produce different students.

**Acceptance Scenarios**:

1. **Given** a homeroom with multiple candidates, **When** the librarian starts the draw, **Then** an animated reveal plays and exactly one candidate from that homeroom is announced as the winner.
2. **Given** a homeroom with exactly one candidate, **When** the draw runs, **Then** that student is announced (the reveal still plays) and the app notes the draw had only one candidate.
3. **Given** a homeroom where every remaining student in the current round holds an overdue item, **When** the librarian selects it, **Then** the app clearly says no one can win this week and offers no draw rather than failing.
4. **Given** a drawing is in progress, **When** the librarian wants to move on quickly, **Then** the reveal can be skipped to the result immediately.
5. **Given** repeated draws on the same candidate list, **When** run many times, **Then** every candidate is capable of being selected and no candidate is favored beyond ordinary chance.

---

### User Story 3 - Give every student a turn before anyone repeats (Priority: P1)

Across the school year, each homeroom works through a round: once a student has won, they sit out of that homeroom's drawings until every classmate has had a turn, and then the round starts over and everyone is back in. The librarian can see how many students in each homeroom are still waiting for their turn.

**Why this priority**: The turn-taking rule changes who is even in the pool, so it belongs with the drawing itself rather than as a later addition. It is also the fairness promise the librarian makes to a class of elementary students, and getting it wrong is visible and upsetting to them.

**Independent Test**: Run repeated weekly drawings for one homeroom with all students eligible, and confirm every student wins exactly once before any student wins a second time, and that the round restarts cleanly afterward.

**Acceptance Scenarios**:

1. **Given** a student who won earlier in the current round, **When** later drawings run for their homeroom, **Then** they are not a candidate.
2. **Given** a homeroom where every student has now won, **When** the next drawing runs, **Then** the round resets and all students in that homeroom are candidates again.
3. **Given** a homeroom mid-round, **When** the librarian views it, **Then** she sees how many students have won and how many are still waiting for a turn.
4. **Given** a student added to the roster mid-year, **When** they first appear, **Then** they join the current round as not-yet-won and can be drawn.
5. **Given** a student who won and later left the school, **When** the round completes, **Then** their absence does not prevent the round from resetting.
6. **Given** a new school year, **When** the librarian starts it, **Then** she can clear the turn-taking history so every student begins fresh.
7. **Given** a winner recorded by mistake, **When** the librarian corrects the record, **Then** that student returns to the pool of students still waiting for a turn.

---

### User Story 4 - Work through all homerooms and keep the week's winners (Priority: P2)

The librarian moves homeroom by homeroom in one sitting. The app shows which homerooms have already been drawn and which are still pending, keeps the week's winners in one place, and lets her print or export the finished list to hand out prizes and share with teachers.

**Why this priority**: 67 homerooms is too many to track in one's head; without this the librarian loses her place and cannot hand the results to anyone. Valuable, but the drawing itself works without it.

**Independent Test**: Draw winners for several homerooms, confirm each drawn homeroom is marked complete with its winner shown, and export or print the week's winner list containing exactly those results.

**Acceptance Scenarios**:

1. **Given** several homerooms have been drawn, **When** the librarian views the week's summary, **Then** she sees each drawn homeroom with its winner and each remaining homeroom marked as not yet drawn.
2. **Given** a completed week, **When** the librarian exports or prints the winners, **Then** the output lists homeroom and winning student for every homeroom drawn that week.
3. **Given** a homeroom that was already drawn this week, **When** the librarian re-draws it, **Then** the app warns that a winner already exists and requires confirmation before replacing it, and the replaced student returns to the pool of students still waiting for a turn.
4. **Given** the app is closed and reopened during the same week's session, **When** the librarian returns, **Then** the week's drawn winners are still present without re-importing the files.

---

### User Story 5 - See what the files could not tell us (Priority: P3)

After loading the files, the librarian can review a short data-quality summary: rows on the outstanding-items report that matched no roster student, rows that were not overdue and therefore did not disqualify anyone, students with no homeroom listed, and inactive or non-student patrons that were set aside.

**Why this priority**: Protects against silently awarding a prize to a student who actually has an overdue book, and against a homeroom quietly going missing. Useful, but the weekly routine works without it.

**Independent Test**: Load files containing a known unmatched outstanding-items row and a known blank-homeroom student, and confirm both appear in the data-quality summary with counts and identifying details.

**Acceptance Scenarios**:

1. **Given** an outstanding-items row whose student identifier matches no roster entry, **When** the files are loaded, **Then** that row is listed in the data-quality summary rather than being silently ignored.
2. **Given** an outstanding-items report whose rows are all fines and refunds with no overdue items, **When** the files are loaded, **Then** the app states that it found zero overdue items and how many non-overdue rows it set aside, so the librarian can tell "nobody is overdue" apart from "the wrong report was exported."
3. **Given** roster students with a blank homeroom, **When** the files are loaded, **Then** they are reported in the summary and grouped under a clearly labeled "No homeroom listed" group rather than being mixed into a real homeroom.
4. **Given** the outstanding-items report is empty, **When** the files are loaded, **Then** every active student still waiting for a turn is a candidate and the app states this plainly rather than treating it as an error.

---

### Edge Cases

- **Wrong or unreadable file**: A selected file is not one of the two expected reports, is corrupt, is password-protected, or is open in another program — the app explains the problem in plain language and lets the librarian pick a different file.
- **Missing expected column**: A report is missing a required column (student identifier, homeroom, patron type, status, due date) — the app names the missing column and the file it was expected in, and refuses to produce a partial list.
- **No overdue rows at all**: The export contains only fines, refunds, and lost-book charges — nobody is disqualified. The app says so explicitly rather than presenting a full candidate list as if it had checked.
- **Missing or unreadable due dates**: An overdue-looking row has a blank or unparseable due date — the row cannot be judged, so it is surfaced in the data-quality summary rather than silently treated as "not overdue."
- **Due today**: An item due on the day of the drawing is not yet overdue and does not disqualify.
- **Identifier formatting drift**: Student identifiers with leading zeros, extra spaces, or a barcode prefix are matched consistently between the two files so that a student with an overdue book is never treated as a candidate because of formatting alone.
- **Duplicate roster entries**: The same student appears more than once on the roster (for example an old inactive record and a current active one) — the student appears at most once in a homeroom's candidate list and holds one turn-taking record, not two.
- **Homeroom with no candidates**: Every remaining student in the round holds an overdue item — the homeroom is shown as "no one can win this week" and is not silently dropped from the list.
- **Round completes mid-week**: The last untaken turn in a homeroom is drawn — the round resets so the homeroom is ready for the following week.
- **Very small homerooms**: A homeroom with one or two students draws normally, and its round resets after one or two weeks.
- **Stale files**: The librarian loads last week's files again, or two files exported on different dates — the app shows the file names and export dates it is working from so the mismatch is visible.
- **Interrupted drawing**: The app is closed mid-reveal — no partial or phantom winner is recorded, and no turn is consumed.
- **New week**: The librarian loads a new week's files — starting a new week's drawings does not erase previous weeks' recorded winners or reset turn-taking.

## Requirements *(mandatory)*

### Functional Requirements

**Importing the weekly files**

- **FR-001**: The librarian MUST be able to run the app on a single ordinary school computer without installing separate database software, creating an account, or sending student data anywhere off that computer.
- **FR-002**: The librarian MUST be able to select the two weekly spreadsheet files by browsing for them, without renaming them, editing them, or converting them first.
- **FR-003**: The app MUST accept the reports in the format they are exported in today, including the file naming pattern that changes each week (for example `PatronNameListJob829811.xlsx` and `PatronCircReportJob829808.xlsx`), locating the columns it needs by their headers rather than by fixed positions.
- **FR-004**: The app MUST identify which loaded file is the roster and which is the outstanding-items report and correct or reject a swapped selection.
- **FR-005**: The app MUST report, in plain non-technical language, any file it cannot read or that is missing a column it needs, naming the file and the specific problem.
- **FR-006**: The app MUST display, for the loaded data, the file names it used, the number of roster rows read, and the number of outstanding-items rows read and how many of those were overdue, so the librarian can confirm she loaded the right week's reports.

**Determining who can win**

- **FR-007**: The app MUST treat only active student patrons as candidates, excluding faculty and other non-student patron types and excluding inactive records.
- **FR-008**: The app MUST match students between the two reports using the student identifier shared by both reports, normalizing incidental formatting differences (leading zeros, surrounding whitespace, barcode prefixes) before comparing.
- **FR-009**: The app MUST disqualify a student only when the outstanding-items report shows them holding an item whose due date has passed as of the day of the drawing. Fines, lost-book charges, and refunds MUST NOT by themselves disqualify a student.
- **FR-010**: The app MUST treat an item due on the day of the drawing as not yet overdue.
- **FR-011**: The app MUST surface, rather than silently ignore, any row that appears to be a checkout but whose due date is missing or unreadable, so a genuinely overdue student is never quietly turned into a candidate.
- **FR-012**: The app MUST group candidates by the homeroom recorded on the roster, and MUST derive homerooms from the roster rather than from the outstanding-items report.
- **FR-013**: The app MUST list each student at most once per homeroom even when the source reports contain duplicate rows for that student.
- **FR-014**: The app MUST place roster students with no homeroom value into a clearly labeled separate group rather than into a real homeroom, and MUST allow that group to be skipped.
- **FR-015**: The app MUST show, for each homeroom, the number of students who can win this week and allow the librarian to view their names before drawing.

**Taking turns across the school year**

- **FR-016**: The app MUST exclude from a homeroom's drawing any student who has already won in that homeroom's current round.
- **FR-017**: The app MUST start a new round for a homeroom once every student in it has won, returning all of that homeroom's students to the pool.
- **FR-018**: The app MUST track rounds independently per homeroom, so one homeroom completing a round does not affect any other.
- **FR-019**: The app MUST remember who has won across weeks and across separate imports, without relying on the weekly files to carry that history.
- **FR-020**: The app MUST show, for each homeroom, how many students have won in the current round and how many are still waiting for a turn.
- **FR-021**: The app MUST treat a student who first appears on the roster mid-year as not yet having won, placing them in the current round.
- **FR-022**: The app MUST complete a round based on the students currently on the roster, so that students who have left the school do not block a round from resetting.
- **FR-023**: The librarian MUST be able to correct or remove a recorded winner, which returns that student to the pool of students still waiting for a turn.
- **FR-024**: The librarian MUST be able to clear turn-taking history for a new school year, for all homerooms at once or for a single homeroom.

**Drawing a winner**

- **FR-025**: The librarian MUST be able to select any homeroom from a clearly organized list and start a drawing for it in no more than two actions.
- **FR-026**: The app MUST select exactly one winner per drawing, chosen at random from that homeroom's candidates, with every candidate equally likely to be selected.
- **FR-027**: The app MUST present the selection as an animated, celebratory reveal suitable for elementary-age students watching on a projector or classroom display, with a build-up before the winner is shown.
- **FR-028**: The app MUST display the winner's name large enough to be read from the back of a classroom.
- **FR-029**: The librarian MUST be able to skip the animation and go straight to the result.
- **FR-030**: The app MUST refuse to draw for a homeroom with no candidates and MUST state why in child-appropriate, non-blaming language.
- **FR-031**: The app MUST NOT reveal any student's overdue, fine, or turn-taking status to the class during the drawing; students who cannot win are simply absent from the drawing.

**Recording and sharing results**

- **FR-032**: The app MUST record each drawing's homeroom, winning student, the date drawn, the round it belonged to, and how many candidates were in the pool.
- **FR-033**: The app MUST show which homerooms have been drawn this week and which are still pending.
- **FR-034**: The app MUST warn and require confirmation before replacing an existing winner for a homeroom already drawn this week.
- **FR-035**: The app MUST retain the week's recorded winners if it is closed and reopened, without requiring the files to be imported again.
- **FR-036**: The librarian MUST be able to produce a printable or shareable list of the week's winners by homeroom.
- **FR-037**: The app MUST retain past weeks' winner records when a new week's files are loaded.

**Data quality and trust**

- **FR-038**: The app MUST report outstanding-items rows that matched no roster student, including enough detail for the librarian to look them up.
- **FR-039**: The app MUST report counts of records set aside and why (faculty, inactive, no homeroom listed, unmatched, not overdue, undeterminable due date, already won this round).
- **FR-040**: The app MUST keep all imported student data on the librarian's computer and MUST allow her to clear imported data.

### Key Entities

- **Roster Entry**: One patron row from the weekly roster export — name, student identifier, patron type (student or faculty), status (active or inactive), and homeroom. The source of truth for who exists and which homeroom they belong to.
- **Outstanding Item Record**: One row from the weekly circulation export — the student identifier, the kind of obligation (checked-out item, fine, lost book, refund), the item, and its due date. Only rows with a due date in the past disqualify a student.
- **Homeroom**: A named group of students, identified by the homeroom value on the roster (in practice the homeroom teacher's name). The unit a prize is awarded within, and the unit a turn-taking round belongs to.
- **Candidate**: An active student who belongs to a homeroom, holds no overdue item this week, and has not yet won in their homeroom's current round.
- **Award Round**: One pass through a homeroom in which each student wins at most once; it completes when every current student has won, after which a new round begins.
- **Weekly Import**: One pairing of a roster file and an outstanding-items file for a given week, with the file names, when it was imported, and the resulting counts.
- **Drawing Result**: One homeroom's winner for one week — homeroom, winning student, the date drawn, the round, and how many candidates were in the pool.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Starting from the two exported files, the librarian can see complete per-homeroom candidate lists in under 2 minutes, with no manual spreadsheet editing, sorting, or formula work.
- **SC-002**: For a roster of roughly 1,000 students and 70 homerooms, candidate lists are ready within 10 seconds of selecting the files.
- **SC-003**: 100% of students holding an item whose due date has passed are absent from every candidate list, and 100% of students listed only for fines or refunds remain candidates, verified against the source files.
- **SC-004**: The librarian can complete drawings for all homerooms in a single sitting in under 20 minutes, including the animated reveals.
- **SC-005**: Selecting a homeroom and starting its drawing takes no more than two actions.
- **SC-006**: The librarian, who is not a technical user, can complete the entire weekly routine unaided after one walkthrough, with no reference to written instructions on the second week.
- **SC-007**: Across a simulated school year of weekly drawings for a homeroom, every student wins exactly once before any student wins a second time.
- **SC-008**: Within a single round, over 1,000 simulated drawings, no remaining candidate's selection rate deviates from equal chance by a margin that would be noticeable across a school year.
- **SC-009**: Every file problem the librarian encounters (wrong file, missing column, unreadable file, no overdue rows found) produces a message that names the file and the problem, with zero unexplained failures or silently empty results.
- **SC-010**: The week's winners can be produced as a printable list in under 1 minute after the last drawing.
- **SC-011**: No student's overdue, fine, or turn-taking status is visible on any screen shown to a class.

## Assumptions

- **Deployment**: The app is standalone and runs on the librarian's own school computer for a single user. No server, network access, hosting, accounts, or logins are required, and student data never leaves that computer. Multi-user access, remote access, and integration with the library system's database are out of scope.
- **File supply**: The two spreadsheets are exported manually from the library system each week and handed to the app. The app does not connect to the library system directly. File names carry a changing job number and are not relied upon for identification.
- **Weekly circulation export must include overdue items**: Because only genuinely overdue items disqualify a student, the weekly circulation export must list checked-out items with their due dates. The sample `PatronCircReportJob829808.xlsx` contains only `Unpaid Fines & Refunds` rows with an empty `Due` column, so under this rule it would disqualify nobody. Confirming the correct report (or report options) is a prerequisite for the feature to do anything meaningful.
- **File shape**: Based on the sample files, the roster provides name, district ID, patron type, barcode, status, graduation year, card expiry, and homeroom; the circulation report provides patron name, patron barcode, transaction type, due date, call number, item barcode, title, price, fine reason, fine date, and fine amount. Column headers are stable week to week even if row counts change.
- **Matching key**: The patron barcode is the reliable join between the two reports. In the sample data all 17 circulation rows matched a roster barcode, whereas the district ID is blank for some students and duplicated for others, so barcode is used as the identifier.
- **Homeroom source**: The circulation report does not contain a homeroom column, contrary to the initial description, so homerooms come exclusively from the roster.
- **Scale**: Roughly 1,000 students, 70 homerooms, and fewer than a few hundred circulation rows per week. Performance targets assume this scale.
- **Eligibility definition**: "Returned their book this week" is implemented as "holds no overdue item as of the drawing," per the clarified rule. The app does not attempt to verify that a student actually checked out or returned a book that week.
- **Turn-taking scope**: Rounds are tracked per homeroom for the school year and are reset by the librarian when a new year begins. A student who changes homerooms mid-year is treated as a member of the homeroom currently on the roster; their prior wins do not follow them to the new homeroom.
- **Blank homerooms**: The 10 sample students with no homeroom value are grouped separately and can be skipped; they are not assigned to any teacher's homeroom.
- **Prizes**: Prize inventory, fulfillment, and delivery are out of scope. The app identifies winners only.
- **Notifications**: Emailing or messaging teachers, students, or parents is out of scope; sharing is by printing or exporting the winners list.
- **Privacy**: Student names and identifiers are treated as sensitive. Only names are shown during a classroom reveal, and no identifiers, obligation details, or turn-taking status are displayed to a class.
