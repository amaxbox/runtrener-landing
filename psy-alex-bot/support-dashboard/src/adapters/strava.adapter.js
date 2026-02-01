const BaseAdapter = require('./base.adapter');

/**
 * Адаптер для Strava бота (Supabase)
 */
class StravaAdapter extends BaseAdapter {
  constructor(supabaseClient, config) {
    super(supabaseClient);
    this.supabase = supabaseClient;
    this.config = config;
  }

  async getUserInfo(telegramUserId) {
    const { data, error } = await this.supabase
      .from('users_pasha')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .single();

    if (error) throw error;
    return data;
  }

  async getUsersList(filters, sortBy, sortOrder, limit, offset) {
    let query = this.supabase
      .from('users_pasha')
      .select('*', { count: 'exact' });

    // Поиск
    if (filters.search) {
      const search = filters.search;
      // Проверяем, это число или текст
      if (!isNaN(search)) {
        query = query.eq('telegram_user_id', parseInt(search));
      } else {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,username.ilike.%${search}%`);
      }
    }

    // Фильтр по подписке
    if (filters.subscribe && filters.subscribe !== 'all') {
      query = query.eq('subscribe', filters.subscribe);
    }

    // Фильтр по статусу
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    // Фильтр по дате регистрации
    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    // Сортировка и пагинация
    query = query
      .order(sortBy || 'created_at', { ascending: sortOrder === 'ASC' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { users: data || [], total: count || 0 };
  }

  async getUsersCount(filters) {
    let query = this.supabase
      .from('users_pasha')
      .select('id', { count: 'exact', head: true });

    if (filters.subscribe && filters.subscribe !== 'all') {
      query = query.eq('subscribe', filters.subscribe);
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    const { count, error } = await query;
    if (error) throw error;

    return count || 0;
  }

  async updateUserStatus(telegramUserId, status) {
    const { data, error } = await this.supabase
      .from('users_pasha')
      .update({ status })
      .eq('telegram_user_id', telegramUserId);

    if (error) throw error;
    return data;
  }

  async updateUserSubscribe(telegramUserId, subscribe) {
    const { data, error } = await this.supabase
      .from('users_pasha')
      .update({ subscribe })
      .eq('telegram_user_id', telegramUserId);

    if (error) throw error;
    return data;
  }

  async getPayments(telegramUserId) {
    const { data, error } = await this.supabase
      .from('pro_payments')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getAllPayments(filters, limit, offset) {
    let query = this.supabase
      .from('pro_payments')
      .select('*', { count: 'exact' });

    if (filters.userId) {
      query = query.eq('telegram_user_id', filters.userId);
    }

    if (filters.dateFrom) {
      query = query.gte('payment_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('payment_date', filters.dateTo);
    }

    query = query
      .order('payment_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }

  async getPaymentsCount(filters) {
    let query = this.supabase
      .from('pro_payments')
      .select('payment_id', { count: 'exact', head: true });

    if (filters.dateFrom) {
      query = query.gte('payment_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('payment_date', filters.dateTo);
    }

    const { count, error } = await query;
    if (error) throw error;

    return count || 0;
  }

  async getChatLogs(telegramUserId, limit = null) {
    let query = this.supabase
      .from('chat_logs')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }

  async getDashboardAnalytics() {
    try {
      // Получаем базовую статистику
      const { count: totalUsers, error: totalError } = await this.supabase
        .from('users_pasha')
        .select('id', { count: 'exact', head: true });

      if (totalError) {
        console.error('Error getting total users:', totalError);
        throw totalError;
      }

      const { count: activeUsers, error: activeError } = await this.supabase
        .from('users_pasha')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      if (activeError) {
        console.error('Error getting active users:', activeError);
      }

      const { count: proUsers, error: proError } = await this.supabase
        .from('users_pasha')
        .select('id', { count: 'exact', head: true })
        .eq('subscribe', 'pro');

      if (proError) {
        console.error('Error getting pro users:', proError);
      }

      // Подсчет выручки за 30 дней
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: recentPayments, error: paymentsError } = await this.supabase
        .from('pro_payments')
        .select('amount')
        .gte('payment_date', dateStr);

      if (paymentsError) {
        console.error('Error getting payments:', paymentsError);
      }

      let totalRevenue = 0;
      if (recentPayments && Array.isArray(recentPayments)) {
        totalRevenue = recentPayments.reduce((sum, p) => {
          const amount = parseFloat(p.amount?.replace(/[^\d.]/g, '') || '0');
          return sum + amount;
        }, 0);
      }

      // Generate minimal data for last 30 days to avoid chart errors
      const last30Days = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last30Days.push({
          date: date.toISOString().split('T')[0],
          total: 0,
          pro: 0
        });
      }

      // Generate minimal data for last 12 weeks
      const last12Weeks = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7));
        last12Weeks.push({
          week: `Week ${12 - i}`,
          total: 0,
          pro: 0
        });
      }

      // Generate minimal data for last 12 months
      const last12Months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        last12Months.push({
          month: date.toISOString().split('T')[0].substring(0, 7),
          total: 0,
          pro: 0
        });
      }

      // Return structure matching postgres.js format
      const result = {
        summary: {
          total_users: totalUsers || 0,
          active_users: activeUsers || 0,
          pro_users: proUsers || 0
        },
        dau: last30Days,
        wau: last12Weeks,
        mau: last12Months,
        growth: [],
        revenue: { total: totalRevenue },
        sources: [],
        rollingMetrics: [],
        npsAll: { avg_score: null, total_responses: 0 },
        npsPaying: { avg_score: null, total_responses: 0 },
        messages: [],
        messagesCount: { total: 0, pro: 0, free: 0 },
        dailyRevenue: [],
        activePaidUsers: []
      };

      console.log('StravaAdapter getDashboardAnalytics result:', {
        summary: result.summary,
        dauLength: result.dau.length,
        wauLength: result.wau.length
      });

      return result;
    } catch (error) {
      console.error('Error in getDashboardAnalytics:', error);
      throw error;
    }
  }

  async getPaymentDistributionByDays() {
    // Упрощенная реализация - получаем платежи за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data } = await this.supabase
      .from('pro_payments')
      .select('payment_date, amount')
      .gte('payment_date', dateStr)
      .order('payment_date', { ascending: true });

    return data || [];
  }

  async getRevenueForDate(date) {
    try {
      const { data, error } = await this.supabase
        .from('pro_payments')
        .select('amount')
        .eq('payment_date', date);

      if (error) {
        console.error('Error getting revenue for date:', error);
        throw error;
      }

      let totalRevenue = 0;
      let paymentCount = 0;

      if (data && Array.isArray(data)) {
        totalRevenue = data.reduce((sum, p) => {
          const amount = parseFloat(p.amount?.replace(/[^\d.]/g, '') || '0');
          return sum + amount;
        }, 0);
        paymentCount = data.length;
      }

      return {
        revenue: totalRevenue,
        payment_count: paymentCount,
        date
      };
    } catch (error) {
      console.error('Error in getRevenueForDate:', error);
      throw error;
    }
  }

  async getRevenueForWeek(weekStartDate) {
    try {
      // Calculate week end (6 days after start)
      const startDate = new Date(weekStartDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      const endDateStr = endDate.toISOString().split('T')[0];

      const { data, error } = await this.supabase
        .from('pro_payments')
        .select('amount')
        .gte('payment_date', weekStartDate)
        .lte('payment_date', endDateStr);

      if (error) {
        console.error('Error getting revenue for week:', error);
        throw error;
      }

      let totalRevenue = 0;
      let paymentCount = 0;

      if (data && Array.isArray(data)) {
        totalRevenue = data.reduce((sum, p) => {
          const amount = parseFloat(p.amount?.replace(/[^\d.]/g, '') || '0');
          return sum + amount;
        }, 0);
        paymentCount = data.length;
      }

      return {
        revenue: totalRevenue,
        payment_count: paymentCount,
        week_start: weekStartDate,
        week_end: endDateStr
      };
    } catch (error) {
      console.error('Error in getRevenueForWeek:', error);
      throw error;
    }
  }

  async getRecentWeeks(count = 4) {
    const weeks = [];
    const today = new Date();

    for (let i = 0; i < count; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - 6);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (i * 7));

      weeks.push({
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0]
      });
    }

    return weeks;
  }

  async checkConnection() {
    try {
      const { error } = await this.supabase
        .from('users_pasha')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Supabase connection check failed:', error);
      return false;
    }
  }
}

module.exports = StravaAdapter;
