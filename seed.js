// seed.js — run once to create the admin account
// Usage: node seed.js

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('./config/db');

(async () => {
  try {
    const email    = process.env.ADMIN_EMAIL    || 'admin@electromart.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
    const name     = 'ElectroMart Admin';

    const hash = await bcrypt.hash(password, 12);

    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'admin')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [name, email, hash]
    );

    console.log(`✅  Admin seeded: ${email} / ${password}`);
    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  }
})();
