/**
 * Everything the two files could not tell us.
 *
 * The point is that nothing is hidden: a genuinely overdue student slipping into
 * a drawing because a row failed to match is the mistake worth catching (FR-038).
 */
import type { ImportSummary, SetAsideReason } from '../../domain/types';

const LABELS: Record<SetAsideReason, { title: string; blurb: string }> = {
  unmatchedCirculation: {
    title: 'On a circulation report, but not on the roster',
    blurb:
      'These rows could not be matched to a student. If one of them is a current student, they may be in a drawing they should not be in.',
  },
  undeterminableDueDate: {
    title: 'Due date could not be read',
    blurb:
      'These look like checked-out books, but the due date was blank or unreadable, so we could not tell whether they are overdue.',
  },
  nonOverdue: {
    title: 'Fines and refunds (not overdue)',
    blurb:
      'These rows do not keep anyone out of the drawing. A fine or a lost-book charge is not an overdue book.',
  },
  noHomeroom: {
    title: 'Students with no homeroom listed',
    blurb: 'Grouped separately so they never end up in another teacher’s class.',
  },
  faculty: { title: 'Staff', blurb: 'Not students, so not in any drawing.' },
  inactive: { title: 'Inactive records', blurb: 'Set aside rather than assumed eligible.' },
  duplicateRoster: {
    title: 'Duplicate roster rows',
    blurb: 'The same barcode appeared more than once; the student is counted once.',
  },
  missingBarcode: {
    title: 'Rows with no barcode',
    blurb: 'Without a barcode a row cannot be matched to anything.',
  },
};

const ORDER: SetAsideReason[] = [
  'unmatchedCirculation',
  'undeterminableDueDate',
  'noHomeroom',
  'duplicateRoster',
  'missingBarcode',
  'nonOverdue',
  'inactive',
  'faculty',
];

export function DataQualityScreen({ summary }: { summary: ImportSummary }) {
  return (
    <div className="stack">
      <div>
        <h2>What was set aside</h2>
        <p className="lede">
          Every row from every file is accounted for here, and each one names the report it came
          from. Nothing was quietly dropped.
        </p>
      </div>

      {summary.overdueRowsFound === 0 && (
        <div className="notice">
          <h3>Zero overdue items were found this month</h3>
          <p>
            The {summary.circulationFiles.length} circulation report
            {summary.circulationFiles.length === 1 ? '' : 's'} had {summary.circulationRowsRead}{' '}
            rows between them, and none of them was a book that is past its due date. Either
            everyone has returned their books, or the reports were exported without checked-out
            items and their due dates — worth a look before you hand out prizes.
          </p>
        </div>
      )}

      {ORDER.map((reason) => {
        const rows = summary.setAside.filter((s) => s.reason === reason);
        if (rows.length === 0) return null;
        const label = LABELS[reason];
        return (
          <details key={reason} className="card" open={reason === 'unmatchedCirculation' || reason === 'undeterminableDueDate'}>
            <summary>
              <strong>{label.title}</strong> — {rows.length}
            </summary>
            <p className="small muted">{label.blurb}</p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Barcode</th>
                  <th>Detail</th>
                  <th>Report</th>
                  <th>Row</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row, i) => (
                  <tr key={`${row.sourceFile ?? 'roster'}-${row.barcode}-${row.sourceRow}-${i}`}>
                    <td>{row.displayName || <span className="muted">(no name)</span>}</td>
                    <td className="small">{row.barcode || <span className="muted">(none)</span>}</td>
                    <td className="small">{row.detail ?? ''}</td>
                    <td className="small muted">{row.sourceFile ?? summary.rosterFileName}</td>
                    <td className="small muted">{row.sourceRow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="small muted">Showing the first 200 of {rows.length}.</p>}
          </details>
        );
      })}
    </div>
  );
}
