/**
 * Offline sanity test for the OAuth 1.0 signing (no network, no real secrets).
 * Run:  node test/oauth.test.js
 */
import assert from 'node:assert';
import { buildAuthHeader } from '../src/oauth.js';

const creds = {
  accountId: '1234567_SB1',
  consumerKey: 'ck',
  consumerSecret: 'cs',
  tokenId: 'tk',
  tokenSecret: 'ts',
  signatureMethod: 'HMAC-SHA256',
};

// Fixed timestamp + nonce make the signature deterministic.
const header = buildAuthHeader({
  method: 'GET',
  url: 'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/creditmemo/42',
  creds,
  timestamp: 1700000000,
  nonceStr: 'fixednonce1234567890fixednonce12',
});

assert.ok(header.startsWith('OAuth realm="1234567_SB1"'), 'realm must be uppercase account id');
assert.ok(header.includes('oauth_signature_method="HMAC-SHA256"'), 'signature method present');
assert.ok(header.includes('oauth_consumer_key="ck"'), 'consumer key present');
assert.ok(/oauth_signature="[^"]+"/.test(header), 'signature present');

// Signature must be stable for identical inputs.
const header2 = buildAuthHeader({
  method: 'GET',
  url: 'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/creditmemo/42',
  creds,
  timestamp: 1700000000,
  nonceStr: 'fixednonce1234567890fixednonce12',
});
assert.strictEqual(header, header2, 'signing must be deterministic');

console.log('oauth.test.js: all assertions passed');
console.log(header);
