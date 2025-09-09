import { expect } from 'bun:test';
import type * as schema from '@untrace/db/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function checkDatabaseRecords(
  dbClient: PostgresJsDatabase<typeof schema>,
) {
  console.log('🔍 Checking database records...\n');

  try {
    // Check organizations
    const orgs = await dbClient.query.Orgs.findMany();
    console.log(`📊 Organizations: ${orgs.length}`);
    expect(orgs.length).toBeGreaterThan(0);
    orgs.forEach((org) => {
      console.log(`  - ${org.name} (${org.id})`);
      expect(org.id).toBeDefined();
      expect(org.name).toBeDefined();
    });

    // Check users
    const users = await dbClient.query.Users.findMany();
    console.log(`\n👥 Users: ${users.length}`);
    expect(users.length).toBeGreaterThan(0);
    users.forEach((user) => {
      console.log(`  - ${user.email} (${user.id})`);
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
    });

    // Check projects
    const projects = await dbClient.query.Projects.findMany();
    console.log(`\n📁 Projects: ${projects.length}`);
    expect(projects.length).toBeGreaterThan(0);
    projects.forEach((project) => {
      console.log(`  - ${project.name} (${project.id})`);
      expect(project.id).toBeDefined();
      expect(project.name).toBeDefined();
    });

    // Check destinations
    const destinations = await dbClient.query.Destinations.findMany();
    console.log(`\n🎯 Destinations: ${destinations.length}`);
    expect(destinations.length).toBeGreaterThan(0);
    destinations.forEach((dest) => {
      console.log(
        `  - ${dest.name} (${dest.destinationId}) - Enabled: ${dest.isEnabled}`,
      );
      console.log(`    Config: ${JSON.stringify(dest.config, null, 2)}`);
      expect(dest.id).toBeDefined();
      expect(dest.name).toBeDefined();
      expect(dest.destinationId).toBeDefined();
      expect(dest.config).toBeDefined();
    });

    // Check traces
    const traces = await dbClient.query.Traces.findMany();
    console.log(`\n🔍 Traces: ${traces.length}`);
    expect(traces.length).toBeGreaterThan(0);
    traces.forEach((trace) => {
      console.log(`  - Trace ID: ${trace.traceId} (${trace.id})`);
      console.log(`    Created: ${trace.createdAt}`);
      console.log(`    Data: ${JSON.stringify(trace.data, null, 2)}`);
      expect(trace.id).toBeDefined();
      expect(trace.traceId).toBeDefined();
      expect(trace.data).toBeDefined();
      expect(trace.createdAt).toBeDefined();
    });

    // Check deliveries
    const deliveries = await dbClient.query.Deliveries.findMany();
    console.log(`\n📦 Deliveries: ${deliveries.length}`);
    // Deliveries might be 0 if fan-out service didn't process destinations
    deliveries.forEach((delivery) => {
      console.log(`  - Delivery ID: ${delivery.id}`);
      console.log(`    Status: ${delivery.status}`);
      console.log(`    Attempts: ${delivery.attempts}`);
      console.log(`    Last Error: ${delivery.lastError || 'None'}`);
      expect(delivery.id).toBeDefined();
      expect(delivery.status).toBeDefined();
      expect(delivery.attempts).toBeGreaterThanOrEqual(0);
    });

    return {
      deliveries,
      destinations,
      orgs,
      projects,
      traces,
      users,
    };
  } catch (error) {
    console.error('❌ Error checking database records:', error);
    throw error;
  }
}
