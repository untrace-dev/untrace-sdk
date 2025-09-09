import * as schema from '@untrace/db/schema';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function cleanupTestData(
  db: PostgresJsDatabase<typeof schema>,
): Promise<void> {
  // Delete all data in reverse order of dependencies
  // Use try-catch to handle potential constraint issues
  try {
    await db.delete(schema.ApiKeyUsage);
    await db.delete(schema.ApiKeys);
    await db.delete(schema.OrgMembers);
    await db.delete(schema.Orgs);
    await db.delete(schema.Users);
    await db.delete(schema.Traces);
    await db.delete(schema.ShortUrls);
    await db.delete(schema.Deliveries);
    await db.delete(schema.Destinations);
  } catch (error) {
    console.warn('Cleanup warning:', error);
    // If there are constraint issues, try again in a different order
    try {
      // Use TRUNCATE CASCADE for more thorough cleanup
      await db.execute(
        sql`TRUNCATE TABLE "apiKeyUsage", "apiKeys", "orgMembers", "orgs", "user", "traces", "shortUrls", "deliveries", "orgDestinations" RESTART IDENTITY CASCADE`,
      );
    } catch (truncateError) {
      console.error('Failed to cleanup test data:', truncateError);
      throw truncateError;
    }
  }
}
