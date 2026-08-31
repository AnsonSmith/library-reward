# Contract: Winner History Backup File

**Purpose**: the durable, portable system of record for turn-taking. Browser storage is treated as a cache of this file (research R2).
**Filename**: `library-reward-history-<schoolYear>.json`, e.g. `library-reward-history-2026-2027.json`
**Where it lives**: the librarian saves it into a Google Drive folder from the Chromebook's Files app, so it survives a wiped browser profile or a replaced device.

## Format

```json
{
  "format": "library-reward-history",
  "version": 1,
  "schoolYearLabel": "2026-2027",
  "exportedOn": "2026-08-30",
  "rounds": [
    { "homeroom": "Marigold, Rita", "currentRound": 2, "startedOn": "2026-11-14" }
  ],
  "wins": [
    {
      "id": "w_0a3f91",
      "homeroom": "Marigold, Rita",
      "round": 1,
      "studentMatchKey": "100001",
      "studentName": "Doe, Jane A",
      "drawnOn": "2026-09-04",
      "weekKey": "2026-W36",
      "candidatePoolSize": 22
    }
  ]
}
```

## Rules

- **`version` is checked on import.** An unknown (higher) version is refused with an explanation rather than partially read.
- **Import is a replace, not a merge**, and requires confirmation showing both sides: "this file has 214 wins through 2026-W36; you currently have 3. Replace?" Silent merging of two divergent histories would corrupt turn-taking in ways nobody could later untangle.
- **A file that fails validation changes nothing.** Parse and validate fully, then commit — never half-apply.
- `studentMatchKey` is the normalized barcode, so history keeps working when the roster export changes name formatting or leading zeros.
- The file contains student names and barcodes and is therefore treated as sensitive; the app warns once about where it is being saved.

## Round reconstruction

`rounds` is included for fidelity, but `currentRound` per homeroom is recomputable from `wins` alone against a current roster (research R7). If `rounds` is missing or inconsistent with `wins`, the app rebuilds it from `wins` and reports that it did so.
