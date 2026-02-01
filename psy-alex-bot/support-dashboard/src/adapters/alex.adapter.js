const BaseAdapter = require('./base.adapter');
const postgres = require('../db/postgres');

/**
 * Адаптер для Алекс бота (PostgreSQL)
 * Использует существующие функции из postgres.js
 */
class AlexAdapter extends BaseAdapter {
  constructor(pool) {
    super(pool);
  }

  async getUserInfo(telegramUserId) {
    return await postgres.getUserInfo(telegramUserId);
  }

  async getUsersList(filters, sortBy, sortOrder, limit, offset) {
    // postgres.js expects (limit, offset, filters, sortBy, sortOrder)
    const result = await postgres.getUsersList(limit, offset, filters, sortBy, sortOrder);
    return { users: result, total: await postgres.getUsersCount(filters) };
  }

  async getUsersCount(filters) {
    return await postgres.getUsersCount(filters);
  }

  async updateUserStatus(telegramUserId, status) {
    return await postgres.updateUserStatus(telegramUserId, status);
  }

  async updateUserSubscribe(telegramUserId, subscribe) {
    return await postgres.updateUserSubscribe(telegramUserId, subscribe);
  }

  async getTherapyProfile(telegramUserId) {
    return await postgres.getTherapyProfile(telegramUserId);
  }

  async getUserQuestions(telegramUserId) {
    return await postgres.getUserQuestions(telegramUserId);
  }

  async getUserMoodLogs(telegramUserId, questionId, days = 7) {
    return await postgres.getUserMoodLogs(telegramUserId, questionId, days);
  }

  async getPayments(telegramUserId) {
    return await postgres.getPayments(telegramUserId);
  }

  async getAllPayments(filters, limit, offset) {
    // postgres.js expects (limit, offset, filters)
    return await postgres.getAllPayments(limit, offset, filters);
  }

  async getPaymentsCount(filters) {
    return await postgres.getPaymentsCount(filters);
  }

  async getChatLogs(telegramUserId, limit = null) {
    return await postgres.getChatLogs(telegramUserId, limit);
  }

  async getDashboardAnalytics() {
    return await postgres.getDashboardAnalytics();
  }

  async getPaymentDistributionByDays() {
    return await postgres.getPaymentDistributionByDays();
  }

  async getProMessagesDistribution() {
    return await postgres.getProMessagesDistribution();
  }

  async getRevenueForDate(date) {
    return await postgres.getRevenueForDate(date);
  }

  async getRevenueForWeek(startDate, endDate) {
    return await postgres.getRevenueForWeek(startDate, endDate);
  }

  async getRecentWeeks(count = 4) {
    return await postgres.getRecentWeeks(count);
  }

  async checkConnection() {
    return await postgres.checkConnection();
  }
}

module.exports = AlexAdapter;
