require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./index');
const bcrypt = require('bcrypt');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running database migration...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema applied successfully.');

    // Seed default admin user if none exists
    const { rows } = await client.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(rows[0].count) === 0) {
      const email = process.env.ADMIN_EMAIL || 'admin@example.com';
      const password = process.env.ADMIN_PASSWORD || 'changeme123';
      const hashed = await bcrypt.hash(password, 10);
      await client.query(
        'INSERT INTO admin_users (name, email, password) VALUES ($1, $2, $3)',
        ['Administrator', email, hashed]
      );
      console.log(`Default admin created: ${email}`);
    }
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
