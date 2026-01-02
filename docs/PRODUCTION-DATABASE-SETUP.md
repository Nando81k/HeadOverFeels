# Production Database Setup Guide

## Problem
Your production deployment is failing with 500 errors because:
1. SQLite doesn't work on Vercel (ephemeral filesystem)
2. No database is configured in production
3. Loyalty tiers and other seed data don't exist

## Solution: Set Up Vercel Postgres

### Step 1: Create Vercel Postgres Database

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Click on your project: `head-over-feels`
3. Go to the **Storage** tab
4. Click **Create Database**
5. Select **Postgres**
6. Choose a name: `head-over-feels-db`
7. Select region: **Washington D.C. (same as your deployments)**
8. Click **Create**

Vercel will automatically:
- Create the database
- Add environment variables to your project:
  - `POSTGRES_URL`
  - `POSTGRES_PRISMA_URL` (use this one!)
  - `POSTGRES_URL_NON_POOLING`

### Step 2: Update Prisma Schema for PostgreSQL

The schema needs minor changes for PostgreSQL compatibility:

```prisma
// In prisma/schema.prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}

// Change any sqlite-specific types if needed
// Most of your schema should work as-is
```

### Step 3: Run Migrations in Production

After the database is created, you need to apply migrations:

```bash
# Set the production database URL locally (get from Vercel dashboard)
export DATABASE_URL="postgresql://..."

# Push the schema to production database
npx prisma db push

# Or run migrations
npx prisma migrate deploy
```

### Step 4: Seed Production Database

Run the seed scripts to populate loyalty tiers and rewards:

```bash
# Make sure you're using the production DATABASE_URL
npx tsx scripts/seed-loyalty.ts
```

### Step 5: Update Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

Make sure these are set:
- `DATABASE_URL` → Should be auto-set to `POSTGRES_PRISMA_URL`
- `CRON_SECRET` → `LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=`
- `RESEND_API_KEY` → `re_Z3AxxPGA_B74UDM3LaZid71uCegLCUZ9M`
- `EMAIL_FROM` → `Head Over Feels <onboarding@resend.dev>`
- `STRIPE_SECRET_KEY` → Your Stripe key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → Your Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` → Production webhook secret (create new one)

### Step 6: Redeploy

After everything is set up:

```bash
cd /Users/nando/Projects/personal/HeadOverFeels/head-over-feels
vercel --prod
```

## Alternative: Quick Fix (Development Mode)

If you want to test the deployment without setting up PostgreSQL right now:

### Make Auth Optional for Testing

Update the signup route to handle missing loyalty tiers gracefully:

```typescript
// In app/api/auth/signup/route.ts
const defaultTier = await prisma.loyaltyTier.findFirst({
  where: { slug: 'feels' },  // Changed from 'head' to 'feels'
})

// If no tier exists, create customer without loyalty
const customer = await prisma.customer.create({
  data: {
    email: validatedData.email,
    password: hashedPassword,
    name: validatedData.name,
    referredBy: referrerId,
    loyaltyTierId: defaultTier?.id || undefined,  // Make it optional
  },
  // ...
})
```

But **this is just a workaround** - you'll need a proper database for production!

## Recommended Approach

1. **Set up Vercel Postgres** (takes ~5 minutes)
2. **Run migrations** to create tables
3. **Run seed scripts** to populate data
4. **Redeploy** your app

This will give you:
- ✅ Persistent database that survives deployments
- ✅ All loyalty system data
- ✅ Proper authentication
- ✅ Ready for production traffic

## Checking Database Connection

After setup, you can verify the connection:

```bash
# In your project directory
npx prisma studio
```

This will open a GUI to view your database contents.
