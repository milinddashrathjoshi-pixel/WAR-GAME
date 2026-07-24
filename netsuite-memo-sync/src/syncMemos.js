/**
 * Sync Sales/Credit Memos from an Excel/CSV file into NetSuite.
 *
 * Usage:
 *   node src/syncMemos.js data/memos.csv            # perform updates
 *   node src/syncMemos.js data/memos.csv --dry-run  # validate only, no writes
 *
 * A CSV report of every row's outcome is written to reports/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadCreds } from './config.js';
import { NetSuiteClient } from './netsuiteClient.js';
import { readMemoRows } from './readMemos.js';
import { MAPPING, rowToFields } from './mapping.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--')) || 'data/memos.csv';
  return { dryRun, file };
}

function timestampTag() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const { dryRun, file } = parseArgs(process.argv);
  const filePath = path.resolve(file);

  if (!fs.existsSync(filePath)) {
    console.error(`Input file not found: ${filePath}`);
    process.exit(1);
  }

  const rows = await readMemoRows(filePath);
  console.log(`Read ${rows.length} row(s) from ${file}${dryRun ? '  [DRY RUN]' : ''}`);

  if (Object.keys(MAPPING.fields).length === 0) {
    console.error(
      '\nMAPPING.fields is empty — edit src/mapping.js so it matches your columns first.',
    );
    process.exit(1);
  }

  const client = dryRun ? null : new NetSuiteClient(loadCreds());
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2; // 1-based + header
    const recordType = MAPPING.recordTypeColumn
      ? row[MAPPING.recordTypeColumn]
      : MAPPING.defaultRecordType;

    try {
      const rawId = row[MAPPING.idColumn];
      if (!rawId) throw new Error(`missing id column "${MAPPING.idColumn}"`);

      const fields = rowToFields(row);
      if (Object.keys(fields).length === 0) throw new Error('no mapped fields to update');

      let internalId = rawId;
      if (MAPPING.idStrategy === 'tranId' && !dryRun) {
        internalId = await client.findIdByTranId(recordType, rawId);
        if (!internalId) throw new Error(`no ${recordType} found with tranId "${rawId}"`);
      }

      if (dryRun) {
        results.push({ rowNo, recordType, id: rawId, status: 'OK (dry-run)', detail: JSON.stringify(fields) });
        console.log(`  [${rowNo}] ${recordType} ${rawId}  ->  ${JSON.stringify(fields)}`);
      } else {
        await client.update(recordType, internalId, fields);
        results.push({ rowNo, recordType, id: internalId, status: 'UPDATED', detail: JSON.stringify(fields) });
        console.log(`  [${rowNo}] ${recordType} ${internalId}  UPDATED`);
      }
    } catch (err) {
      results.push({ rowNo, recordType, id: row[MAPPING.idColumn] || '', status: 'ERROR', detail: err.message });
      console.error(`  [${rowNo}] ERROR: ${err.message}`);
    }
  }

  // Write outcome report.
  const reportDir = path.resolve('reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `sync-${timestampTag()}.csv`);
  const header = 'row,recordType,id,status,detail\n';
  const lines = results
    .map((r) => [r.rowNo, r.recordType, r.id, r.status, `"${String(r.detail).replace(/"/g, '""')}"`].join(','))
    .join('\n');
  fs.writeFileSync(reportPath, header + lines);

  const ok = results.filter((r) => r.status.startsWith('OK') || r.status === 'UPDATED').length;
  const failed = results.length - ok;
  console.log(`\nDone. ${ok} ok, ${failed} failed. Report: ${path.relative(process.cwd(), reportPath)}`);
  if (failed) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
