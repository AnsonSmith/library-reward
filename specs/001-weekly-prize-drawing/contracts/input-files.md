# Contract: Weekly Spreadsheet Inputs

**Consumer**: `src/parsing/` | **Producer**: the school's library system, exported manually each week

The app locates columns **by header text**, case-insensitively and whitespace-tolerant, on the first row of the first worksheet. Column order may change between weeks; header wording may not. If a required header is absent, the app refuses the file and names the missing column (FR-005) rather than guessing by position.

---

## File A — Patron roster (`PatronNameList*.xlsx`)

Observed: 1,071 rows (1 header + 1,070 patrons) in the reference export.

| Header | Required | Used for |
|---|---|---|
| `Name` | yes | Display name shown to the class |
| `Barcode` | yes | **Join key** and persistent student identity |
| `Patron Type` | yes | Keep `Student`, set aside `Faculty`/other (FR-007) |
| `Status` | yes | Keep `Active`, set aside `Inactive` (FR-007) |
| `Homeroom` | yes | Grouping; blank → `(No homeroom listed)` (FR-014) |
| `District ID` | no | Displayed only; never used to match (see research R5) |
| `Graduation Year`, `Card Expires` | no | Ignored |

**Reference values**: `Patron Type` ∈ {`Student` (978), `Faculty` (92)}; `Status` ∈ {`Active` (1,063), `Inactive` (7)}. Of the 978 student rows, **975 are Active**; they fall into **67 distinct homerooms**, with **7 active students** carrying a blank homeroom (10 student rows are blank, 3 of them inactive). Barcodes are shaped `000100001`, `020100008`, `000100005`, and `P 4242` for faculty.

**Cell encoding note**: the real exports write every text cell as an **inline string** (`t="inlineStr"`) and ship an empty `sharedStrings.xml`. A reader that only handles shared strings reads the entire workbook as blank.

---

## File B — Circulation / outstanding items (`PatronCircReport*.xlsx`)

Observed: 18 rows (1 header + 17 records) in the reference export.

| Header | Required | Used for |
|---|---|---|
| `Patron Barcode` | yes | **Join key** back to the roster |
| `Due` | yes | Overdue determination (FR-009); may be blank on non-checkout rows |
| `Patron Name` | no | Shown when a row matches no roster entry |
| `Transaction Type` | no | Secondary signal for "looks like a checkout" |
| `Fine Reason`, `Title/Description`, `Call Number` | no | Data-quality display only |

**Crucially, this file has no `Homeroom` column.** All homeroom grouping comes from File A.

**Overdue rule**: a row disqualifies its student when `Due` parses to a calendar date strictly earlier than the drawing date. Blank `Due` → not overdue. Unparseable `Due` on a checkout-looking row → reported as undeterminable, never silently cleared (FR-011).

**Known gap in the reference export**: all 17 rows are `Unpaid Fines & Refunds` with an empty `Due` column and no overdue checkouts, so this file disqualifies nobody under the rule above. The app must handle a zero-overdue week as valid and report it explicitly (FR-006). Confirm with the librarian that an export containing checked-out items with due dates is available.

---

## Cell-level expectations

- **Strings** arrive as shared strings (`t="s"`) or inline strings; both are supported.
- **Dates** arrive as Excel serial numbers (observed: `45798.55032407407`) or as text. Serials convert as days since 1899-12-30, honoring the 1900 leap-year quirk.
- **Rows are sparse** — a row element may omit cells entirely; absent cells read as empty, not as a shifted column.
- **Leading zeros** on barcodes may be present or stripped depending on how the file was handled; normalization absorbs this.

## File identification (FR-004)

A file is the roster if its headers include `Patron Type` and `Homeroom`; the circulation report if they include `Patron Barcode` and `Due`. If the two selections are swapped, the app corrects or rejects the pairing and explains which file belongs in which slot. If neither file matches either shape, it says so rather than producing an empty candidate list.
