# Library Reward

A weekly prize drawing for an elementary school library. Each week it takes the two
spreadsheets exported from the library system, works out which children in each
homeroom can win, and runs a playful animated drawing in front of the class.

Two rules decide who can win:

1. **Only a genuinely overdue book keeps a child out.** Fines, lost-book charges,
   and refunds do not.
2. **Everyone gets a turn before anyone repeats.** Once a child wins, they sit out
   of their homeroom's drawings until every classmate has had a turn; then the
   round starts over and everyone is back in.

Everything happens on the Chromebook. Nothing is uploaded, and the app makes no
network requests of any kind.

---

## For the librarian

### Setting up, once

Save `LibraryReward.html` somewhere you can find it — Downloads, or a folder in
Google Drive. That single file *is* the app.

### Every week

1. **Export the two reports** from the library system:
   - the **patron roster** (needs Name, Barcode, Patron Type, Status, Homeroom)
   - the **circulation report** showing **checked-out items with their due dates**
2. **Open `LibraryReward.html`** from the Files app. It opens in Chrome and works
   with no internet.
3. **Choose the two files.** Either order is fine — the app works out which is
   which. It then shows you what it read: how many students, how many homerooms,
   and **how many overdue items it found**.
4. **Pick a homeroom.** You'll see how many children can win this week and how many
   are still waiting for their turn this round.
5. **Draw.** The names shuffle and slow to a stop on the winner. There's a skip
   button if a class is short on time.
6. **Work through the homerooms.** Drawn ones are marked; the rest stay on the list.
7. **Save the backup file** at the end of the session, from the Backup screen, and
   move it into your Google Drive folder.
8. **Print or export** the week's winners to hand out prizes.

### Why the backup file matters

The backup file is what remembers whose turn it is. The app also keeps a copy
inside the browser, but a school Chromebook can be reset, reimaged, or handed to
someone else, and that copy would go with it. The backup file is the one you can
hold on to. Save it every week; it takes one click.

If the app ever tells you it isn't saving anything between sessions, load the
backup at the start of each session and save it again at the end.

### Things the app will tell you instead of hiding

- A homeroom where nobody can win this week.
- A child on the circulation report who isn't on the roster.
- A checked-out book whose due date it couldn't read.
- **A week where it found zero overdue items** — so you can tell "everyone
  returned their books" apart from "I exported the wrong report".

### What the children never see

Overdue books, fines, and whose turn has already been taken are never shown on the
drawing screen. The reveal cycles only through the names of children who can win.

---

## For a developer

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # domain, parsing, storage, and integration suites
npm run lint
npm run build    # -> dist/LibraryReward.html, one self-contained file
```

### The shape of it

| Area | What lives there |
|---|---|
| `src/domain/` | Who can win, whose turn it is, who was drawn. Pure functions, no DOM, no clock, no global randomness — "today" and the RNG are injected so the fairness rules are testable. |
| `src/parsing/` | Reading `.xlsx` directly (unzip with `fflate`, then `DOMParser`), Excel serial dates, locating columns by header text. |
| `src/storage/` | `localStorage` plus the versioned JSON backup file. |
| `src/ui/`, `src/app/` | Screens and the one place session state meets persistent history. |

The build emits a **single file with an inline classic script** and no external
references at all. `scripts/check-single-file.mjs` enforces that on every build:
exactly one file in `dist/`, no `http(s)` or relative asset references, no
`type="module"`, no dynamic `import()`, no `Worker`. Those constraints come from
`file://`, which is how the app is opened on a Chromebook — see
`specs/001-weekly-prize-drawing/research.md` R2.

Two things that look like details but are not:

- The bundle is a **classic** inline script, which does not defer the way a module
  script does. `src/main.tsx` waits for `DOMContentLoaded` so it cannot run before
  `#root` exists.
- The real exports write every cell as an **inline string** with an empty
  `sharedStrings.xml`. A reader that only handles shared strings reads the whole
  workbook as blank.

### Documentation

`specs/001-weekly-prize-drawing/` holds the specification, the plan, the research
decisions, the data model, the contracts for both input files and the backup file,
and the task list.
