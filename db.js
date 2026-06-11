// db.js - MySQL connection pool (promise-based)
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campus_connect',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  // Treat DB datetimes as UTC so the JSON timestamps sent to the client represent
  // the correct instant. Without this, mysql2 assumes the Node process's local
  // timezone and shifts every timestamp (e.g. a "just now" post shows hours off).
  timezone: 'Z'
});

module.exports = pool;
