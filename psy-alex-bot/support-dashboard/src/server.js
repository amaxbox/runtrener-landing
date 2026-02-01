require('dotenv').config();
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
const fs = require('fs');
const { getAdapter } = require('./adapters/factory');
const botConfigs = require('./config/bots');
const dbManager = require('./db/manager');

// Backward compatibility: import postgres.js functions for non-adapter routes
const {
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
} = require('./db/postgres');

const app = express();

// Trust proxy - needed for correct IP detection behind nginx
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3005;
const SUPPORT_PASSWORD = process.env.SUPPORT_PASSWORD || 'support2025';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const PASSWORD_HASH = process.env.PASSWORD_HASH || null;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// System prompt for dialog analysis
const DEFAULT_ANALYSIS_SYSTEM_PROMPT = `Ты — супервизор и эксперт по качеству психологической помощи.

На вход ты получаешь диалог между клиентом и психологом.

Твоя задача — провести профессиональную оценку работы психолога.

Проанализируй и выдели:
	•	позитивные моменты: точная эмпатия, корректная валидация, уместные вопросы, поддержание терапевтической позиции;
	•	ошибки и слабые места: давление, советы без запроса, пропуск ключевых сигналов клиента, методические и логические ошибки, преждевременные интерпретации или диагнозы, неясные или потенциально вредные формулировки.

Формат вывода:
	1.	Позитивные моменты — краткий список.
	2.	Ошибки и риски — краткий список.

Без рекомендаций, без переписывания диалога, без оценочных суждений о личности психолога.`;

// Global system prompt (can be modified)
let currentSystemPrompt = DEFAULT_ANALYSIS_SYSTEM_PROMPT;

// Path to store custom system prompt
const SYSTEM_PROMPT_FILE = path.join(__dirname, 'system-prompt.txt');

// Load system prompt from file if exists
function loadSystemPromptFromFile() {
  try {
    if (fs.existsSync(SYSTEM_PROMPT_FILE)) {
      const savedPrompt = fs.readFileSync(SYSTEM_PROMPT_FILE, 'utf8');
      if (savedPrompt && savedPrompt.trim().length > 0) {
        currentSystemPrompt = savedPrompt.trim();
        console.log('✅ System prompt loaded from file');
        return true;
      }
    }
  } catch (error) {
    console.error('❌ Error loading system prompt from file:', error);
  }
  return false;
}

// Save system prompt to file
function saveSystemPromptToFile(prompt) {
  try {
    fs.writeFileSync(SYSTEM_PROMPT_FILE, prompt, 'utf8');
    console.log('✅ System prompt saved to file');
    return true;
  } catch (error) {
    console.error('❌ Error saving system prompt to file:', error);
    return false;
  }
}

// Load system prompt on startup
loadSystemPromptFromFile();

// Generate password hash on startup if not provided
let passwordHash = PASSWORD_HASH;
if (!passwordHash) {
  passwordHash = bcrypt.hashSync(SUPPORT_PASSWORD, 10);
  console.log('⚠️  WARNING: Using plain password. Set PASSWORD_HASH in .env');
  console.log(`   Generate hash: bcrypt.hashSync("${SUPPORT_PASSWORD}", 10)`);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware для логирования (без чувствительных данных)
app.use((req, res, next) => {
  const logUrl = req.url.includes('password') ? req.url.split('?')[0] : req.url;
  console.log(`${new Date().toISOString()} - ${req.method} ${logUrl}`);
  next();
});

// Rate limiter для эндпоинта авторизации
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Log failed attempts
  handler: (req, res) => {
    console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many login attempts, please try again later' });
  }
});

// Middleware для проверки JWT токена
function checkAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.warn(`⚠️  Invalid token attempt from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
}

// Middleware для определения бота
function detectBot(req, res, next) {
  // Получаем botId из query parameter или header, по умолчанию 'alex'
  const botId = req.query.botId || req.headers['x-bot-id'] || 'alex';

  // Валидация botId
  if (!botConfigs[botId]) {
    return res.status(400).json({ error: 'Invalid bot ID' });
  }

  req.botId = botId;
  next();
}

/**
 * Проверка пароля и выдача JWT токена
 */
app.post('/api/auth', authLimiter, async (req, res) => {
  const { password } = req.body;

  try {
    // Use bcrypt to compare password
    const isValid = await bcrypt.compare(password, passwordHash);

    if (isValid) {
      // Generate JWT token valid for 24 hours
      const token = jwt.sign(
        { authenticated: true, timestamp: Date.now() },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`✅ Successful login from IP: ${req.ip}`);
      res.json({ success: true, token });
    } else {
      console.warn(`⚠️  Failed login attempt from IP: ${req.ip}`);
      res.status(401).json({ success: false, message: 'Неверный пароль' });
    }
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * Получение списка доступных ботов
 */
app.get('/api/bots', checkAuth, (req, res) => {
  try {
    // Возвращаем только публичную информацию о ботах
    const bots = Object.keys(botConfigs).map(id => ({
      id: botConfigs[id].id,
      name: botConfigs[id].name,
      color: botConfigs[id].color
    }));

    res.json(bots);
  } catch (error) {
    console.error('Error fetching bots:', error);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

/**
 * Получение всех данных пользователя
 */
app.get('/api/user/:telegramUserId', checkAuth, detectBot, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    const adapter = getAdapter(req.botId);

    // Параллельно загружаем все данные
    const [userInfo, userQuestions, therapyProfile, payments, chatLogs] = await Promise.all([
      adapter.getUserInfo(telegramUserId),
      adapter.getUserQuestions(telegramUserId),
      adapter.getTherapyProfile(telegramUserId),
      adapter.getPayments(telegramUserId),
      adapter.getChatLogs(telegramUserId, null) // Load all messages
    ]);

    if (!userInfo) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userInfo,
      userQuestions,
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
 * Получение данных о настроении пользователя для конкретного вопроса
 */
app.get('/api/user/:telegramUserId/mood/:questionId', checkAuth, detectBot, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    const questionId = parseInt(req.params.questionId);
    const days = parseInt(req.query.days) || 7;

    if (isNaN(telegramUserId) || isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const adapter = getAdapter(req.botId);
    const moodLogs = await adapter.getUserMoodLogs(telegramUserId, questionId, days);
    res.json(moodLogs);
  } catch (error) {
    console.error('Error fetching mood logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Получение только информации о пользователе
 */
app.get('/api/user/:telegramUserId/info', checkAuth, detectBot, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    const adapter = getAdapter(req.botId);
    const userInfo = await adapter.getUserInfo(telegramUserId);

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
app.get('/api/user/:telegramUserId/chat', checkAuth, detectBot, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    const limit = parseInt(req.query.limit) || 100;

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    const adapter = getAdapter(req.botId);
    const chatLogs = await adapter.getChatLogs(telegramUserId, limit);

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
 * Получение текущего системного промпта
 */
app.get('/api/system-prompt', checkAuth, async (req, res) => {
  try {
    res.json({
      prompt: currentSystemPrompt,
      isDefault: currentSystemPrompt === DEFAULT_ANALYSIS_SYSTEM_PROMPT
    });
  } catch (error) {
    console.error('Error fetching system prompt:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Сохранение системного промпта
 */
app.post('/api/system-prompt', checkAuth, async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Промпт не может быть пустым'
      });
    }

    // Update global system prompt
    currentSystemPrompt = prompt.trim();

    // Save to file
    saveSystemPromptToFile(currentSystemPrompt);

    console.log(`✅ System prompt updated (length: ${currentSystemPrompt.length})`);

    res.json({
      success: true,
      message: 'Промпт успешно сохранен'
    });
  } catch (error) {
    console.error('Error saving system prompt:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Анализ диалога пользователя через OpenAI
 */
app.post('/api/user/:telegramUserId/analyze-dialog', checkAuth, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Get all chat logs for this user
    const chatLogs = await getChatLogs(telegramUserId, null);

    if (!chatLogs || chatLogs.length === 0) {
      return res.json({ analysis: 'Диалог пуст, нечего анализировать.' });
    }

    // Format dialog for analysis
    let dialogText = '';
    chatLogs.forEach(log => {
      if (log.user_input) {
        dialogText += `Клиент: ${log.user_input}\n\n`;
      }
      if (log.model_output) {
        dialogText += `Психолог (Алекс): ${log.model_output}\n\n`;
      }
    });

    // Call OpenAI API with current system prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: currentSystemPrompt },
        { role: 'user', content: dialogText }
      ],
      temperature: 0.7,
      max_completion_tokens: 4000
    });

    const analysis = completion.choices[0]?.message?.content || 'Не удалось получить анализ';

    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing dialog:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Toggle user ban status
 */
app.post('/api/user/:telegramUserId/ban', checkAuth, detectBot, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    const { action } = req.body;

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    if (!action || !['ban', 'unban'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "ban" or "unban"' });
    }

    const newStatus = action === 'ban' ? 'ban' : 'active';

    const adapter = getAdapter(req.botId);
    const result = await adapter.updateUserStatus(telegramUserId, newStatus);

    if (result) {
      console.log(`✅ User ${telegramUserId} status changed to: ${newStatus}`);
      res.json({ success: true, status: newStatus });
    } else {
      throw new Error('Failed to update user status');
    }
  } catch (error) {
    console.error('Error toggling ban:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Toggle user PRO subscription
 */
app.post('/api/user/:telegramUserId/pro', checkAuth, detectBot, async (req, res) => {
  try {
    const telegramUserId = parseInt(req.params.telegramUserId);
    const { action } = req.body;

    if (isNaN(telegramUserId)) {
      return res.status(400).json({ error: 'Invalid telegram_user_id' });
    }

    if (!action || !['enable', 'disable'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "enable" or "disable"' });
    }

    const newSubscribe = action === 'enable' ? 'pro' : 'free';

    const adapter = getAdapter(req.botId);
    const result = await adapter.updateUserSubscribe(telegramUserId, newSubscribe);

    if (result) {
      console.log(`✅ User ${telegramUserId} subscribe changed to: ${newSubscribe}`);
      res.json({ success: true, subscribe: newSubscribe });
    } else {
      throw new Error('Failed to update user subscription');
    }
  } catch (error) {
    console.error('Error toggling PRO:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Получение списка пользователей с фильтрами
 */
app.get('/api/users', checkAuth, detectBot, async (req, res) => {
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
      dateTo: req.query.dateTo || '',
      proDateFrom: req.query.proDateFrom || '',
      proDateTo: req.query.proDateTo || ''
    };

    const adapter = getAdapter(req.botId);
    const result = await adapter.getUsersList(filters, sortBy, sortOrder, limit, offset);

    res.json({
      users: result.users,
      total: result.total,
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
app.get('/api/payments', checkAuth, detectBot, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const filters = {
      userId: req.query.userId || '',
      dateFrom: req.query.dateFrom || '',
      dateTo: req.query.dateTo || ''
    };

    const adapter = getAdapter(req.botId);
    const [payments, total] = await Promise.all([
      adapter.getAllPayments(filters, limit, offset),
      adapter.getPaymentsCount(filters)
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

/**
 * Dashboard analytics
 */
app.get('/api/analytics/dashboard', checkAuth, detectBot, async (req, res) => {
  try {
    const adapter = getAdapter(req.botId);
    const [analytics, paymentDistribution] = await Promise.all([
      adapter.getDashboardAnalytics(),
      adapter.getPaymentDistributionByDays()
    ]);

    console.log(`Dashboard analytics for bot ${req.botId}:`, {
      hasSummary: !!analytics.summary,
      summaryKeys: analytics.summary ? Object.keys(analytics.summary) : [],
      dauLength: analytics.dau?.length,
      wauLength: analytics.wau?.length
    });

    res.json({
      ...analytics,
      paymentDistribution
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Get revenue for specific date
 */
app.get('/api/analytics/revenue/date/:date', checkAuth, detectBot, async (req, res) => {
  try {
    const { date } = req.params;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
    }

    const adapter = getAdapter(req.botId);
    const revenue = await adapter.getRevenueForDate(date);
    res.json(revenue);
  } catch (error) {
    console.error('Error fetching revenue for date:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Get revenue for specific week
 */
app.get('/api/analytics/revenue/week/:weekStartDate', checkAuth, detectBot, async (req, res) => {
  try {
    const { weekStartDate } = req.params;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
    }

    const adapter = getAdapter(req.botId);
    const revenue = await adapter.getRevenueForWeek(weekStartDate);
    res.json(revenue);
  } catch (error) {
    console.error('Error fetching revenue for week:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Get list of recent weeks
 */
app.get('/api/analytics/weeks/recent', checkAuth, detectBot, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 5;
    const adapter = getAdapter(req.botId);
    const weeks = await adapter.getRecentWeeks(count);
    res.json(weeks);
  } catch (error) {
    console.error('Error fetching recent weeks:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Healthcheck endpoint
app.get('/health', async (req, res) => {
  try {
    const botId = req.query.botId || 'alex';
    const adapter = getAdapter(botId);
    const dbOk = await adapter.checkConnection();
    res.json({
      status: dbOk ? 'ok' : 'error',
      database: dbOk ? 'connected' : 'disconnected',
      botId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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
