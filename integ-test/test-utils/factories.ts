import { faker } from '@faker-js/faker';
import * as schema from '@untrace/db/schema';
import { createId } from '@untrace/id';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class TestFactories {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async createUser(
    overrides?: Partial<schema.UserType>,
  ): Promise<schema.UserType> {
    const user = {
      avatarUrl: faker.image.avatar(),
      clerkId: `clerk_${faker.string.alphanumeric(20)}`,
      createdAt: new Date(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      id: createId({ prefix: 'user' }),
      lastName: faker.person.lastName(),
      online: false,
      ...overrides,
    };

    const [created] = await this.db
      .insert(schema.Users)
      .values(user)
      .returning();
    if (!created) {
      throw new Error('Failed to create user');
    }
    return created;
  }

  async createOrg(
    overrides?: Partial<schema.OrgType>,
  ): Promise<schema.OrgType> {
    const user = await this.createUser();

    const org = {
      clerkOrgId: `org_${faker.string.alphanumeric(20)}`,
      createdAt: new Date(),
      createdByUserId: user.id,
      id: createId({ prefix: 'org' }),
      name: faker.company.name(),
      stripeCustomerId: faker.string.alphanumeric(20),
      stripeSubscriptionId: faker.string.alphanumeric(20),
      stripeSubscriptionStatus: 'active' as const,
      ...overrides,
    };

    const [created] = await this.db.insert(schema.Orgs).values(org).returning();
    if (!created) {
      throw new Error('Failed to create org');
    }
    return created;
  }

  async createOrgMember(
    userId: string,
    orgId: string,
    role: 'user' | 'admin' | 'superAdmin' = 'user',
  ): Promise<schema.OrgMembersType> {
    const member = {
      createdAt: new Date(),
      id: createId({ prefix: 'member' }),
      orgId,
      role,
      userId,
    };

    const [created] = await this.db
      .insert(schema.OrgMembers)
      .values(member)
      .returning();
    if (!created) {
      throw new Error('Failed to create org member');
    }
    return created;
  }

  async createProject({
    userId,
    orgId,
    overrides,
  }: {
    userId: string;
    orgId: string;
    overrides?: Partial<schema.ProjectType>;
  }): Promise<schema.ProjectType> {
    const project = {
      createdAt: new Date(),
      createdByUserId: userId,
      id: createId({ prefix: 'proj' }),
      name: faker.lorem.words(2),
      orgId,
      ...overrides,
    };

    const [created] = await this.db
      .insert(schema.Projects)
      .values(project)
      .returning();
    if (!created) {
      throw new Error('Failed to create project');
    }
    return created;
  }

  async createApiKey({
    userId,
    orgId,
    projectId,
    overrides,
  }: {
    userId: string;
    orgId: string;
    projectId: string;
    overrides?: Partial<schema.ApiKeyType>;
  }): Promise<schema.ApiKeyType> {
    const apiKey = {
      createdAt: new Date(),
      id: createId({ prefix: 'ak' }),
      isActive: true,
      key: faker.string.alphanumeric(64),
      name: faker.lorem.words(2),
      orgId,
      projectId,
      userId,
      ...overrides,
    };

    const [created] = await this.db
      .insert(schema.ApiKeys)
      .values(apiKey)
      .returning();
    if (!created) {
      throw new Error('Failed to create API key');
    }
    return created;
  }

  async createDestination({
    orgId,
    projectId,
    name,
    destinationId,
    config,
    overrides,
  }: {
    orgId: string;
    projectId: string;
    name: string;
    destinationId: string;
    config: Record<string, unknown>;
    overrides?: Partial<schema.DestinationType>;
  }): Promise<schema.DestinationType> {
    const destination = {
      batchSize: 100,
      config,
      createdAt: new Date(),
      description: faker.lorem.sentence(),
      destinationId,
      id: createId({ prefix: 'od' }),
      isEnabled: true,
      maxRetries: 3,
      name,
      orgId,
      projectId,
      rateLimit: null,
      retryDelayMs: 1000,
      retryEnabled: true,
      transformFunction: null,
      updatedAt: new Date(),
      ...overrides,
    };

    const [created] = await this.db
      .insert(schema.Destinations)
      .values(destination)
      .returning();
    if (!created) {
      throw new Error('Failed to create destination');
    }
    return created;
  }

  async createTrace({
    orgId,
    projectId,
    traceId,
    spanId,
    data,
    overrides,
  }: {
    orgId: string;
    projectId: string;
    traceId: string;
    spanId?: string;
    data: Record<string, unknown>;
    overrides?: Partial<schema.TraceType>;
  }): Promise<schema.TraceType> {
    const trace = {
      createdAt: new Date(),
      data,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      id: createId({ prefix: 'trace' }),
      orgId,
      parentSpanId: null,
      projectId,
      spanId: spanId || null,
      traceId,
      // Only include fields that exist in the actual database schema
      ...overrides,
    };

    // Remove fields that don't exist in the database
    const { apiKeyId: _apiKeyId, userId: _userId, ...traceData } = trace;

    const [created] = await this.db
      .insert(schema.Traces)
      .values(traceData)
      .returning();
    if (!created) {
      throw new Error('Failed to create trace');
    }
    return created;
  }

  async createCompleteSetup(overrides?: {
    user?: Partial<schema.UserType>;
    org?: Partial<schema.OrgType>;
    project?: Partial<schema.ProjectType>;
  }) {
    // Create user
    const user = await this.createUser(overrides?.user);

    // Create org
    const org = await this.createOrg({
      createdByUserId: user.id,
      ...overrides?.org,
    });

    // Add user as org member
    await this.createOrgMember(user.id, org.id, 'admin');

    // Create project
    const project = await this.createProject({
      orgId: org.id,
      overrides: overrides?.project,
      userId: user.id,
    });

    return { org, project, user };
  }
}
