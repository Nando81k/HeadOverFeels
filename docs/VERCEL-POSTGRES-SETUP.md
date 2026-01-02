# Vercel Postgres Setup Guide

## Step 1: Create Postgres Database in Vercel

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/nando81ks-projects/head-over-feels
   - Or from CLI: Run `vercel` and it will show you the project URL

2. **Navigate to Storage:**
   - Click on **Storage** tab in the left sidebar
   - Click **Create Database**
   - Select **Postgres**

3. **Configure Database:**
   - **Database Name:** `head-over-feels-db`
   - **Region:** Select **Washington, D.C., USA (iad1)** (same as your deployments)
   - Click **Create**

4. **Connect to Project:**
   - After creation, click **Connect Project**
   - Select your `head-over-feels` project
   - Environment: Select **Production, Preview, and Development**
   - Click **Connect**

## Step 2: Vercel Auto-Configures Environment Variables

Vercel will automatically add these to your project:
- `POSTGRES_URL` - Direct connection
- `POSTGRES_PRISMA_URL` - **Use this one for Prisma!**
- `POSTGRES_URL_NON_POOLING` - For migrations
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

## Step 3: Update Prisma Schema

We need to change from SQLite to PostgreSQL.

**File:** `prisma/schema.prisma`

Change the datasource block:

```prisma
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

Also update any SQLite-specific types:
- `@default(autoincrement())` → Works in both
- `DateTime @default(now())` → Works in both
- Remove any `@map("_prisma_migrations")` if present

## Step 4: Get Connection String

1. Go to Vercel Dashboard → Storage → Your Database
2. Click on `.env.local` tab
3. Copy the `POSTGRES_PRISMA_URL` value

It will look like:
```
postgres://username:password@host-pooler.postgres.vercel-storage.com:5432/database?pgbouncer=true&connect_timeout=15
```

## Step 5: Update Local Environment

Update your local `.env.local`:

```bash
# Replace the SQLite URL with PostgreSQL URL
DATABASE_URL="postgres://..."  # Paste the POSTGRES_PRISMA_URL here
```

## Step 6: Apply Migrations to Production Database

```bash
# Push schema to production database
npx prisma db push

# Or use migrations
npx prisma migrate deploy
```

## Step 7: Seed Production Database

```bash
# Seed loyalty tiers and rewards
npx tsx scripts/seed-loyalty.ts

# Optional: Seed products if you have a script
npx tsx scripts/seed-products.ts
```

## Step 8: Verify Connection

```bash
# Open Prisma Studio to view production data
npx prisma studio
```

You should see:
- ✅ 4 Loyalty Tiers (Head, Heart, Mind, Overdrive)
- ✅ 8 Rewards
- ✅ Empty customers/orders tables (ready for signups)

## Step 9: Redeploy to Vercel

```bash
cd /Users/nando/Projects/personal/HeadOverFeels/head-over-feels
vercel --prod
```

## Step 10: Test Authentication

1. Visit your production URL
2. Try to sign up with a new account
3. Should work without 500 errors!

## Troubleshooting

### Error: "Can't reach database server"
- Check that DATABASE_URL is set correctly
- Verify you're using `POSTGRES_PRISMA_URL` (not `POSTGRES_URL`)
- Check if your IP is allowed (Vercel Postgres allows all by default)

### Error: "Table doesn't exist"
- Run `npx prisma db push` again
- Or run `npx prisma migrate deploy`

### Error: "No loyalty tier found"
- Run the seed script: `npx tsx scripts/seed-loyalty.ts`

## Alternative: Quick CLI Setup

If Vercel CLI is installed, you can also create the database via CLI:

```bash
vercel postgres create head-over-feels-db
vercel postgres connect head-over-feels-db
```

## Cost

- **Free Tier:** 256 MB storage, 60 hours compute/month
- Perfect for development and small production apps
- Should be sufficient for Head Over Feels at current scale

## Next Steps After Database is Set Up

1. ✅ Authentication will work
2. ✅ Loyalty system will function
3. ✅ Orders can be created
4. ✅ Cron jobs will run

Then you need to configure:
- Stripe production webhook
- Email sending (Resend)
- Admin account creation
