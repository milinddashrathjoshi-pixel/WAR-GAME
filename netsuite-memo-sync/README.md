# NetSuite Memo Sync

Update NetSuite **Sales / Credit Memos** from an Excel/CSV file using
**Token-Based Authentication (TBA / OAuth 1.0)**, and generate an outcome report.

Secrets are read **only** from environment variables — nothing is hardcoded and
`.env` is git-ignored.

## 1. Install

```bash
cd netsuite-memo-sync
npm install
```

## 2. Configure credentials (never commit these)

```bash
cp .env.example .env
# then edit .env and paste your real TBA values
```

| Variable | Where in NetSuite |
|---|---|
| `NETSUITE_ACCOUNT_ID` | Setup > Company > Company Information (e.g. `1234567` or `1234567_SB1`) |
| `NETSUITE_CONSUMER_KEY` / `_SECRET` | Setup > Integration > Manage Integrations (the App record) |
| `NETSUITE_TOKEN_ID` / `_SECRET` | Setup > Users/Roles > Access Tokens |

The integration + token role need permission on the record types you update
(Credit Memo / Invoice) and REST Web Services enabled.

## 3. Map your columns

Edit `src/mapping.js` to describe how a spreadsheet row becomes a NetSuite
update: which column is the record id, and which columns map to which NetSuite
fields. (Upload a sample file and this can be filled in exactly.)

## 4. Add your data & run

Put the file in `data/` (git-ignored), then:

```bash
# Validate everything without writing to NetSuite:
node src/syncMemos.js data/memos.csv --dry-run

# Perform the updates:
node src/syncMemos.js data/memos.csv
```

A per-row report is written to `reports/sync-<timestamp>.csv`.

## Test (offline, no secrets, no network)

```bash
node test/oauth.test.js
```

## Layout

```
src/oauth.js          OAuth 1.0 (TBA) request signing
src/netsuiteClient.js SuiteTalk REST client (GET/PATCH, SuiteQL lookup)
src/readMemos.js      CSV / XLSX reader
src/mapping.js        <-- EDIT: column -> field mapping
src/syncMemos.js      main entry point (--dry-run supported)
src/config.js         loads credentials from env
```
