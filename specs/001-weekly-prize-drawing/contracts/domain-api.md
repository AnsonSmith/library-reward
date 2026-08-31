# Contract: Domain API

**Module**: `src/domain/` — pure functions, no DOM, no storage, no clock, no global randomness. Everything the app must get *right* lives here so it can be tested exhaustively without a browser.

Two dependencies are always injected rather than read from the environment:

```ts
type Today = CalendarDate;          // the drawing date, passed in
type Rng = (upperBoundExclusive: number) => number;  // unbiased integer source
```

---

## identifiers.ts

```ts
function normalizeBarcode(raw: string): string;
```

Trim → uppercase → drop a leading `P` and any internal whitespace → strip leading zeros. Empty input returns `""`, which never matches anything.

**Guarantees**: idempotent (`f(f(x)) === f(x)`); `"000100001"`, `" 100001 "`, and `"100001"` all collapse to the same key; `"P 4242"` → `"4242"`. Normalization only ever widens matching — it must never cause two genuinely different students to collide, which is why the raw barcode is retained for display and audit.

---

## eligibility.ts

```ts
function determineOverdue(row: CirculationRow, today: Today): 
  "overdue" | "notOverdue" | "undeterminable";

function buildHomerooms(input: {
  roster: RosterEntry[];
  circulation: CirculationRow[];
  history: WinRecord[];
  rounds: RoundState[];
  today: Today;
}): { homerooms: Homeroom[]; summary: ImportSummary };
```

`buildHomerooms` is the heart of the app and applies, in order: student-only → active-only → group by homeroom (blank → `(No homeroom listed)`) → dedupe by `matchKey` → drop overdue holders → drop current-round winners.

**Guarantees**:
- Every roster row lands in exactly one bucket — candidate, or a counted set-aside reason in `summary`. Nothing vanishes.
- Every circulation row is either matched-and-classified or counted as unmatched. Nothing vanishes.
- A student holding one overdue item and five fines is excluded once.
- Blank homeroom students never join a real homeroom.
- Output is deterministic and independent of input row order.

---

## rounds.ts

```ts
function currentRoundFor(homeroom: string, rounds: RoundState[]): number;

function advanceRoundsIfComplete(input: {
  homerooms: Homeroom[];
  history: WinRecord[];
  rounds: RoundState[];
  today: Today;
}): RoundState[];

function turnsRemaining(homeroom: Homeroom, history: WinRecord[]): number;
```

**Guarantees**:
- A round advances only when every **currently rostered** active student in that homeroom has a win at the current round (FR-017, FR-022).
- Rounds advance per homeroom, independently (FR-018).
- A student new to the roster has no win at the current round and is therefore immediately a candidate (FR-021).
- Removing a `WinRecord` returns that student to the pool with no other state to repair (FR-023).
- Idempotent: calling it twice with the same inputs advances at most once.

---

## drawing.ts

```ts
function drawWinner(candidates: RosterEntry[], rng: Rng): RosterEntry | null;
```

**Guarantees**:
- Returns `null` for an empty pool — never throws, never returns an ineligible student (FR-030).
- Uniform over the pool; implemented by rejection sampling over `crypto.getRandomValues` to avoid modulo bias.
- With a seeded `Rng`, fully deterministic — this is what makes SC-007 and SC-008 testable.

---

## Property tests these contracts imply

| Property | Requirement |
|---|---|
| No student holding an overdue item ever appears as a candidate | FR-009 / SC-003 |
| A student listed only for fines or refunds is always a candidate | FR-009 / SC-003 |
| Simulating a school year, every student wins once before anyone wins twice | FR-016 / SC-007 |
| Within a round, selection frequency is uniform across 1,000 draws | FR-026 / SC-008 |
| Roster row count = candidates + every counted set-aside reason | FR-039 |
| Normalization never merges two distinct roster students | FR-008 |
