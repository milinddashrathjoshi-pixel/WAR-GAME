import { buildAuthHeader } from './oauth.js';

/**
 * Thin NetSuite SuiteTalk REST client for record operations, authenticated
 * with Token-Based Authentication (OAuth 1.0).
 */
export class NetSuiteClient {
  constructor(creds) {
    const required = [
      'accountId',
      'consumerKey',
      'consumerSecret',
      'tokenId',
      'tokenSecret',
    ];
    const missing = required.filter((k) => !creds[k]);
    if (missing.length) {
      throw new Error(
        `Missing NetSuite credentials: ${missing.join(', ')}. ` +
          `Set them in your .env file (see .env.example).`,
      );
    }
    this.creds = creds;
    // Account id in the host uses lowercase with a hyphen instead of underscore.
    const host = String(creds.accountId).toLowerCase().replace(/_/g, '-');
    this.baseUrl = `https://${host}.suitetalk.api.netsuite.com/services/rest/record/v1`;
  }

  async #request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const authorization = buildAuthHeader({ method, url, creds: this.creds });

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'transient',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const detail =
        data && data['o:errorDetails']
          ? JSON.stringify(data['o:errorDetails'])
          : typeof data === 'string'
            ? data
            : JSON.stringify(data);
      const err = new Error(`NetSuite ${method} ${path} -> ${res.status}: ${detail}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  /** Fetch a single record: recordType e.g. 'creditmemo', 'invoice', 'salesorder'. */
  get(recordType, id) {
    return this.#request('GET', `/${recordType}/${encodeURIComponent(id)}`);
  }

  /** Partial update (PATCH) of a record's fields. */
  update(recordType, id, fields) {
    return this.#request('PATCH', `/${recordType}/${encodeURIComponent(id)}`, fields);
  }

  /**
   * Look up a record's internal id by its document number (tranid) via SuiteQL.
   * Returns the internal id string, or null if not found.
   */
  async findIdByTranId(recordType, tranId) {
    const url = `https://${String(this.creds.accountId)
      .toLowerCase()
      .replace(/_/g, '-')}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;
    const method = 'POST';
    const authorization = buildAuthHeader({ method, url, creds: this.creds });
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'transient',
      },
      body: JSON.stringify({
        q: `SELECT id FROM transaction WHERE tranid = ? AND recordtype = ?`,
        params: [tranId, recordType],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`SuiteQL lookup failed ${res.status}: ${JSON.stringify(data)}`);
    }
    return data.items && data.items.length ? String(data.items[0].id) : null;
  }
}
