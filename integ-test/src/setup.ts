import { afterAll, beforeAll, beforeEach } from 'bun:test';
import { cleanupTestData, getTestDatabase } from '../test-utils';
import { env } from '../test-utils/env';

// Global test state
export let testDb: Awaited<ReturnType<typeof getTestDatabase>>;

// Setup before all tests
beforeAll(async () => {
  console.log('🚀 Starting integration test setup...');

  // Only setup database if we have the required environment variables
  if (env.CLERK_SECRET_KEY && env.POSTGRES_URL) {
    try {
      testDb = await getTestDatabase();
      console.log('✅ Test database initialized');

      // Set global test environment variables
      process.env.POSTGRES_URL = testDb.connectionString;
      process.env.DATABASE_URL = testDb.connectionString;
      process.env.SUPABASE_URL = testDb.supabaseUrl;
      process.env.SUPABASE_ANON_KEY = testDb.supabaseAnonKey;
      process.env.SUPABASE_SERVICE_ROLE_KEY = testDb.supabaseServiceRoleKey;
    } catch (error) {
      console.log('⚠️ Database setup skipped:', (error as Error).message);
    }
  } else {
    console.log('⚠️ Skipping database setup - missing environment variables');
  }

  console.log('✅ Integration test setup complete');
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Starting integration test cleanup...');

  // Cleanup database if it was initialized
  if (testDb) {
    try {
      await testDb.cleanup();
      console.log('✅ Test database cleaned up');
    } catch (error) {
      console.log('⚠️ Database cleanup failed:', (error as Error).message);
    }
  }

  console.log('✅ Integration test cleanup complete');
});

// Clean test data before each test
beforeEach(async () => {
  if (testDb) {
    try {
      await cleanupTestData(testDb.db);
    } catch (error) {
      console.log('⚠️ Test data cleanup failed:', (error as Error).message);
    }
  }
});
