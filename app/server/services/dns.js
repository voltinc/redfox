/* Domain verification. These are real DNS lookups from the running host. In a
   sandbox with restricted egress the lookup may fail; the failure is reported
   verbatim rather than being turned into a fake "verified" state. */
import dns from 'node:dns/promises';

export async function verifyDomain(hostname, token, expectedTarget = 'cname.redfox.app') {
  const result = { hostname, checked_at: new Date().toISOString(), cname: null, txt: null, verified: false, errors: [] };

  try {
    const cnames = await dns.resolveCname(hostname);
    result.cname = cnames[0] ?? null;
  } catch (error) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      try {
        const addresses = await dns.resolve4(hostname);
        result.cname = addresses[0] ? `A ${addresses[0]}` : null;
      } catch (inner) {
        result.errors.push(`CNAME lookup failed: ${inner.code || inner.message}`);
      }
    } else {
      result.errors.push(`CNAME lookup failed: ${error.code || error.message}`);
    }
  }

  try {
    const records = await dns.resolveTxt(`_redfox.${hostname}`);
    result.txt = records.map((parts) => parts.join('')).join(' ');
  } catch (error) {
    result.errors.push(`TXT lookup failed: ${error.code || error.message}`);
  }

  const cnameOk = result.cname === expectedTarget;
  const txtOk = !!result.txt && result.txt.includes(token);
  result.verified = cnameOk && txtOk;

  if (!cnameOk && result.cname) {
    result.errors.push(`CNAME points at ${result.cname}, expected ${expectedTarget}`);
  }
  if (!txtOk) {
    result.errors.push(`TXT record _redfox.${hostname} must contain ${token}`);
  }
  return result;
}
