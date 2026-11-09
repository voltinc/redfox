#!/usr/bin/env node
/* Reset a user's password from the server console.

   Self-hosted Redfox has no outbound mail, so password recovery runs here
   rather than through an email link.

   Usage: npm run reset-password -- you@company.com [new-password]
   With no password argument a strong one is generated and printed once. */

import { db, migrate } from '../server/db.js';
import { hashPassword } from '../server/crypto.js';
import { randomBytes } from 'node:crypto';

migrate();

const email = String(process.argv[2] || '').trim();
if (!email) {
  console.error('Usage: npm run reset-password -- you@company.com [new-password]');
  process.exit(1);
}

const user = db.prepare('SELECT id, email, name FROM users WHERE lower(email) = lower(?)').get(email);
if (!user) {
  console.error(`No account found for ${email}`);
  process.exit(1);
}

const generated = !process.argv[3];
const password = generated ? randomBytes(12).toString('base64url') : String(process.argv[3]);
if (password.length < 10) {
  console.error('Choose a password of at least 10 characters.');
  process.exit(1);
}

db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

console.log(`Password updated for ${user.email} (${user.name}). Existing sessions were signed out.`);
if (generated) console.log(`New password: ${password}`);
