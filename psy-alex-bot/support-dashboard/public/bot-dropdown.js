/**
 * Bot Dropdown UI Component
 * Manages the dropdown interface for bot switching
 */

class BotDropdown {
  constructor() {
    this.isOpen = false;
    this.dropdownId = 'botDropdown';
    this.buttonId = 'botSwitcher';
  }

  /**
   * Initialize dropdown - called after botManager is initialized
   */
  async init() {
    console.log('BotDropdown: Initializing...');
    await botManager.init();
    console.log('BotDropdown: BotManager initialized');
    this.render();
    console.log('BotDropdown: Rendered');
    this.attachEventListeners();
    console.log('BotDropdown: Event listeners attached');
  }

  /**
   * Render dropdown with current bots
   */
  render() {
    const button = document.getElementById(this.buttonId);
    const dropdown = document.getElementById(this.dropdownId);

    console.log('BotDropdown render:', { button: !!button, dropdown: !!dropdown });

    if (!button || !dropdown) {
      console.error('Bot dropdown elements not found', { button, dropdown });
      return;
    }

    // Update button text with current bot
    const currentBot = botManager.getCurrentBot();
    console.log('Current bot:', currentBot);

    if (currentBot) {
      const botName = document.getElementById('currentBotName');
      if (botName) {
        botName.textContent = currentBot.name;
      }

      // Update bot color indicator if exists
      const colorIndicator = document.getElementById('currentBotColor');
      if (colorIndicator) {
        colorIndicator.style.backgroundColor = currentBot.color;
      }
    }

    // Populate dropdown with all bots
    const bots = botManager.getAllBots();
    console.log('All bots:', bots);
    if (bots.length === 0) return;

    dropdown.innerHTML = bots.map(bot => {
      const isActive = bot.id === botManager.getCurrentBotId();
      return `
        <div
          data-bot-id="${bot.id}"
          class="flex items-center gap-3 px-4 py-2.5 hover:bg-apple-gray-50 dark:hover:bg-dark-bg-tertiary cursor-pointer transition ${isActive ? 'bg-apple-gray-100 dark:bg-dark-bg-tertiary' : ''}"
        >
          <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${bot.color}"></span>
          <span class="text-sm font-medium text-apple-gray-900 dark:text-dark-text">${bot.name}</span>
          ${isActive ? '<svg class="w-4 h-4 ml-auto text-apple-blue" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' : ''}
        </div>
      `;
    }).join('');

    // Attach click handlers to bot options
    dropdown.querySelectorAll('[data-bot-id]').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const botId = option.dataset.botId;
        if (botId && botId !== botManager.getCurrentBotId()) {
          botManager.switchBot(botId);
        } else {
          this.close();
        }
      });
    });
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const button = document.getElementById(this.buttonId);
    if (!button) return;

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById(this.dropdownId);
      const button = document.getElementById(this.buttonId);

      if (dropdown && button &&
          !dropdown.contains(e.target) &&
          !button.contains(e.target)) {
        this.close();
      }
    });
  }

  /**
   * Toggle dropdown
   */
  toggle() {
    console.log('BotDropdown toggle, isOpen:', this.isOpen);
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open dropdown
   */
  open() {
    console.log('BotDropdown open');
    const dropdown = document.getElementById(this.dropdownId);
    if (dropdown) {
      dropdown.classList.remove('hidden');
      this.isOpen = true;
      console.log('Dropdown opened, classes:', dropdown.className);
    } else {
      console.error('Dropdown element not found');
    }
  }

  /**
   * Close dropdown
   */
  close() {
    console.log('BotDropdown close');
    const dropdown = document.getElementById(this.dropdownId);
    if (dropdown) {
      dropdown.classList.add('hidden');
      this.isOpen = false;
    }
  }
}

// Global bot dropdown instance
const botDropdown = new BotDropdown();

// Initialize when DOM is ready and botManager is available
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for botManager to initialize
    setTimeout(() => botDropdown.init(), 100);
  });
} else {
  setTimeout(() => botDropdown.init(), 100);
}
