/**
 * ============================================================================
 *  COLUMN MAPPING  --  EDIT THIS FILE to match your Excel/CSV headers.
 * ============================================================================
 *
 *  This is the ONE place you describe how a spreadsheet row becomes a NetSuite
 *  update. Once you upload a sample file we will fill these in exactly; the
 *  values below are placeholders showing the expected shape.
 */

export const MAPPING = {
  // Which spreadsheet column tells us the record TYPE for each row.
  // If every row is the same type, leave `recordTypeColumn` null and set
  // `defaultRecordType` instead.
  recordTypeColumn: null,
  defaultRecordType: 'creditmemo', // 'creditmemo' | 'invoice' | 'cashsale' | 'salesorder' ...

  // How do we identify the NetSuite record for each row?
  //   'internalId' -> column holds NetSuite internal id (fastest, no lookup)
  //   'tranId'     -> column holds the document number (we look up the id via SuiteQL)
  idStrategy: 'internalId',
  idColumn: 'InternalId', // <-- change to your header, e.g. 'NetSuite ID' or 'Document Number'

  // Map spreadsheet columns -> NetSuite REST field names.
  // key   = the column header in your file
  // value = the NetSuite field id to PATCH  (string) OR
  //         an object { field, transform } for value conversion.
  fields: {
    // 'Memo':        'memo',
    // 'Amount':      { field: 'amount', transform: (v) => Number(v) },
    // 'Status':      'status',
    // 'Date':        { field: 'trandate', transform: toNsDate },
  },
};

/** Convert 'DD/MM/YYYY' or 'YYYY-MM-DD' to NetSuite's ISO date. */
export function toNsDate(v) {
  if (!v) return v;
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s; // assume already ISO
}

/** Build the NetSuite PATCH body from one spreadsheet row using MAPPING. */
export function rowToFields(row) {
  const body = {};
  for (const [col, spec] of Object.entries(MAPPING.fields)) {
    if (!(col in row)) continue;
    const rawVal = row[col];
    if (rawVal === '' || rawVal == null) continue;
    if (typeof spec === 'string') {
      body[spec] = rawVal;
    } else if (spec && typeof spec === 'object') {
      body[spec.field] = spec.transform ? spec.transform(rawVal) : rawVal;
    }
  }
  return body;
}
