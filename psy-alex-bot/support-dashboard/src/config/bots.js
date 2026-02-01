const fs = require('fs');
const path = require('path');

module.exports = {
  alex: {
    id: 'alex',
    name: 'Аркаша',
    color: '#007AFF',  // Apple blue
    type: 'postgres',
    database: {
      user: process.env.PGUSER_ALEX || process.env.PGUSER,
      password: process.env.PGPASSWORD_ALEX || process.env.PGPASSWORD,
      host: process.env.PGHOST_ALEX || process.env.PGHOST,
      port: parseInt(process.env.PGPORT_ALEX || process.env.PGPORT || '6432'),
      database: process.env.PGDATABASE_ALEX || process.env.PGDATABASE,
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(
          path.join(process.env.HOME || '/root', '.postgresql', 'root.crt')
        ).toString()
      }
    }
  },
  strava: {
    id: 'strava',
    name: 'Михалыч',
    color: '#FC4C02',  // Strava orange
    type: 'supabase',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  }
};
