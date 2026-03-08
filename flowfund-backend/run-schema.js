/**
 * Run schema.sql against the database. Idempotent (safe to run on every deploy).
 * Executes statements one-by-one to avoid multi-statement parsing issues (e.g. Railway MySQL).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getPoolConfig } = require('./config/dbConfig');

function getStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--[^\n]*\n/gm, '').trim()) // strip -- comment lines
    .filter((s) => s.length > 0);
}

async function runSchema() {
  const config = getPoolConfig();
  const conn = await mysql.createConnection(config);

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = getStatements(sql);

    for (const statement of statements) {
      await conn.query(statement);
    }
    console.log('Schema applied.');
  } finally {
    await conn.end();
  }
}

runSchema()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Schema failed:', err.message);
    process.exit(1);
  });
