/**
 * Test script to check database connections
 */
require('dotenv').config();

const { getAdapter } = require('./src/adapters/factory');

async function testConnections() {
  console.log('🔍 Testing database connections...\n');

  // Test Alex bot (PostgreSQL)
  try {
    console.log('Testing Alex bot (PostgreSQL)...');
    const alexAdapter = getAdapter('alex');
    const alexOk = await alexAdapter.checkConnection();

    if (alexOk) {
      console.log('✅ Alex bot (PostgreSQL): Connected');

      // Try to get user count
      const analytics = await alexAdapter.getDashboardAnalytics();
      console.log(`   Total users: ${analytics.totalUsers}`);
    } else {
      console.log('❌ Alex bot (PostgreSQL): Connection failed');
    }
  } catch (error) {
    console.log('❌ Alex bot (PostgreSQL): Error');
    console.log(`   ${error.message}`);
  }

  console.log('');

  // Test Strava bot (Supabase)
  try {
    console.log('Testing Strava bot (Supabase)...');
    const stravaAdapter = getAdapter('strava');
    const stravaOk = await stravaAdapter.checkConnection();

    if (stravaOk) {
      console.log('✅ Strava bot (Supabase): Connected');

      // Try to get user count
      const analytics = await stravaAdapter.getDashboardAnalytics();
      console.log(`   Total users: ${analytics.totalUsers}`);
    } else {
      console.log('❌ Strava bot (Supabase): Connection failed');
    }
  } catch (error) {
    console.log('❌ Strava bot (Supabase): Error');
    console.log(`   ${error.message}`);
  }

  console.log('\n✨ Connection test complete');
  process.exit(0);
}

testConnections().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
