/**
 * Barcode normalization — the join between the two reports.
 *
 * District ID is unusable as a key: it is blank for some students and duplicated
 * across others in the real export. Barcode matched all circulation rows, so it
 * is the identity used both for matching and for persistent history.
 *
 * Normalization only ever WIDENS what matches. A missed match would let a student
 * holding an overdue book win a prize, which is the failure mode that embarrasses
 * the librarian in front of a class.
 */

/**
 * Trim -> uppercase -> drop a leading 'P' prefix and internal whitespace ->
 * strip leading zeros. Idempotent. Empty input yields '' which never matches.
 */
export function normalizeBarcode(raw: string | null | undefined): string {
  if (raw == null) return '';
  let s = String(raw).trim().toUpperCase();
  if (s === '') return '';

  // Faculty barcodes look like 'P 4242'. Drop the patron prefix.
  s = s.replace(/^P[\s-]*(?=\d)/, '');

  // Spreadsheets introduce stray spaces; they are never meaningful here.
  s = s.replace(/\s+/g, '');

  // Excel silently eats leading zeros, so '000100001' and '100001' are one student.
  const stripped = s.replace(/^0+/, '');

  // All-zero barcodes collapse to '' rather than to a bare '0' that could collide.
  return stripped;
}

/** True when two raw barcodes refer to the same patron. Empty never matches. */
export function barcodesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeBarcode(a);
  return na !== '' && na === normalizeBarcode(b);
}
