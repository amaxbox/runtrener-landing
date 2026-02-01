/**
 * Базовый класс для адаптеров БД
 * Определяет интерфейс, который должны реализовывать все адаптеры
 */
class BaseAdapter {
  constructor(connection) {
    this.connection = connection;
  }

  // === User Management ===

  async getUserInfo(telegramUserId) {
    throw new Error('getUserInfo() must be implemented by subclass');
  }

  async getUsersList(filters, sortBy, sortOrder, limit, offset) {
    throw new Error('getUsersList() must be implemented by subclass');
  }

  async getUsersCount(filters) {
    throw new Error('getUsersCount() must be implemented by subclass');
  }

  async updateUserStatus(telegramUserId, status) {
    throw new Error('updateUserStatus() must be implemented by subclass');
  }

  async updateUserSubscribe(telegramUserId, subscribe) {
    throw new Error('updateUserSubscribe() must be implemented by subclass');
  }

  // === Therapy Profile (optional) ===

  async getTherapyProfile(telegramUserId) {
    return null; // По умолчанию возвращает null для ботов без профиля терапии
  }

  // === Questions (optional) ===

  async getUserQuestions(telegramUserId) {
    return []; // По умолчанию возвращает пустой массив для ботов без вопросов
  }

  async getUserMoodLogs(telegramUserId, questionId, days = 7) {
    return []; // По умолчанию возвращает пустой массив для ботов без mood logs
  }

  // === Payments ===

  async getPayments(telegramUserId) {
    throw new Error('getPayments() must be implemented by subclass');
  }

  async getAllPayments(filters, limit, offset) {
    throw new Error('getAllPayments() must be implemented by subclass');
  }

  async getPaymentsCount(filters) {
    throw new Error('getPaymentsCount() must be implemented by subclass');
  }

  // === Chat Logs ===

  async getChatLogs(telegramUserId, limit = null) {
    throw new Error('getChatLogs() must be implemented by subclass');
  }

  // === Dashboard Analytics ===

  async getDashboardAnalytics() {
    throw new Error('getDashboardAnalytics() must be implemented by subclass');
  }

  async getPaymentDistributionByDays() {
    throw new Error('getPaymentDistributionByDays() must be implemented by subclass');
  }

  async getProMessagesDistribution() {
    // По умолчанию возвращает пустой массив
    return [];
  }

  async getRevenueForDate(date) {
    throw new Error('getRevenueForDate() must be implemented by subclass');
  }

  async getRevenueForWeek(startDate, endDate) {
    throw new Error('getRevenueForWeek() must be implemented by subclass');
  }

  async getRecentWeeks(count = 4) {
    throw new Error('getRecentWeeks() must be implemented by subclass');
  }

  // === Connection ===

  async checkConnection() {
    throw new Error('checkConnection() must be implemented by subclass');
  }
}

module.exports = BaseAdapter;
