# Development vs Production Environment Setup

This guide explains how to work with separate development and production environments.

## Overview

| Environment | Database | Data | Purpose |
|-------------|----------|------|---------|
| **Development** | Local PostgreSQL 17 | Fake test data | Feature development, testing |
| **Production** | PostgreSQL (Neon) | Real customer data | Live site |

## Current Setup

The project uses a **file-swap approach** for environment switching:

- **`.env`** - Currently active environment (copy from `.env.development` or `.env.production`)
- **`.env.development`** - Development config (local PostgreSQL)  
- **`.env.production`** - Production config (Neon PostgreSQL)

### Switch to Development
```bash
cp .env.development .env
```

### Switch to Production
```bash
cp .env.production .env
```

## Quick Start - Development

### Local PostgreSQL (Already Configured)

The project is already set up with local PostgreSQL 17:

- **Database:** `headoverfeels_dev`
- **User:** `postgres`
- **Password:** `devpassword123`
- **Port:** `5432`

1. **Ensure PostgreSQL is running:**
   ```bash
   pg_isready -h localhost -p 5432
   ```

2. **Switch to dev environment:**
   ```bash
   cp .env.development .env
   ```

3. **Reset/seed database (if needed):**
   ```bash
   npx prisma db push
   npx tsx scripts/seed-dev-data.ts
   ```

4. **Start dev server:**
   ```bash
   npm run dev
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run dev:fresh` | Reset dev DB and start fresh |
| `npm run db:push:dev` | Push schema to dev database |
| `npm run db:seed:dev` | Seed dev database with fake data |
| `npm run db:reset:dev` | Clear and reseed dev database |
| `npm run db:studio:dev` | Open Prisma Studio for dev DB |
| `npm run db:studio:prod` | Open Prisma Studio for prod DB |

## Test Credentials (Development Only)

All fake accounts use `@fake.headoverfeels.dev` domain to prevent accidental real operations.

```
Admin Account:
  Email: admin@fake.headoverfeels.dev
  Password: adminpassword123

Test Customer Account:
  Email: testuser1@fake.headoverfeels.dev
  Password: testpassword123
```

## How It Works

### Environment Files
Production (Vercel/Neon Main):
  DATABASE_URL="postgresql://[neon-production-connection-string]"
```

### Fake Data

The development seed script (`scripts/seed-dev-data.ts`) creates:
- 1 admin user (dev-admin-1)
- 10 test customers (fake-customer-*)
- 5 categories (cat-*)
- 11 products (fake-product-*)
- ~130 product variants (fake-variant-*)
- 25 sample orders (fake-order-*)

All IDs are prefixed with `fake-`, `dev-`, or `cat-` so they're easily identifiable and won't conflict with production data.

## Workflow

### Feature Development

1. **Start with fresh dev environment:**
   ```bash
   npm run dev:fresh
   ```

2. **Make your changes** - all data is fake, safe to experiment

3. **Test thoroughly** - no risk to production data

4. **Push to GitHub** - Vercel auto-deploys to production

### Adding More Test Data

Edit `scripts/seed-dev-data.ts` and add your test scenarios:

```typescript
// Add more products, orders, etc.
const generateFakeProducts = () => {
  const products = [
    // Add your test products here
    { name: 'Test Product', slug: 'dev-test-product', price: 99.99, categoryId: 'cat-hoodies' },
  ];
  ...
};
```

Then reseed:
```bash
npm run db:seed:dev
```

## Production Safety

Production is completely isolated:
- Vercel uses environment variables from Vercel dashboard
- Production uses main Neon database branch
- The seed script only deletes records with `fake-`, `dev-`, or `cat-` prefixes
- Real customer data is never touched

## Git Branching Strategy

For larger features, consider using feature branches:

```bash
# Create feature branch
git checkout -b feature/new-feature

# Develop and test with fake data
npm run dev:fresh

# When ready, merge to main
git checkout main
git merge feature/new-feature
git push  # Triggers Vercel production deploy
```

## Troubleshooting

### "Cannot find module 'dotenv-cli'"

Install it:
```bash
npm install -D dotenv-cli
```

### Database Connection Issues

Check your `.env.development` has the correct connection string:
```bash
# Test connection
dotenv -e .env.development -- npx prisma db pull
```

### Schema Out of Sync

After changing `prisma/schema.prisma`:
```bash
# For dev (just pushes schema, no migration)
npm run db:push:dev

# For production (creates migration)
npx prisma migrate dev --name your_change
```

### Need to Start Fresh

```bash
# Nuclear option - deletes everything and reseeds
npm run db:reset:dev
```

## Important Notes

⚠️ **Never commit `.env` files** - they contain secrets  
⚠️ **Dev emails use `@fake.headoverfeels.dev`** - prevents real emails  
⚠️ **Production is untouched by dev commands** - safe to experiment  
⚠️ **Fake data IDs are prefixed** - won't conflict with production
