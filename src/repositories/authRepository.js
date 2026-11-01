import pool from "../config/db.js";

export const findAdminByEmail = async (email) => {
  const sql = `
    SELECT id, name, email, password, role, status
    FROM users
    WHERE email = ?
      AND role = 'Admin'
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [email]);
  return rows[0] ?? null;
};

export const revokeRefreshTokensByUserId = async (userId) => {
  const sql = `
    DELETE FROM refresh_tokens
    WHERE user_id = ?
  `;

  const [result] = await pool.execute(sql, [userId]);

  console.log(result);

  return result;
};

export const revokeRefreshTokenByToken = async (token) => {
  const sql = `
    DELETE FROM refresh_tokens
    WHERE token = ?
  `;

  const [result] = await pool.execute(sql, [token]);

  return result;
};

export const saveRefreshToken = async (userId, token, expiresAt) => {
  const sql = `
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `;

  await pool.execute(sql, [userId, token, expiresAt]);
};

export const findUserByEmail = async (email) => {
  const sql = `
    SELECT id, name, email, password, role, status
    FROM users
    WHERE email = ?
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [email]);
  return rows[0] ?? null;
};

export const createUser = async (name, email, hashedPassword, role, status) => {
  const sql = `
    INSERT INTO users (name, email, password, role, status)
    VALUES (?, ?, ?, ?, ?)
  `;

  const [result] = await pool.execute(sql, [name, email, hashedPassword, role, status]);
  return result;
};

export const listEmployeesForAdmin = async () => {
  const sql = `
    SELECT id, name, email, role, status, created_at
    FROM users
    WHERE role IN ('Manager', 'Sales', 'Employee')
    ORDER BY created_at DESC
  `;

  const [rows] = await pool.execute(sql);
  return rows;
};

export const updateEmployeeRoleAndStatusById = async (employeeId, role, status) => {
  const sql = `
    UPDATE users
    SET role = ?, status = ?
    WHERE id = ?
      AND role IN ('Manager', 'Sales', 'Employee')
  `;

  const [result] = await pool.execute(sql, [role, status, employeeId]);
  return result;
};

export const getUserById = async (userId) => {
  const sql = `
    SELECT id, name, email, role, status, profile_image
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [userId]);
  return rows[0] ?? null;
};

export const updateUserProfileImageById = async (userId, imageUrl) => {
  const sql = `
    UPDATE users
    SET profile_image = ?
    WHERE id = ?
  `;

  const [result] = await pool.execute(sql, [imageUrl, userId]);
  return result;
};

export const deleteUserById = async (userId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      "DELETE FROM refresh_tokens WHERE user_id = ?",
      [userId]
    );

    await connection.execute(
      "DELETE FROM notifications WHERE sender_id = ? OR receiver_id = ?",
      [userId, userId]
    );

    await connection.execute(
      "DELETE FROM tasks WHERE assigned_by = ? OR assigned_to = ?",
      [userId, userId]
    );

    await connection.execute(
      "DELETE FROM reports WHERE submitted_by = ?",
      [userId]
    );

    await connection.execute(
      "DELETE FROM sales_history WHERE sold_by = ?",
      [userId]
    );

    await connection.execute(
      "DELETE FROM purchase_orders WHERE created_by = ? OR approved_by = ?",
      [userId, userId]
    );

    await connection.execute(
      "DELETE FROM products WHERE created_by = ?",
      [userId]
    );

    await connection.execute(
      "DELETE FROM suppliers WHERE created_by = ?",
      [userId]
    );

    const [result] = await connection.execute(
      `DELETE FROM users
       WHERE id = ?
         AND role IN ('Manager', 'Sales', 'Employee')`,
      [userId]
    );

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
