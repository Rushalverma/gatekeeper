'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * MySQL connection pool.
 * Using a pool (not a single connection) means multiple concurrent requests
 * each get a connection from the pool without blocking each other.
 */
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASS     || '',
  database:           process.env.DB_NAME     || 'gateway_saas',
  waitForConnections: true,
  connectionLimit:    20,     // max simultaneous connections
  queueLimit:         0,      // unlimited queue
  timezone:           'Z',    // store/read timestamps as UTC
  charset:            'utf8mb4',
});

// Verify connectivity at startup
pool.getConnection()
  .then(conn => {
    console.log('[MySQL] Connection pool established successfully.');
    conn.release();
  })
  .catch(err => {
    console.error('[MySQL] Failed to connect — check .env credentials:', err.message);
    process.exit(1);
  });

module.exports = pool;
