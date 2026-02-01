const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const botConfigs = require('../config/bots');

// Хранилище активных подключений
const connections = {};

/**
 * Строит connection string для PostgreSQL
 */
function buildConnectionString(config) {
  return `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
}

/**
 * Инициализирует подключение для бота
 */
function initializeConnection(botId, config) {
  console.log(`Initializing connection for bot: ${botId} (type: ${config.type})`);

  if (config.type === 'postgres') {
    // Создаем PostgreSQL pool
    return new Pool({
      connectionString: buildConnectionString(config.database),
      ssl: config.database.ssl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
  } else if (config.type === 'supabase') {
    // Создаем Supabase client
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error(`Supabase configuration incomplete for bot: ${botId}`);
    }
    return createClient(config.supabaseUrl, config.supabaseKey);
  }

  throw new Error(`Unknown connection type: ${config.type} for bot: ${botId}`);
}

/**
 * Получает подключение для конкретного бота
 */
function getConnection(botId) {
  if (!botConfigs[botId]) {
    throw new Error(`Bot configuration not found: ${botId}`);
  }

  if (!connections[botId]) {
    const config = botConfigs[botId];
    connections[botId] = initializeConnection(botId, config);
  }

  return connections[botId];
}

/**
 * Закрывает все активные подключения
 */
async function closeAll() {
  const closePromises = Object.entries(connections).map(async ([botId, connection]) => {
    try {
      const config = botConfigs[botId];

      if (config.type === 'postgres' && connection.end) {
        await connection.end();
        console.log(`Closed PostgreSQL connection for bot: ${botId}`);
      }
      // Supabase клиент не требует явного закрытия

    } catch (error) {
      console.error(`Error closing connection for bot ${botId}:`, error);
    }
  });

  await Promise.all(closePromises);
  Object.keys(connections).forEach(key => delete connections[key]);
}

/**
 * Проверяет подключение для бота
 */
async function checkConnection(botId) {
  const connection = getConnection(botId);
  const config = botConfigs[botId];

  if (config.type === 'postgres') {
    // PostgreSQL проверка
    const client = await connection.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } else if (config.type === 'supabase') {
    // Supabase проверка - простой запрос
    const { error } = await connection.from('users_pasha').select('id', { count: 'exact', head: true }).limit(1);
    if (error) throw error;
    return true;
  }

  return false;
}

module.exports = {
  getConnection,
  closeAll,
  checkConnection,
  botConfigs
};
