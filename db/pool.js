const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const useSsl = process.env.DB_SSL === 'true' || isProduction;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

async function dbQuery(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  dbQuery
};
