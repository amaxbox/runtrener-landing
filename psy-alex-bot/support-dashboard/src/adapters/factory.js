const dbManager = require('../db/manager');
const { botConfigs } = dbManager;

// Кеш адаптеров
const adapters = {};

/**
 * Получает адаптер для конкретного бота
 */
function getAdapter(botId) {
  if (!botConfigs[botId]) {
    throw new Error(`Unknown bot: ${botId}`);
  }

  if (!adapters[botId]) {
    const config = botConfigs[botId];
    const connection = dbManager.getConnection(botId);

    if (config.type === 'postgres' && botId === 'alex') {
      // Для Alex бота используем существующие функции из postgres.js
      const AlexAdapter = require('./alex.adapter');
      adapters[botId] = new AlexAdapter(connection);
    } else if (config.type === 'supabase' && botId === 'strava') {
      // Для Strava бота используем Supabase адаптер
      const StravaAdapter = require('./strava.adapter');
      adapters[botId] = new StravaAdapter(connection, config);
    } else {
      throw new Error(`No adapter available for bot: ${botId} (type: ${config.type})`);
    }
  }

  return adapters[botId];
}

module.exports = { getAdapter };
