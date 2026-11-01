import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD).replace(/['"]/g, ''),
  database: String(process.env.DB_NAME).replace(/['"]/g, ''),
  waitForConnections: true,
  connectionLimit: 5,
});

try {
  const [tables] = await pool.query('SHOW TABLES');
  console.log('TABLES:', JSON.stringify(tables, null, 2));

  const [purchaseRows] = await pool.query('SELECT * FROM purchase_orders LIMIT 5');
  console.log('PURCHASE_ORDERS:', JSON.stringify(purchaseRows, null, 2));

  const [supplierRows] = await pool.query('SELECT * FROM suppliers LIMIT 5');
  console.log('SUPPLIERS:', JSON.stringify(supplierRows, null, 2));
} catch (error) {
  console.error('DB_ERROR:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
