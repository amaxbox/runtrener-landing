const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Путь к сертификату Yandex Cloud
const caCertPath = path.join(process.env.HOME || '/root', '.postgresql', 'root.crt');

// Создаём connectionString в формате Yandex Cloud
const connectionString = `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT || 6432}/${process.env.PGDATABASE}`;

// Создаём пул соединений с PostgreSQL
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(caCertPath).toString()
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Проверка соединения при старте
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

/**
 * Получает информацию о пользователе по telegram_user_id
 */
async function getUserInfo(telegramUserId) {
  const query = 'SELECT * FROM alex_users WHERE telegram_user_id = $1';
  try {
    const result = await pool.query(query, [telegramUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error;
  }
}

/**
 * Получает терапевтический профиль пользователя
 */
async function getTherapyProfile(telegramUserId) {
  const query = 'SELECT * FROM alex_user_therapy_profiles WHERE telegram_user_id = $1';
  try {
    const result = await pool.query(query, [telegramUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching therapy profile:', error);
    throw error;
  }
}

/**
 * Получает все платежи пользователя
 */
async function getPayments(telegramUserId) {
  const query = `
    SELECT * FROM alex_payments
    WHERE telegram_user_id = $1
    ORDER BY payment_date DESC
  `;
  try {
    const result = await pool.query(query, [telegramUserId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }
}

/**
 * Получает все сообщения чата пользователя
 */
async function getChatLogs(telegramUserId, limit = 100) {
  const query = `
    SELECT * FROM alex_chat_logs
    WHERE telegram_user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  try {
    const result = await pool.query(query, [telegramUserId, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching chat logs:', error);
    throw error;
  }
}

/**
 * Получает список всех пользователей с пагинацией и фильтрами
 */
async function getUsersList(limit = 50, offset = 0, filters = {}, sortBy = 'created_at', sortOrder = 'DESC') {
  let queryParams = [];
  let paramIndex = 1;
  let whereConditions = [];

  // Поиск по ID, имени или username
  if (filters.search) {
    whereConditions.push(`(
      CAST(u.telegram_user_id AS TEXT) LIKE $${paramIndex} OR
      LOWER(u.first_name) LIKE $${paramIndex} OR
      LOWER(u.last_name) LIKE $${paramIndex} OR
      LOWER(u.username) LIKE $${paramIndex}
    )`);
    queryParams.push(`%${filters.search.toLowerCase()}%`);
    paramIndex++;
  }

  // Фильтр по подписке
  if (filters.subscribe) {
    whereConditions.push(`u.subscribe = $${paramIndex}`);
    queryParams.push(filters.subscribe);
    paramIndex++;
  }

  // Фильтр по статусу
  if (filters.status) {
    whereConditions.push(`u.status = $${paramIndex}`);
    queryParams.push(filters.status);
    paramIndex++;
  }

  // Фильтр по дате "от"
  if (filters.dateFrom) {
    whereConditions.push(`u.created_at >= $${paramIndex}`);
    queryParams.push(filters.dateFrom);
    paramIndex++;
  }

  // Фильтр по дате "до"
  if (filters.dateTo) {
    whereConditions.push(`u.created_at <= $${paramIndex}::date + interval '1 day'`);
    queryParams.push(filters.dateTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  // Валидация сортировки
  const allowedSortFields = ['created_at', 'updated_at'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  const sortDirection = sortOrder === 'ASC' ? 'ASC' : 'DESC';

  const query = `
    SELECT
      u.id,
      u.telegram_user_id,
      u.username,
      u.first_name,
      u.last_name,
      u.status,
      u.subscribe,
      u.stage,
      u.created_at,
      u.updated_at,
      u.daily_message_count,
      u.daily_message_count_date,
      (
        SELECT p.pro_before
        FROM alex_payments p
        WHERE p.telegram_user_id = u.telegram_user_id
        ORDER BY p.pro_before DESC NULLS LAST
        LIMIT 1
      ) as pro_before
    FROM alex_users u
    ${whereClause}
    ORDER BY u.${sortField} ${sortDirection}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  try {
    const result = await pool.query(query, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error fetching users list:', error);
    throw error;
  }
}

/**
 * Получает общее количество пользователей с учетом фильтров
 */
async function getUsersCount(filters = {}) {
  let queryParams = [];
  let paramIndex = 1;
  let whereConditions = [];

  // Поиск по ID, имени или username
  if (filters.search) {
    whereConditions.push(`(
      CAST(telegram_user_id AS TEXT) LIKE $${paramIndex} OR
      LOWER(first_name) LIKE $${paramIndex} OR
      LOWER(last_name) LIKE $${paramIndex} OR
      LOWER(username) LIKE $${paramIndex}
    )`);
    queryParams.push(`%${filters.search.toLowerCase()}%`);
    paramIndex++;
  }

  // Фильтр по подписке
  if (filters.subscribe) {
    whereConditions.push(`subscribe = $${paramIndex}`);
    queryParams.push(filters.subscribe);
    paramIndex++;
  }

  // Фильтр по статусу
  if (filters.status) {
    whereConditions.push(`status = $${paramIndex}`);
    queryParams.push(filters.status);
    paramIndex++;
  }

  // Фильтр по дате "от"
  if (filters.dateFrom) {
    whereConditions.push(`created_at >= $${paramIndex}`);
    queryParams.push(filters.dateFrom);
    paramIndex++;
  }

  // Фильтр по дате "до"
  if (filters.dateTo) {
    whereConditions.push(`created_at <= $${paramIndex}::date + interval '1 day'`);
    queryParams.push(filters.dateTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const query = `SELECT COUNT(*) as count FROM alex_users ${whereClause}`;

  try {
    const result = await pool.query(query, queryParams);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error fetching users count:', error);
    throw error;
  }
}

/**
 * Получает все платежи с пагинацией и фильтрами (для реестра)
 */
async function getAllPayments(limit = 50, offset = 0, filters = {}) {
  let queryParams = [];
  let paramIndex = 1;
  let whereConditions = [];

  // Фильтр по telegram_user_id
  if (filters.userId) {
    whereConditions.push(`telegram_user_id = $${paramIndex}`);
    queryParams.push(filters.userId);
    paramIndex++;
  }

  // Фильтр по дате "от"
  if (filters.dateFrom) {
    whereConditions.push(`payment_date >= $${paramIndex}`);
    queryParams.push(filters.dateFrom);
    paramIndex++;
  }

  // Фильтр по дате "до"
  if (filters.dateTo) {
    whereConditions.push(`payment_date <= $${paramIndex}::date + interval '1 day'`);
    queryParams.push(filters.dateTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const query = `
    SELECT
      telegram_user_id,
      payment_date,
      amount,
      amount_net,
      duration,
      pro_before,
      pro_label,
      source,
      receipt_url,
      comment
    FROM alex_payments
    ${whereClause}
    ORDER BY payment_date DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  try {
    const result = await pool.query(query, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error fetching all payments:', error);
    throw error;
  }
}

/**
 * Получает общее количество платежей с учетом фильтров
 */
async function getPaymentsCount(filters = {}) {
  let queryParams = [];
  let paramIndex = 1;
  let whereConditions = [];

  // Фильтр по telegram_user_id
  if (filters.userId) {
    whereConditions.push(`telegram_user_id = $${paramIndex}`);
    queryParams.push(filters.userId);
    paramIndex++;
  }

  // Фильтр по дате "от"
  if (filters.dateFrom) {
    whereConditions.push(`payment_date >= $${paramIndex}`);
    queryParams.push(filters.dateFrom);
    paramIndex++;
  }

  // Фильтр по дате "до"
  if (filters.dateTo) {
    whereConditions.push(`payment_date <= $${paramIndex}::date + interval '1 day'`);
    queryParams.push(filters.dateTo);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const query = `SELECT COUNT(*) as count FROM alex_payments ${whereClause}`;

  try {
    const result = await pool.query(query, queryParams);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error fetching payments count:', error);
    throw error;
  }
}

/**
 * Проверяет соединение с базой данных
 */
async function checkConnection() {
  try {
    await pool.query('SELECT NOW()');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

module.exports = {
  pool,
  getUserInfo,
  getTherapyProfile,
  getPayments,
  getChatLogs,
  getUsersList,
  getUsersCount,
  getAllPayments,
  getPaymentsCount,
  checkConnection
};
