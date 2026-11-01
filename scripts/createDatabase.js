const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config();

const {
  DB_HOST = 'localhost',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME,
} = process.env;

if (!DB_NAME) {
  console.error('Error: DB_NAME is not set in the .env file');
  process.exit(1);
}

async function createDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
    });

    const sql = `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;
    await connection.query(sql);
    console.log(`Database '${DB_NAME}' created or already exists.`);
  } catch (err) {
    console.error('Failed to create database:', err.message || err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

createDatabase();
