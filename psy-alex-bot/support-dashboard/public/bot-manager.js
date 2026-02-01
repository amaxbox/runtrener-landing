/**
 * Bot Manager - Client-side bot switching
 * Manages current bot selection and provides API for bot switching
 */

class BotManager {
  constructor() {
    this.currentBotId = this.loadBotId() || 'alex';
    this.bots = {};
    this.initialized = false;
  }

  /**
   * Initialize bot manager - load available bots from server
   */
  async init() {
    if (this.initialized) return;

    try {
      // Use supportToken instead of authToken (matches auth.js)
      const token = localStorage.getItem('supportToken');
      console.log('BotManager init: token exists:', !!token);

      if (!token) {
        console.error('BotManager: No auth token found');
        return;
      }

      const response = await fetch('/api/bots', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('BotManager: /api/bots response:', response.status);

      if (response.ok) {
        const bots = await response.json();
        console.log('BotManager: Loaded bots:', bots);
        this.bots = {};
        bots.forEach(bot => {
          this.bots[bot.id] = bot;
        });
        this.initialized = true;

        // Validate current bot ID
        if (!this.bots[this.currentBotId]) {
          this.currentBotId = 'alex'; // Fallback to default
          this.saveBotId(this.currentBotId);
        }
      } else {
        console.error('BotManager: Failed to load bots, status:', response.status);
      }
    } catch (error) {
      console.error('BotManager: Failed to load bots:', error);
    }
  }

  /**
   * Get current bot ID
   */
  getCurrentBotId() {
    return this.currentBotId;
  }

  /**
   * Get current bot info
   */
  getCurrentBot() {
    return this.bots[this.currentBotId];
  }

  /**
   * Get all available bots
   */
  getAllBots() {
    return Object.values(this.bots);
  }

  /**
   * Switch to a different bot
   */
  switchBot(botId) {
    if (!this.bots[botId]) {
      console.error(`Unknown bot: ${botId}`);
      return false;
    }

    this.currentBotId = botId;
    this.saveBotId(botId);

    // Reload page to refresh data
    window.location.reload();
    return true;
  }

  /**
   * Load bot ID from localStorage
   */
  loadBotId() {
    return localStorage.getItem('currentBotId');
  }

  /**
   * Save bot ID to localStorage
   */
  saveBotId(botId) {
    localStorage.setItem('currentBotId', botId);
  }

  /**
   * Get bot color for UI
   */
  getBotColor(botId) {
    return this.bots[botId]?.color || '#007AFF';
  }

  /**
   * Get bot name for UI
   */
  getBotName(botId) {
    return this.bots[botId]?.name || botId;
  }
}

// Global bot manager instance
const botManager = new BotManager();

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    botManager.init();
  });
} else {
  botManager.init();
}
