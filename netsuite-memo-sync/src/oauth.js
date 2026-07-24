import crypto from 'node:crypto';

/**
 * Build an OAuth 1.0 "Authorization" header for a NetSuite SuiteTalk REST call
 * using Token-Based Authentication (TBA).
 *
 * NetSuite specifics:
 *   - The signature base string uses the realm = account id (UPPERCASE).
 *   - Default signature method is HMAC-SHA256.
 *   - Query params in the URL must be included in the signature.
 *
 * No secrets are stored here — they are passed in from environment variables.
 */

function rfc3986(str) {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function nonce(len = 32) {
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}

/**
 * @param {object} p
 * @param {string} p.method       HTTP method, e.g. 'GET', 'PATCH'
 * @param {string} p.url          Full URL including query string
 * @param {object} p.creds        { accountId, consumerKey, consumerSecret, tokenId, tokenSecret, signatureMethod }
 * @param {number} [p.timestamp]  Unix seconds (injectable for testing)
 * @param {string} [p.nonceStr]   Nonce (injectable for testing)
 * @returns {string} Authorization header value
 */
export function buildAuthHeader({ method, url, creds, timestamp, nonceStr }) {
  const u = new URL(url);
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;

  const sigMethod = (creds.signatureMethod || 'HMAC-SHA256').toUpperCase();
  const hmacAlgo = sigMethod === 'HMAC-SHA1' ? 'sha1' : 'sha256';

  const oauthParams = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonceStr || nonce(),
    oauth_signature_method: sigMethod,
    oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: creds.tokenId,
    oauth_version: '1.0',
  };

  // Collect all params (oauth + query string) for the signature base string.
  const allParams = { ...oauthParams };
  for (const [k, v] of u.searchParams.entries()) allParams[k] = v;

  const paramString = Object.keys(allParams)
    .map((k) => [rfc3986(k), rfc3986(allParams[k])])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    rfc3986(baseUrl),
    rfc3986(paramString),
  ].join('&');

  const signingKey = `${rfc3986(creds.consumerSecret)}&${rfc3986(creds.tokenSecret)}`;
  const signature = crypto
    .createHmac(hmacAlgo, signingKey)
    .update(baseString)
    .digest('base64');

  const headerParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const headerBody = Object.keys(headerParams)
    .sort()
    .map((k) => `${rfc3986(k)}="${rfc3986(headerParams[k])}"`)
    .join(', ');

  // realm must be the account id, uppercased (sandbox underscore preserved).
  const realm = String(creds.accountId).toUpperCase();
  return `OAuth realm="${realm}", ${headerBody}`;
}
