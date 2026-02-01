# Multi-Bot Support Setup

## Реализовано

### Backend Architecture

1. **Bot Configuration** - `src/config/bots.js`
   - Alex Bot (PostgreSQL/Yandex Cloud)
   - Strava Bot (Supabase)
   - Легко добавить новые боты

2. **Database Manager** - `src/db/manager.js`
   - Универсальный менеджер подключений
   - Поддержка PostgreSQL и Supabase
   - Автоматическое кеширование

3. **Adapter Pattern** - `src/adapters/`
   - `base.adapter.js` - базовый интерфейс
   - `alex.adapter.js` - обертка над postgres.js
   - `strava.adapter.js` - реализация для Supabase
   - `factory.js` - фабрика адаптеров

4. **Server Updates** - `src/server.js`
   - `detectBot` middleware
   - `/api/bots` endpoint - список ботов
   - Все endpoints используют адаптеры

### Frontend

1. **Bot Manager** - `public/bot-manager.js`
   - Управление текущим ботом
   - Сохранение выбора в localStorage
   - API загрузки списка ботов

2. **Bot Dropdown** - `public/bot-dropdown.js`
   - UI компонент переключения
   - Визуальные индикаторы (цвета)
   - Автоматическая синхронизация

3. **Auth Integration** - `public/auth.js`
   - Автоматическое добавление `botId` в запросы
   - Через query parameter и header

4. **HTML Pages**
   - Dashboard, Users, Payments
   - Dropdown в header
   - Responsive UI

## Конфигурация

### Environment Variables

```env
# Alex Bot (PostgreSQL)
PGUSER=user1
PGPASSWORD=...
PGHOST=rc1d-kqjl9ccgbmlm8qq6.mdb.yandexcloud.net
PGPORT=6432
PGDATABASE=db1

# Strava Bot (Supabase)
SUPABASE_URL=https://nwnrvnetbpcwoyqmhbpx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Bot Configuration Structure

```javascript
{
  id: 'strava',
  name: 'Strava Coach',
  color: '#FC4C02',
  type: 'supabase',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
}
```

## Testing

### Check Connections

```bash
node test-connections.js
```

Результат:
```
✅ Alex bot (PostgreSQL): Connected
   Total users: 1234

✅ Strava bot (Supabase): Connected
   Total users: 3731
```

### Start Server

```bash
npm start
```

## Usage

1. Откройте админку: https://psy-alex.ru/support/
2. В header появится dropdown "Алекс (психолог)"
3. Нажмите на dropdown - увидите список ботов
4. Выберите нужного бота
5. Страница перезагрузится с данными выбранного бота
6. Выбор сохраняется в localStorage

## Adding New Bot

### 1. Add Configuration

`src/config/bots.js`:
```javascript
bot3: {
  id: 'bot3',
  name: 'Third Bot',
  color: '#34C759',
  type: 'postgres',  // or 'supabase'
  database: { ... }
}
```

### 2. Add Environment Variables

`.env`:
```env
PGUSER_BOT3=...
PGPASSWORD_BOT3=...
...
```

### 3. Create Adapter (if needed)

`src/adapters/bot3.adapter.js`:
```javascript
class Bot3Adapter extends BaseAdapter {
  // Implement required methods
}
```

### 4. Update Factory

`src/adapters/factory.js`:
```javascript
else if (config.type === 'postgres' && botId === 'bot3') {
  adapters[botId] = new Bot3Adapter(connection);
}
```

## API Reference

### Endpoints

All endpoints support `?botId=xxx` parameter:

- `GET /api/bots` - List available bots
- `GET /api/users?botId=alex` - Users for Alex bot
- `GET /api/users?botId=strava` - Users for Strava bot
- `GET /api/analytics/dashboard?botId=xxx` - Analytics

### Bot Manager (Client)

```javascript
// Get current bot
const botId = botManager.getCurrentBotId(); // 'alex' or 'strava'

// Switch bot
botManager.switchBot('strava'); // Reloads page

// Get bot info
const bot = botManager.getCurrentBot();
// { id: 'strava', name: 'Strava Coach', color: '#FC4C02' }
```

## Architecture Benefits

✅ **Separation of Concerns** - Each bot has its own adapter
✅ **Extensibility** - Easy to add new bots
✅ **Backward Compatible** - Default to 'alex' if no botId
✅ **Type Safe** - TypeScript-ready interface
✅ **DRY** - Reuse UI code for all bots
✅ **Unified Auth** - Single JWT for all bots

## Database Mapping

| Feature | Alex (PostgreSQL) | Strava (Supabase) |
|---------|-------------------|-------------------|
| Users table | alex_users | users_pasha |
| Payments table | alex_payments | pro_payments |
| Chat logs | alex_chat_logs | chat_logs |
| Therapy profile | ✅ alex_user_therapy_profiles | ❌ Not available |
| User questions | ✅ alex_user_question | ❌ Not available |
| Mood logs | ✅ alex_daily_mood_logs | ❌ Not available |
| Strava integration | ❌ Not available | ✅ strava_id field |

## Troubleshooting

### Connection Issues

1. Check `.env` variables
2. Run `node test-connections.js`
3. Check firewall/network access

### Bot Not Switching

1. Clear localStorage: `localStorage.clear()`
2. Check browser console for errors
3. Verify `/api/bots` returns bot list

### Data Not Loading

1. Check botId in network requests
2. Verify adapter implements all methods
3. Check server logs for errors

## Security

- Service Role Key stored in .env (not committed)
- Single admin password for all bots
- JWT tokens include bot context
- RLS policies apply in Supabase

## Performance

- Connection pooling for PostgreSQL
- Supabase client reused per bot
- LocalStorage caching of bot selection
- Lazy loading of bot list

## Future Improvements

- [ ] Per-bot authentication
- [ ] Real-time bot health monitoring
- [ ] Multi-bot analytics comparison
- [ ] Bot-specific features toggle
- [ ] Migration tools between bots
