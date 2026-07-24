import 'dotenv/config';

/** Read NetSuite TBA credentials strictly from environment variables. */
export function loadCreds() {
  return {
    accountId: process.env.NETSUITE_ACCOUNT_ID,
    consumerKey: process.env.NETSUITE_CONSUMER_KEY,
    consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
    tokenId: process.env.NETSUITE_TOKEN_ID,
    tokenSecret: process.env.NETSUITE_TOKEN_SECRET,
    signatureMethod: process.env.NETSUITE_SIGNATURE_METHOD || 'HMAC-SHA256',
  };
}
