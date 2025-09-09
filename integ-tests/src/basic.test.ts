import { beforeEach, describe, expect, it } from 'bun:test';
import { TestFactories } from '../test-utils/factories';
import { testDb } from './setup';

describe('Basic Integration Tests', () => {
  let factories: TestFactories;

  beforeEach(async () => {
    if (!testDb) {
      throw new Error('Test database not initialized');
    }
    factories = new TestFactories(testDb.db);
  });

  it('should create a user', async () => {
    const user = await factories.createUser();
    expect(user).toBeDefined();
    expect(user.id).toMatch(/^user_/);
    expect(user.email).toBeDefined();
  });

  it('should create an org', async () => {
    const org = await factories.createOrg();
    expect(org).toBeDefined();
    expect(org.id).toMatch(/^org_/);
    expect(org.name).toBeDefined();
  });

  it('should create a complete setup', async () => {
    const setup = await factories.createCompleteSetup();
    expect(setup.user).toBeDefined();
    expect(setup.org).toBeDefined();
    expect(setup.org.createdByUserId).toBe(setup.user.id);
  });

  it('should create an API key', async () => {
    const user = await factories.createUser();
    const org = await factories.createOrg();
    const project = await factories.createProject({
      orgId: org.id,
      userId: user.id,
    });
    const apiKey = await factories.createApiKey({
      orgId: org.id,
      projectId: project.id,
      userId: user.id,
    });

    expect(apiKey).toBeDefined();
    expect(apiKey.id).toMatch(/^ak_/);
    expect(apiKey.userId).toBe(user.id);
    expect(apiKey.orgId).toBe(org.id);
    expect(apiKey.projectId).toBe(project.id);
  });
});
