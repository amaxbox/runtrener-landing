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
 * Получает вопросы пользователя из alex_user_question
 */
async function getUserQuestions(telegramUserId) {
  const query = `
    SELECT
      id,
      question,
      comment,
      start_date,
      finish_date,
      cadence,
      updated_at
    FROM alex_user_question
    WHERE telegram_user_id = $1
    ORDER BY created_at DESC
  `;
  try {
    const result = await pool.query(query, [telegramUserId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching user questions:', error);
    throw error;
  }
}

/**
 * Получает данные о настроении пользователя для конкретного вопроса
 */
async function getUserMoodLogs(telegramUserId, questionId, days = 7) {
  const query = `
    SELECT
      date,
      mood_score
    FROM alex_daily_mood_logs
    WHERE telegram_user_id = $1
      AND question_id = $2
      AND date >= CURRENT_DATE - INTERVAL '${days} days'
    ORDER BY date ASC
  `;
  try {
    const result = await pool.query(query, [telegramUserId, questionId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching user mood logs:', error);
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
  let query;
  let params;

  if (limit === null) {
    // Load all messages
    query = `
      SELECT * FROM alex_chat_logs
      WHERE telegram_user_id = $1
      ORDER BY created_at DESC
    `;
    params = [telegramUserId];
  } else {
    // Load with limit
    query = `
      SELECT * FROM alex_chat_logs
      WHERE telegram_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    params = [telegramUserId, limit];
  }

  try {
    const result = await pool.query(query, params);
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
  if (filters.search && typeof filters.search === 'string') {
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
  const allowedSortFields = ['created_at', 'updated_at', 'daily_message_count'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  const sortDirection = sortOrder === 'ASC' ? 'ASC' : 'DESC';

  // Если есть фильтры по pro_before, используем подзапрос в WHERE
  let havingClause = '';
  if (filters.proDateFrom || filters.proDateTo) {
    const havingConditions = [];

    if (filters.proDateFrom) {
      havingConditions.push(`DATE(pro_before) >= $${paramIndex}::date`);
      queryParams.push(filters.proDateFrom);
      paramIndex++;
    }

    if (filters.proDateTo) {
      havingConditions.push(`DATE(pro_before) <= $${paramIndex}::date`);
      queryParams.push(filters.proDateTo);
      paramIndex++;
    }

    havingClause = `AND ${havingConditions.join(' AND ')}`;
  }

  const query = `
    SELECT * FROM (
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
        ) as pro_before,
        (
          SELECT COUNT(*)
          FROM alex_payments p
          WHERE p.telegram_user_id = u.telegram_user_id
        ) as payment_count
      FROM alex_users u
      ${whereClause}
    ) as users_with_pro
    WHERE 1=1 ${havingClause}
    ORDER BY ${sortField} ${sortDirection}
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

  // Если есть фильтры по pro_before, используем подзапрос
  let havingClause = '';
  if (filters.proDateFrom || filters.proDateTo) {
    const havingConditions = [];

    if (filters.proDateFrom) {
      havingConditions.push(`DATE(pro_before) >= $${paramIndex}::date`);
      queryParams.push(filters.proDateFrom);
      paramIndex++;
    }

    if (filters.proDateTo) {
      havingConditions.push(`DATE(pro_before) <= $${paramIndex}::date`);
      queryParams.push(filters.proDateTo);
      paramIndex++;
    }

    havingClause = `AND ${havingConditions.join(' AND ')}`;
  }

  const query = `
    SELECT COUNT(*) as count FROM (
      SELECT
        u.telegram_user_id,
        (
          SELECT p.pro_before
          FROM alex_payments p
          WHERE p.telegram_user_id = u.telegram_user_id
          ORDER BY p.pro_before DESC NULLS LAST
          LIMIT 1
        ) as pro_before
      FROM alex_users u
      ${whereClause}
    ) as users_with_pro
    WHERE 1=1 ${havingClause}
  `;

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
 * Получает аналитику для дашборда
 */
async function getDashboardAnalytics() {
  const client = await pool.connect();

  try {
    // Summary
    const summaryQuery = `
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE status = 'active') as active_users,
        COUNT(*) FILTER (WHERE subscribe = 'pro') as pro_users
      FROM alex_users
    `;

    // DAU - last 30 days (active = написал хотя бы одно сообщение)
    const dauQuery = `
      WITH active_users AS (
        SELECT DISTINCT
          DATE(created_at) as date,
          telegram_user_id
        FROM alex_chat_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
      ),
      user_pro_status AS (
        SELECT
          au.date,
          au.telegram_user_id,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM alex_payments p
              WHERE p.telegram_user_id = au.telegram_user_id
                AND p.payment_date <= au.date
                AND p.pro_before >= au.date
                AND p.pro_before IS NOT NULL
            ) THEN 1
            ELSE 0
          END as is_pro
        FROM active_users au
      )
      SELECT
        date,
        COUNT(DISTINCT telegram_user_id) as total,
        COUNT(DISTINCT telegram_user_id) FILTER (WHERE is_pro = 1) as pro
      FROM user_pro_status
      GROUP BY date
      ORDER BY date
    `;

    // WAU - last 12 weeks (active = написал хотя бы одно сообщение)
    const wauQuery = `
      WITH active_users AS (
        SELECT DISTINCT
          date_trunc('week', created_at) as week,
          telegram_user_id
        FROM alex_chat_logs
        WHERE created_at >= NOW() - INTERVAL '12 weeks'
      ),
      user_pro_status AS (
        SELECT
          au.week,
          au.telegram_user_id,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM alex_payments p
              WHERE p.telegram_user_id = au.telegram_user_id
                AND p.payment_date <= (au.week + INTERVAL '6 days')::date
                AND p.pro_before >= au.week::date
                AND p.pro_before IS NOT NULL
            ) THEN 1
            ELSE 0
          END as is_pro
        FROM active_users au
      )
      SELECT
        TO_CHAR(week, 'IYYY-"W"IW') as week,
        COUNT(DISTINCT telegram_user_id) as total,
        COUNT(DISTINCT telegram_user_id) FILTER (WHERE is_pro = 1) as pro
      FROM user_pro_status
      GROUP BY week
      ORDER BY week
    `;

    // MAU - last 12 months (active = написал хотя бы одно сообщение)
    const mauQuery = `
      WITH active_users AS (
        SELECT DISTINCT
          date_trunc('month', created_at) as month,
          telegram_user_id
        FROM alex_chat_logs
        WHERE created_at >= NOW() - INTERVAL '12 months'
      ),
      user_pro_status AS (
        SELECT
          au.month,
          au.telegram_user_id,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM alex_payments p
              WHERE p.telegram_user_id = au.telegram_user_id
                AND p.payment_date <= (au.month + INTERVAL '1 month - 1 day')::date
                AND p.pro_before >= au.month::date
                AND p.pro_before IS NOT NULL
            ) THEN 1
            ELSE 0
          END as is_pro
        FROM active_users au
      )
      SELECT
        TO_CHAR(month, 'YYYY-MM') as month,
        COUNT(DISTINCT telegram_user_id) as total,
        COUNT(DISTINCT telegram_user_id) FILTER (WHERE is_pro = 1) as pro
      FROM user_pro_status
      GROUP BY month
      ORDER BY month
    `;

    // Growth
    const growthQuery = `
      WITH daily_new AS (
        SELECT
          DATE(created_at) as date,
          COUNT(*) as new_users
        FROM alex_users
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY DATE(created_at)
      )
      SELECT
        date,
        new_users,
        SUM(new_users) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as total_users
      FROM daily_new
      ORDER BY date
    `;

    // Revenue - current and previous periods
    const revenueQuery = `
      SELECT
        -- Current periods - revenue
        COALESCE(SUM(amount::numeric) FILTER (WHERE DATE(payment_date) = CURRENT_DATE), 0) as today,
        COALESCE(SUM(amount::numeric) FILTER (WHERE payment_date >= date_trunc('week', CURRENT_DATE) AND payment_date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'), 0) as this_week,
        COALESCE(SUM(amount::numeric) FILTER (WHERE payment_date >= date_trunc('month', CURRENT_DATE) AND payment_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'), 0) as this_month,

        -- Previous periods - revenue
        COALESCE(SUM(amount::numeric) FILTER (WHERE DATE(payment_date) = CURRENT_DATE - INTERVAL '1 day'), 0) as yesterday,
        COALESCE(SUM(amount::numeric) FILTER (WHERE payment_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' AND payment_date < date_trunc('week', CURRENT_DATE)), 0) as last_week,
        COALESCE(SUM(amount::numeric) FILTER (WHERE payment_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' AND payment_date < date_trunc('month', CURRENT_DATE)), 0) as last_month,

        -- Current periods - payment count
        COUNT(*) FILTER (WHERE DATE(payment_date) = CURRENT_DATE) as today_count,
        COUNT(*) FILTER (WHERE payment_date >= date_trunc('week', CURRENT_DATE) AND payment_date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week') as this_week_count,
        COUNT(*) FILTER (WHERE payment_date >= date_trunc('month', CURRENT_DATE) AND payment_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month') as this_month_count,

        -- Previous periods - payment count
        COUNT(*) FILTER (WHERE DATE(payment_date) = CURRENT_DATE - INTERVAL '1 day') as yesterday_count,
        COUNT(*) FILTER (WHERE payment_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' AND payment_date < date_trunc('week', CURRENT_DATE)) as last_week_count,
        COUNT(*) FILTER (WHERE payment_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' AND payment_date < date_trunc('month', CURRENT_DATE)) as last_month_count,

        -- Current period dates
        CURRENT_DATE as today_date,
        date_trunc('week', CURRENT_DATE)::date as week_start,
        (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date as week_end,
        date_trunc('month', CURRENT_DATE)::date as month_start,
        (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date as month_end,

        -- Previous period dates
        (CURRENT_DATE - INTERVAL '1 day')::date as yesterday_date,
        (date_trunc('week', CURRENT_DATE) - INTERVAL '1 week')::date as last_week_start,
        (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date as last_week_end,
        (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date as last_month_start,
        (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date as last_month_end
      FROM alex_payments
    `;

    // Messages statistics - daily count for last 30 days (total and PRO)
    const messagesQuery = `
      SELECT
        DATE(cl.created_at) as date,
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE u.subscribe = 'pro') as pro_messages
      FROM alex_chat_logs cl
      LEFT JOIN alex_users u ON cl.telegram_user_id = u.telegram_user_id
      WHERE cl.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(cl.created_at)
      ORDER BY date
    `;

    // Active PRO users over time - last 30 days
    const activePaidUsersQuery = `
      WITH days AS (
        SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, interval '1 day')::date AS day
      ),
      user_day AS (
        SELECT
          d.day,
          p.telegram_user_id,
          MAX(p.pro_before) AS pro_until
        FROM days d
        JOIN alex_payments p
          ON p.payment_date <= d.day
         AND p.pro_before IS NOT NULL
        GROUP BY d.day, p.telegram_user_id
      )
      SELECT
        d.day as date,
        COALESCE(COUNT(*) FILTER (WHERE ud.pro_until >= d.day), 0) AS active_pro_users
      FROM days d
      LEFT JOIN user_day ud ON ud.day = d.day
      GROUP BY d.day
      ORDER BY d.day
    `;

    // Messages count - current and previous periods
    const messagesCountQuery = `
      SELECT
        -- Current periods
        COALESCE(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0) as today,
        COALESCE(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) as this_week,
        COALESCE(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) as this_month,

        -- Previous periods
        COALESCE(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '48 hours' AND created_at < NOW() - INTERVAL '24 hours'), 0) as yesterday,
        COALESCE(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'), 0) as last_week,
        COALESCE(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'), 0) as last_month
      FROM alex_chat_logs
    `;

    // Sources
    const sourcesQuery = `
      SELECT
        CASE
          WHEN ref LIKE 'yandex-%' OR ref LIKE 'ya-direct%' THEN 'Яндекс.Директ'
          WHEN ref IS NULL OR ref = '' THEN 'Органика'
          ELSE 'Другое'
        END as source,
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE subscribe = 'pro') as pro_users,
        ROUND(COUNT(*) FILTER (WHERE subscribe = 'pro')::numeric / NULLIF(COUNT(*)::numeric, 0) * 100, 2) as conversion_rate
      FROM alex_users
      GROUP BY source
      ORDER BY total_users DESC
    `;

    // Current rolling DAU/WAU/MAU with comparison to previous period (active = написал сообщение)
    const rollingMetricsQuery = `
      SELECT
        -- Current DAU (last 24 hours)
        COUNT(DISTINCT telegram_user_id) FILTER (
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        ) as current_dau,

        -- Previous DAU (24-48 hours ago)
        COUNT(DISTINCT telegram_user_id) FILTER (
          WHERE created_at >= NOW() - INTERVAL '48 hours'
            AND created_at < NOW() - INTERVAL '24 hours'
        ) as previous_dau,

        -- Current WAU (last 7 days)
        COUNT(DISTINCT telegram_user_id) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
        ) as current_wau,

        -- Previous WAU (7-14 days ago)
        COUNT(DISTINCT telegram_user_id) FILTER (
          WHERE created_at >= NOW() - INTERVAL '14 days'
            AND created_at < NOW() - INTERVAL '7 days'
        ) as previous_wau,

        -- Current MAU (last 30 days)
        COUNT(DISTINCT telegram_user_id) FILTER (
          WHERE created_at >= NOW() - INTERVAL '30 days'
        ) as current_mau,

        -- Previous MAU (30-60 days ago)
        COUNT(DISTINCT telegram_user_id) FILTER (
          WHERE created_at >= NOW() - INTERVAL '60 days'
            AND created_at < NOW() - INTERVAL '30 days'
        ) as previous_mau
      FROM alex_chat_logs
    `;

    // NPS All Users - 21-day rolling window (Net Promoter Score methodology)
    // Promoters: >= 8, Passives: 7, Detractors: <= 6
    const npsAllQuery = `
      WITH all_responses AS (
        SELECT
          nps_answered_at,
          nps_score
        FROM alex_users
        WHERE nps_answered_at >= NOW() - INTERVAL '21 days'
          AND nps_score IS NOT NULL
      )
      SELECT
        COUNT(*) FILTER (WHERE nps_score::numeric >= 8) as promoters,
        COUNT(*) FILTER (WHERE nps_score::numeric = 7) as passives,
        COUNT(*) FILTER (WHERE nps_score::numeric <= 6) as detractors,
        COUNT(*) as total_responses,
        ROUND(
          (COUNT(*) FILTER (WHERE nps_score::numeric >= 8)::numeric / NULLIF(COUNT(*), 0) * 100) -
          (COUNT(*) FILTER (WHERE nps_score::numeric <= 6)::numeric / NULLIF(COUNT(*), 0) * 100),
          1
        ) as nps_score
      FROM all_responses
    `;

    // NPS Paying Users - 21-day rolling window (Net Promoter Score methodology)
    // Only for users who have ever paid (exist in alex_payments table)
    // Promoters: >= 8, Passives: 7, Detractors: <= 6
    const npsPayingQuery = `
      WITH paying_users AS (
        SELECT DISTINCT telegram_user_id
        FROM alex_payments
      ),
      paying_responses AS (
        SELECT
          u.nps_answered_at,
          u.nps_score
        FROM alex_users u
        INNER JOIN paying_users pu ON u.telegram_user_id = pu.telegram_user_id
        WHERE u.nps_answered_at >= NOW() - INTERVAL '21 days'
          AND u.nps_score IS NOT NULL
      )
      SELECT
        COUNT(*) FILTER (WHERE nps_score::numeric >= 8) as promoters,
        COUNT(*) FILTER (WHERE nps_score::numeric = 7) as passives,
        COUNT(*) FILTER (WHERE nps_score::numeric <= 6) as detractors,
        COUNT(*) as total_responses,
        ROUND(
          (COUNT(*) FILTER (WHERE nps_score::numeric >= 8)::numeric / NULLIF(COUNT(*), 0) * 100) -
          (COUNT(*) FILTER (WHERE nps_score::numeric <= 6)::numeric / NULLIF(COUNT(*), 0) * 100),
          1
        ) as nps_score
      FROM paying_responses
    `;

    // Daily revenue comparison - current month vs previous month
    const dailyRevenueQuery = `
      WITH current_month_days AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE),
          date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day',
          INTERVAL '1 day'
        )::date as day
      ),
      previous_month_days AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '1 month',
          date_trunc('month', CURRENT_DATE) - INTERVAL '1 day',
          INTERVAL '1 day'
        )::date as day
      ),
      current_month_revenue AS (
        SELECT
          DATE(payment_date) as day,
          COALESCE(SUM(amount::numeric), 0) as revenue
        FROM alex_payments
        WHERE payment_date >= date_trunc('month', CURRENT_DATE)
          AND payment_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY DATE(payment_date)
      ),
      previous_month_revenue AS (
        SELECT
          DATE(payment_date) as day,
          COALESCE(SUM(amount::numeric), 0) as revenue
        FROM alex_payments
        WHERE payment_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
          AND payment_date < date_trunc('month', CURRENT_DATE)
        GROUP BY DATE(payment_date)
      )
      SELECT
        EXTRACT(DAY FROM cmd.day)::integer as day_of_month,
        COALESCE(cmr.revenue, 0) as current_month_revenue,
        COALESCE(pmr.revenue, 0) as previous_month_revenue,
        to_char(cmd.day, 'YYYY-MM-DD') as current_month_date,
        to_char(pmd.day, 'YYYY-MM-DD') as previous_month_date
      FROM current_month_days cmd
      LEFT JOIN current_month_revenue cmr ON cmd.day = cmr.day
      LEFT JOIN previous_month_days pmd ON EXTRACT(DAY FROM cmd.day) = EXTRACT(DAY FROM pmd.day)
      LEFT JOIN previous_month_revenue pmr ON pmd.day = pmr.day
      ORDER BY day_of_month
    `;

    // Execute all queries in parallel
    const [summary, dau, wau, mau, growth, revenue, sources, rollingMetrics, npsAll, npsPaying, messages, messagesCount, dailyRevenue, activePaidUsers] = await Promise.all([
      client.query(summaryQuery),
      client.query(dauQuery),
      client.query(wauQuery),
      client.query(mauQuery),
      client.query(growthQuery),
      client.query(revenueQuery),
      client.query(sourcesQuery),
      client.query(rollingMetricsQuery),
      client.query(npsAllQuery),
      client.query(npsPayingQuery),
      client.query(messagesQuery),
      client.query(messagesCountQuery),
      client.query(dailyRevenueQuery),
      client.query(activePaidUsersQuery)
    ]);

    return {
      summary: summary.rows[0],
      dau: dau.rows,
      wau: wau.rows,
      mau: mau.rows,
      growth: growth.rows,
      revenue: revenue.rows[0],
      sources: sources.rows,
      rollingMetrics: rollingMetrics.rows[0],
      npsAll: npsAll.rows,
      npsPaying: npsPaying.rows,
      messages: messages.rows,
      messagesCount: messagesCount.rows[0],
      dailyRevenue: dailyRevenue.rows,
      activePaidUsers: activePaidUsers.rows
    };
  } finally {
    client.release();
  }
}

/**
 * Получает распределение платежей по дням после регистрации
 * Разделяет на первые и повторные оплаты
 */
async function getPaymentDistributionByDays() {
  const client = await pool.connect();

  try {
    const query = `
      WITH user_payments AS (
        SELECT
          p.telegram_user_id,
          p.payment_date,
          p.amount::numeric as amount,
          u.created_at as user_created_at,
          (p.payment_date - u.created_at::date) as days_after_registration,
          ROW_NUMBER() OVER (PARTITION BY p.telegram_user_id ORDER BY p.payment_date) as payment_number
        FROM alex_payments p
        JOIN alex_users u ON p.telegram_user_id = u.telegram_user_id
        WHERE p.payment_date IS NOT NULL AND u.created_at IS NOT NULL
      ),
      categorized_payments AS (
        SELECT
          CASE
            WHEN days_after_registration > 90 THEN 91
            WHEN days_after_registration < 0 THEN 0
            ELSE days_after_registration
          END as day_group,
          CASE
            WHEN payment_number = 1 THEN 'first'
            ELSE 'repeat'
          END as payment_type,
          amount
        FROM user_payments
      )
      SELECT
        day_group,
        COUNT(*) FILTER (WHERE payment_type = 'first') as first_payment_count,
        COUNT(*) FILTER (WHERE payment_type = 'repeat') as repeat_payment_count,
        ROUND(AVG(amount) FILTER (WHERE payment_type = 'first'), 2) as first_avg_amount,
        ROUND(AVG(amount) FILTER (WHERE payment_type = 'repeat'), 2) as repeat_avg_amount,
        ROUND(SUM(amount) FILTER (WHERE payment_type = 'first'), 2) as first_total_amount,
        ROUND(SUM(amount) FILTER (WHERE payment_type = 'repeat'), 2) as repeat_total_amount
      FROM categorized_payments
      GROUP BY day_group
      ORDER BY day_group
    `;

    const result = await client.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error getting payment distribution:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Получает распределение количества сообщений в день для платящих пользователей
 * (всех, кто когда-либо совершал платежи) за последние 30 дней
 */
async function getProMessagesDistribution() {
  const client = await pool.connect();

  try {
    // Считаем реальное количество сообщений из alex_chat_logs
    // Группируем по пользователям и дням, затем строим распределение
    const query = `
      WITH daily_messages AS (
        SELECT
          cl.telegram_user_id,
          DATE(cl.created_at) as message_date,
          COUNT(*) as messages_per_day
        FROM alex_chat_logs cl
        WHERE cl.telegram_user_id IN (
            SELECT DISTINCT telegram_user_id
            FROM alex_payments
          )
          AND cl.created_at >= NOW() - INTERVAL '30 days'
          AND cl.role = 'user'
        GROUP BY cl.telegram_user_id, DATE(cl.created_at)
      )
      SELECT
        messages_per_day as message_count,
        COUNT(*) as user_count
      FROM daily_messages
      GROUP BY messages_per_day
      ORDER BY messages_per_day
    `;

    const result = await client.query(query);

    // Рассчитать среднее, медиану и стандартное отклонение
    const stats = await client.query(`
      WITH daily_messages AS (
        SELECT
          cl.telegram_user_id,
          DATE(cl.created_at) as message_date,
          COUNT(*) as messages_per_day
        FROM alex_chat_logs cl
        WHERE cl.telegram_user_id IN (
            SELECT DISTINCT telegram_user_id
            FROM alex_payments
          )
          AND cl.created_at >= NOW() - INTERVAL '30 days'
          AND cl.role = 'user'
        GROUP BY cl.telegram_user_id, DATE(cl.created_at)
      )
      SELECT
        AVG(messages_per_day) as mean,
        STDDEV(messages_per_day) as stddev,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY messages_per_day) as median,
        COUNT(*) as total_users,
        MIN(messages_per_day) as min_count,
        MAX(messages_per_day) as max_count
      FROM daily_messages
    `);

    return {
      distribution: result.rows,
      stats: stats.rows[0]
    };
  } catch (error) {
    console.error('Error getting PRO messages distribution:', error);
    throw error;
  } finally {
    client.release();
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

/**
 * Get revenue for a specific date
 */
async function getRevenueForDate(date) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        COALESCE(SUM(amount::numeric), 0) as revenue,
        COUNT(*) as payment_count,
        $1::date as date
      FROM alex_payments
      WHERE DATE(payment_date) = $1::date
    `;

    const result = await client.query(query, [date]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Get revenue for a specific week (by week start date)
 * Returns dates as text to avoid timezone conversion issues
 */
async function getRevenueForWeek(weekStartDate) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        COALESCE(SUM(amount::numeric), 0) as revenue,
        COUNT(*) as payment_count,
        $1::date::text as week_start,
        ($1::date + INTERVAL '6 days')::date::text as week_end
      FROM alex_payments
      WHERE payment_date >= $1::date
        AND payment_date < $1::date + INTERVAL '7 days'
    `;

    const result = await client.query(query, [weekStartDate]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Get list of last N weeks with start/end dates
 * Returns dates at local timezone (not UTC) for correct display
 */
async function getRecentWeeks(count = 5) {
  const client = await pool.connect();

  try {
    const query = `
      WITH weeks AS (
        SELECT
          generate_series(
            date_trunc('week', CURRENT_DATE) - INTERVAL '${count - 1} weeks',
            date_trunc('week', CURRENT_DATE),
            INTERVAL '1 week'
          )::date as week_start
      )
      SELECT
        week_start::text as week_start,
        (week_start + INTERVAL '6 days')::date::text as week_end
      FROM weeks
      ORDER BY week_start DESC
    `;

    const result = await client.query(query);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Update user status (for ban/unban)
 */
async function updateUserStatus(telegramUserId, status) {
  const query = `
    UPDATE alex_users
    SET status = $1, updated_at = NOW()
    WHERE telegram_user_id = $2
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [status, telegramUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
}

/**
 * Update user subscription (for PRO enable/disable)
 */
async function updateUserSubscribe(telegramUserId, subscribe) {
  const query = `
    UPDATE alex_users
    SET subscribe = $1, updated_at = NOW()
    WHERE telegram_user_id = $2
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [subscribe, telegramUserId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
}

module.exports = {
  pool,
  getUserInfo,
  getTherapyProfile,
  getUserQuestions,
  getUserMoodLogs,
  getPayments,
  getChatLogs,
  getUsersList,
  getUsersCount,
  getAllPayments,
  getPaymentsCount,
  getDashboardAnalytics,
  getPaymentDistributionByDays,
  getProMessagesDistribution,
  getRevenueForDate,
  getRevenueForWeek,
  getRecentWeeks,
  checkConnection,
  updateUserStatus,
  updateUserSubscribe
};
