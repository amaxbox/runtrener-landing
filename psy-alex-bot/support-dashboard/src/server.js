require('dotenv').config();
const express = require('express');
const path = require('path');
const {
  getUserInfo,
  getTherapyProfile,
  getPayments,
  getChatLogs,
  getUsersList,
  getUsersCount,
  getAllPayments,
  getPaymentsCount,
  checkConnection
} = require('./db/postgres');

const app = express();
const PORT = process.env.PORT || 3005;
const SUPPORT_PASSWORD = process.env.SUPPORT_PASSWORD || 'support2025';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware для логирования
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware для проверки пароля
function checkAuth(req, res, next) {
  const password = req.headers['x-support-password'];

  if (password !== SUPPORT_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid password' });
  }

  next();
}

/**
 * Проверка пароля
 */
app.post('/api/auth', (req, res) => {
  const { password } = req.body;

  if (password === SUPPORT_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Неверный пароль' });
  }
});

/**
 * Получение всех данных пользователя
 */
app.get('/api/user/:telegramUserId', checkAuth, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    // Параллельно загружаем все данные
    const [userInfo, therapyProfile, payments, chatLogs] = await Promise.all([
      getUserInfo(telegramUserId),
      getTherapyProfile(telegramUserId),
      getPayments(telegramUserId),
      getChatLogs(telegramUserId, 100)
    ]);

    if (!userInfo) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userInfo,
      therapyProfile,
      payments,
      chatLogs
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Получение только информации о пользователе
 */
app.get('/api/user/:telegramUserId/info', checkAuth, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    const userInfo = await getUserInfo(telegramUserId);

    if (!userInfo) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userInfo);
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Получение истории чата с пагинацией
 */
app.get('/api/user/:telegramUserId/chat', checkAuth, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    const limit = parseInt(req.query.limit) || 100;

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    const chatLogs = await getChatLogs(telegramUserId, limit);

    res.json(chatLogs);
  } catch (error) {
    console.error('Error fetching chat logs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Получение списка пользователей с фильтрами
 */
app.get('/api/users', checkAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    const filters = {
      search: req.query.search || '',
      subscribe: req.query.subscribe || '',
      status: req.query.status || '',
      dateFrom: req.query.dateFrom || '',
      dateTo: req.query.dateTo || ''
    };

    const [users, total] = await Promise.all([
      getUsersList(limit, offset, filters, sortBy, sortOrder),
      getUsersCount(filters)
    ]);

    res.json({
      users,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching users list:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Получение реестра платежей (Payments Registry)
 */
app.get('/api/payments', checkAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const filters = {
      userId: req.query.userId || '',
      dateFrom: req.query.dateFrom || '',
      dateTo: req.query.dateTo || ''
    };

    const [payments, total] = await Promise.all([
      getAllPayments(limit, offset, filters),
      getPaymentsCount(filters)
    ]);

    res.json({
      payments,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Healthcheck endpoint
app.get('/health', async (req, res) => {
  const dbOk = await checkConnection();
  res.json({
    status: dbOk ? 'ok' : 'error',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`🚀 Support Dashboard server running on port ${PORT}`);
  console.log(`📊 Dashboard URL: http://localhost:${PORT}`);

  // Проверяем соединение с БД при старте
  const dbOk = await checkConnection();
  if (dbOk) {
    console.log('✅ PostgreSQL connection verified');
  } else {
    console.error('❌ PostgreSQL connection failed');
  }
});
