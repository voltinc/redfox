import crypto from 'node:crypto';

export function id(prefix = '') {
  const raw = crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, '');
  return prefix ? `${prefix}_${raw}` : raw;
}

export function sha(prefix = '') {
  return crypto.createHash('sha1').update(crypto.randomBytes(32)).digest('hex').slice(0, 40);
}

export function shortId(prefix = '') {
  const raw = crypto.randomBytes(4).toString('hex');
  return prefix ? `${prefix}_${raw}` : raw;
}

/* --- password hashing (scrypt) ------------------------------------------- */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* --- secret box for environment variables --------------------------------
   Values are encrypted at rest with AES-256-GCM. The key comes from
   REDFOX_SECRET_KEY, or is generated per install and stored outside the DB. */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';

function secretKey() {
  if (process.env.REDFOX_SECRET_KEY) {
    return crypto.createHash('sha256').update(process.env.REDFOX_SECRET_KEY).digest();
  }
  const file = path.join(DATA_DIR, '.secret-key');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  return crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').trim()).digest();
}

let cachedKey = null;
function key() {
  if (!cachedKey) cachedKey = secretKey();
  return cachedKey;
}

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function decrypt(payload) {
  try {
    const [version, ivB64, tagB64, dataB64] = String(payload).split('.');
    if (version !== 'v1') return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function maskValue(value) {
  const chars = [...String(value)];
  if (!chars.length) return '';
  if (chars.length <= 8) return '••••••••';
  return `${chars.slice(0, 3).join('')}${'•'.repeat(Math.min(20, chars.length - 5))}${chars.slice(-2).join('')}`;
}

export function apiKeyHash(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
