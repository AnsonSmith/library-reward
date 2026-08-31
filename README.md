# Library Reward

A monthly prize drawing for an elementary school library. Once a month it takes the
roster plus that month's weekly circulation reports, works out which children in
each homeroom can win, and runs a playful animated drawing in front of the class.

Three rules decide who can win:

1. **Only a genuinely overdue book keeps a child out.** Fines, lost-book charges,
   and refunds do not.
2. **One overdue book anywhere in the month costs the whole month.** You give the
   app every weekly circulation report from the month; a child who appears overdue
   in *any* of them sits out that month's drawing, even if a later report shows the
   book back on the shelf. Returning it late doesn't un-ring the bell — but it
   costs them that month only, and they're back in the pool next month.
3. **Everyone gets a turn before anyone repeats.** Once a child wins, they sit out
   of their homeroom's drawings until every classmate has had a turn; then the
   round starts over and everyone is back in.

Everything happens on the Chromebook. Nothing is uploaded, and the app makes no
network requests of any kind.

---

## For the librarian

### Setting up, once

Save `LibraryReward.html` somewhere you can find it — Downloads, or a folder in
Google Drive. That single file *is* the app.

### Through the month

**Export the circulation report each week** from the library system, showing
**checked-out items with their due dates**, and keep the files together in one
folder. Name them however you like — the app identifies each file by its columns,
not its name, and the job number in the export's name changes every week anyway.

### On drawing day

1. **Export the patron roster** (needs Name, Barcode, Patron Type, Status,
   Homeroom). One roster, exported fresh, so it reflects who is in each class now.
2. **Open `LibraryReward.html`** from the Files app. It opens in Chrome and works
   with no internet.
3. **Choose the files**: the roster, plus every circulation report from the month.
   Any order, and you can add them a few at a time if they're in different folders.
   The app then shows you what each file turned out to be, and what it read from
   them: how many students, how many homerooms, **how many overdue items per
   report**, and **how many children are sitting this month out**.
4. **Pick a homeroom.** You'll see how many children can win this month and how
   many are still waiting for their turn this round.
5. **Draw.** The names shuffle and slow to a stop on the winner. There's a skip
   button if a class is short on time.
6. **Work through the homerooms.** Drawn ones are marked; the rest stay on the list.
7. **Save the backup file** at the end of the session, from the Backup screen, and
   move it into your Google Drive folder.
8. **Print or export** the month's winners to hand out prizes.

If you miss a week's export, the drawing still runs — it just won't know about that
week's overdue books. The per-report table on the first screen shows you exactly
which weeks you handed it, so a missing one is visible before you draw.

### Why the backup file matters

The backup file is what remembers whose turn it is. The app also keeps a copy
inside the browser, but a school Chromebook can be reset, reimaged, or handed to
someone else, and that copy would go with it. The backup file is the one you can
hold on to. Save it every drawing day; it takes one click.

If the app ever tells you it isn't saving anything between sessions, load the
backup at the start of each session and save it again at the end.

### Things the app will tell you instead of hiding

- A homeroom where nobody can win this month.
- A child on a circulation report who isn't on the roster.
- A checked-out book whose due date it couldn't read.
- **A report that came through with no rows in it** — an export that went wrong
  looks exactly like a quiet week otherwise.
- **A month where it found zero overdue items** — so you can tell "everyone
  returned their books" apart from "I exported the wrong report".

Everything it sets aside is listed on the "Set aside" screen, and each row names
the report it came from, so you know which week's export to look at again.

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
| `src/domain/` | Who can win, whose turn it is, who was drawn. Pure functions, no DOM, no clock, no global randomness — "today" and the RNG are injected so the fairness rules are testable. A drawing period is a calendar month (`monthKey.ts`), derived from the drawing date so nobody has to set it. |
| `src/parsing/` | Reading `.xlsx` directly (unzip with `fflate`, then `DOMParser`), Excel serial dates, locating columns by header text. |
| `src/storage/` | `localStorage` plus the versioned JSON backup file. Backup format v2 stores a `monthKey` per win; v1 files (weekly, `weekKey`) are still read and migrated by the date each win was drawn — see `migrateWins.ts`. |
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

### The hosted build is live

**https://ansonsmith.github.io/library-reward/**

Use that URL, not the `ansonsmith.com` one GitHub reports. This account has a
user-level custom domain, so the Pages API advertises
`http://ansonsmith.com/library-reward/` — but that domain has no certificate, so
it only answers over plain HTTP. This app needs a secure context: service workers
refuse to register over HTTP, and so does "Install page as app". The `github.io`
address serves the same bytes over HTTPS today.

### Publishing the hosted build

`.github/workflows/deploy.yml` runs lint, tests, and both builds, then publishes
`dist-web/` to GitHub Pages on a push to `main`. Enable it under
**Settings → Pages → Source: GitHub Actions**.

The workflow refuses to publish if any `.xlsx` file is tracked in the repository.

### Student data and this repository

**Done:** the two spreadsheet exports were purged from git history on 2026-08-30.
They had been committed in the original root commit and contained roughly a
thousand children's names and library barcodes. History was rewritten with
`git filter-branch`, the backup refs and reflog were expunged, and the objects
were garbage-collected. Nothing matching `*.xlsx` remains in any commit or in the
object store.

The files still sit in the working directory, where the routine needs them, and
`.gitignore` now keeps them untracked. Verify at any time:

```bash
git rev-list --objects --all | grep -i '\.xlsx$'   # expect no output
git ls-files | grep -i '\.xlsx$'                   # expect no output
```

`.github/workflows/deploy.yml` refuses to publish if either check ever starts
producing output, so a future accidental `git add` cannot reach GitHub Pages.

Keep it that way: the exports belong on disk and in Google Drive, never in a
commit.

### Documentation

`specs/001-weekly-prize-drawing/` holds the specification, the plan, the research
decisions, the data model, the contracts for both input files and the backup file,
and the task list. It describes the original weekly drawing; the move to monthly
drawings with pooled circulation reports is documented in
`specs/002-monthly-prize-drawing/spec.md`.
