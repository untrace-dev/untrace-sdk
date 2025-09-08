import { beforeEach, describe, expect, it } from 'bun:test';
import { TestFactories } from '../test-utils/factories';
import { testDb } from './setup';

describe('Destination Integration Tests', () => {
  let factories: TestFactories;

  beforeEach(async () => {
    if (!testDb) {
      throw new Error('Test database not initialized');
    }
    factories = new TestFactories(testDb.db);
  });

  it('should create a destination with project', async () => {
    // Create a complete setup with user, org, and project
    const setup = await factories.createCompleteSetup();

    // Create a destination
    const destination = await factories.createDestination({
      config: {
        publicKey: 'pk_test_123',
        secretKey: 'sk_test_123',
      },
      destinationId: 'langfuse', // This should be a valid destination provider ID
      name: 'Test Langfuse Destination',
      orgId: setup.org.id,
      projectId: setup.project.id,
    });

    expect(destination).toBeDefined();
    expect(destination.id).toMatch(/^od_/);
    expect(destination.name).toBe('Test Langfuse Destination');
    expect(destination.orgId).toBe(setup.org.id);
    expect(destination.projectId).toBe(setup.project.id);
    expect(destination.destinationId).toBe('langfuse');
    expect(destination.isEnabled).toBe(true);
    expect(destination.config).toEqual({
      publicKey: 'pk_test_123',
      secretKey: 'sk_test_123',
    });
  });

  it('should fail to create destination without projectId', async () => {
    const setup = await factories.createCompleteSetup();

    // This should fail because projectId is required
    await expect(
      factories.createDestination({
        config: {
          publicKey: 'pk_test_123',
        },
        destinationId: 'langfuse',
        name: 'Test Destination',
        orgId: setup.org.id,
        projectId: setup.project.id,
      }),
    ).rejects.toThrow();
  });

  it('should create multiple destinations for the same project', async () => {
    const setup = await factories.createCompleteSetup();

    const destination1 = await factories.createDestination({
      config: { publicKey: 'pk_test_1' },
      destinationId: 'langfuse',
      name: 'Langfuse Destination',
      orgId: setup.org.id,
      projectId: setup.project.id,
    });

    const destination2 = await factories.createDestination({
      config: { apiKey: 'ph_test_2' },
      destinationId: 'posthog',
      name: 'PostHog Destination',
      orgId: setup.org.id,
      projectId: setup.project.id,
    });

    expect(destination1.id).not.toBe(destination2.id);
    expect(destination1.projectId).toBe(setup.project.id);
    expect(destination2.projectId).toBe(setup.project.id);
  });

  it('should enforce unique destination names per project', async () => {
    const setup = await factories.createCompleteSetup();

    // Create first destination
    await factories.createDestination({
      config: { publicKey: 'pk_test_1' },
      destinationId: 'langfuse',
      name: 'My Destination',
      orgId: setup.org.id,
      projectId: setup.project.id,
    });

    // This should fail because the name is not unique within the project
    await expect(
      factories.createDestination({
        config: { apiKey: 'ph_test_2' },
        destinationId: 'posthog',
        name: 'My Destination', // Same name
        orgId: setup.org.id,
        projectId: setup.project.id,
      }),
    ).rejects.toThrow();
  });
});
