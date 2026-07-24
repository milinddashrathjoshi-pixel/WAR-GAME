import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

/**
 * Read memo rows from a .csv, .xlsx or .xls file into an array of plain objects
 * keyed by the header row. Empty rows are dropped.
 *
 * Note: the `xlsx` package is imported lazily so CSV/TSV workflows never load
 * it (it carries a known advisory with no npm fix). Prefer exporting to CSV.
 */
export async function readMemoRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv' || ext === '.tsv') {
    const raw = fs.readFileSync(filePath, 'utf8');
    return parse(raw, {
      columns: (header) => header.map((h) => String(h).trim()),
      skip_empty_lines: true,
      trim: true,
      delimiter: ext === '.tsv' ? '\t' : ',',
      bom: true,
    });
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const { default: xlsx } = await import('xlsx');
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return xlsx
      .utils.sheet_to_json(sheet, { defval: '', raw: false })
      .map((row) => {
        const clean = {};
        for (const [k, v] of Object.entries(row)) {
          clean[String(k).trim()] = typeof v === 'string' ? v.trim() : v;
        }
        return clean;
      });
  }

  throw new Error(`Unsupported file type: ${ext}. Use .csv, .tsv, .xlsx or .xls`);
}
