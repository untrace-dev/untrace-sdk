# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a T3 Turbo Monorepo - a full-stack TypeScript monorepo using Turborepo, designed for building scalable applications with multiple frontend and backend services sharing common packages.

## Essential Commands

### Development
```bash
# Install dependencies
bun install

# Start development for all packages
bun dev

# Start only the web app
bun dev:next

# Run tests
bun test

# Type check everything
bun typecheck

# Format code
bun format:fix

# Clean all workspaces
bun clean:ws
```

### Database Operations
```bash
# Open database studio
bun db:studio

# Push schema changes
bun db:push

# Generate migrations
bun db:gen-migration

# Run migrations
bun db:migrate

# Seed database
bun db:seed
```

### Building & Publishing
```bash
# Build all packages
bun build

# Publish CLI and client packages
bun publish

# Add UI components
bun ui-add
```

## Architecture Overview

### Monorepo Structure
- `/apps/*` - Applications (web-app, expo, cli, extensions)
- `/packages/*` - Shared packages (api, db, ui, ai)
- `/tooling/*` - Build and development tooling

### Key Technologies
- **Package Manager**: Bun with pnpm workspaces
- **Build System**: Turborepo
- **Web Framework**: Next.js 14 (App Router)
- **Database**: Drizzle ORM + Supabase
- **API Layer**: tRPC v11
- **UI Components**: shadcn/ui
- **Authentication**: Clerk
- **State Management**: Zustand
- **Mobile**: React Native with Expo SDK 51
- **Code Quality**: Biome (formatting/linting), TypeScript

### Important Patterns

1. **Type Safety**: End-to-end type safety with tRPC. API types are automatically inferred from server to client.

2. **Database Access**: All database operations go through the `@t3-template/db` package using Drizzle ORM.

3. **Environment Variables**: Use `bun with-env` to load environment variables from Infisical.

4. **UI Components**: Shared components in `@t3-template/ui` package. Use `bun ui-add` to add new shadcn components.

5. **API Routes**: Define tRPC routers in `packages/api/src/router`. Routes are automatically type-safe across all apps.

6. **Real-time Features**: Supabase real-time subscriptions are available for live data updates.

7. **AI Integration**: BAML templates in `packages/ai` for structured LLM interactions.

### Testing Approach
- Unit tests use Bun's built-in test runner
- Chrome extension uses Vitest
- VS Code extension uses Mocha
- Run all tests with `bun test`

### Code Style
- Biome enforces formatting and linting rules
- Kebab-case for filenames
- TypeScript strict mode enabled
- Import organization enforced
- Run `bun format:fix` before committing

### Development Tips
- Always run `bun typecheck` before committing
- Use Turbo for parallel task execution
- Database changes require running migrations
- Environment variables are managed with Infisical
- Git hooks via Lefthook ensure code quality