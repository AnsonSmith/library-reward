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

### Two ways to deliver it

```bash
npm run build        # -> dist/LibraryReward.html      (primary: one file, file://)
npm run build:web    # -> dist-web/                    (fallback: GitHub Pages)
npm run preview:web  # serve the hosted build locally
```

Both builds come from the same source and behave identically: everything is
processed on the device and nothing is ever uploaded. They differ only in how the
page reaches the Chromebook.

| | Offline single file | Hosted on GitHub Pages |
|---|---|---|
| How she gets it | You send her the file; she saves it and double-clicks | She opens a URL once and installs it from Chrome's menu |
| Storage | `localStorage` on a `file://` origin — **must be verified**, see the spike | A normal `https://` origin, where storage behaves predictably |
| Offline | Always | After the first visit, via a service worker |
| Updates | You send a new file; she replaces the old one | Push to `main`; she gets it next time she opens it |
| Needs internet | Never | Once, to install |

**The offline build is the primary delivery.** The hosted build exists for the
case where `localStorage` on `file://` turns out to be unreliable on a managed
Chromebook — for instance where district policy clears browsing data at sign-out.

The hosted build adds exactly four files (`manifest.webmanifest`, `sw.js`, and two
icons) and nothing else; the offline build has no external references at all.
`scripts/check-single-file.mjs` enforces both shapes, and
`tests/integration/buildOutputs.test.ts` fails if either drifts.

### Publishing the hosted build

`.github/workflows/deploy.yml` runs lint, tests, and both builds, then publishes
`dist-web/` to GitHub Pages on a push to `main`. Enable it under
**Settings → Pages → Source: GitHub Actions**.

The workflow refuses to publish if any `.xlsx` file is tracked in the repository.

### Before this repo goes anywhere

**The two spreadsheet exports are committed in the root commit** (`24b0217`) and
contain roughly a thousand children's names and library barcodes. `.gitignore`
does not help — the files are already tracked, and ignore rules do not apply to
tracked files.

GitHub Pages on a free plan requires a **public** repository, so publishing this
repo as-is would publish that data. Before pushing anywhere:

```bash
# Stop tracking them (they stay on disk, and .gitignore covers them from now on)
git rm --cached PatronNameListJob829811.xlsx PatronCircReportJob829808.xlsx
git commit -m "Stop tracking student roster exports"

# Then remove them from history as well — they are in the root commit
pipx run git-filter-repo --invert-paths --path PatronNameListJob829811.xlsx --path PatronCircReportJob829808.xlsx
```

Alternatively, keep this repository private and publish only the built page from a
separate public repository containing nothing but `dist-web/`.

### Documentation

`specs/001-weekly-prize-drawing/` holds the specification, the plan, the research
decisions, the data model, the contracts for both input files and the backup file,
and the task list.
