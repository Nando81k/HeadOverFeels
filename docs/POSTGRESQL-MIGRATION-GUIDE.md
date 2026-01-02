# PostgreSQL Migration Guide for Head Over Feels

## 🎯 Quick Overview

This guide walks you through migrating from SQLite (local dev) to PostgreSQL (production) on Vercel. This is **required** because Vercel's serverless environment has an ephemeral filesystem - SQLite files get deleted on every deployment.

**Time to Complete:** ~15 minutes  
**Current Status:** Schema updated, ready to create database

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- ✅ Vercel account with Head Over Feels project deployed
- ✅ Prisma schema updated to PostgreSQL (`schema.prisma` line 9: `provider = "postgresql"`)
- ✅ Git repository connected to Vercel
- ✅ Terminal access to your project

---

## 🚀 Step-by-Step Migration

### Step 1: Create Neon Database in Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your `head-over-feels` project

2. **Navigate to Storage**
   - Click **Storage** tab in the top navigation
   - Click **Create Database** button

3. **Configure Database**
   - **Provider**: Select **Neon** (Serverless Postgres)
   - **Database Name**: `head-over-feels-db` (or your preferred name)
   - **Region**: Select **Washington, D.C., USA (iad1)** ← matches your deployment region
   - **Auth Toggle**: Leave **OFF** ← you have custom auth already
   - Click **Create**

4. **Wait for Provisioning**
   - Takes ~30-60 seconds
   - Vercel will show "Creating database..." then "Database created"

### Step 2: Connect Database to Your Project

1. **Connect to Environments**
   - After creation, Vercel shows "Connect to Project" screen
   - Select your `head-over-feels` project
   - Check **all environments**: Production, Preview, Development
   - Click **Connect**

2. **Verify Environment Variables**
   - Go to **Settings** → **Environment Variables**
   - You should see these auto-added by Vercel:
     - `POSTGRES_URL`
     - `POSTGRES_PRISMA_URL` ← This is the one you need
     - `POSTGRES_URL_NON_POOLING`
     - Others...

### Step 3: Update Local Environment

1. **Copy Connection String**
   - In Vercel dashboard, go to **Storage** → Your database
   - Click **Copy** next to `POSTGRES_PRISMA_URL`
   - It looks like: `postgres://username:password@host/database?sslmode=require`

2. **Update `.env.local`**
   ```bash
   # In your project root: /head-over-feels/.env.local
   # Add or replace DATABASE_URL:
   DATABASE_URL="postgres://your-copied-connection-string-here"
   ```

3. **Keep Development Separate (Optional)**
   - If you want to keep using SQLite locally, create `.env.production.local`:
   ```bash
   # .env.local (local dev - SQLite)
   DATABASE_URL="file:./dev.db"
   
   # .env.production.local (production - PostgreSQL)
   DATABASE_URL="postgres://your-neon-connection-string"
   ```

### Step 4: Apply Database Migrations

1. **Open Terminal**
   ```bash
   cd /Users/nando/Projects/personal/HeadOverFeels/head-over-feels
   ```

2. **Push Schema to PostgreSQL**
   ```bash
   npx prisma db push
   ```
   
   **Expected Output:**
   ```
   Environment variables loaded from .env.local
   Prisma schema loaded from prisma/schema.prisma
   Datasource "db": PostgreSQL database
   
   🚀  Your database is now in sync with your Prisma schema.
   
   ✔ Generated Prisma Client
   ```

3. **Verify Tables Created**
   ```bash
   npx prisma studio
   ```
   - Opens database GUI at `http://localhost:5555`
   - You should see all tables: Customer, Product, Order, LoyaltyTier, etc.
   - **They will be empty** - that's normal, we populate next

### Step 5: Seed Production Database

1. **Run Loyalty Tiers Seed Script**
   ```bash
   npx tsx scripts/seed-loyalty.ts
   ```
   
   **Expected Output:**
   ```
   🎯 Seeding loyalty tiers and rewards...
   ✅ Created tier: Head (0+ points)
   ✅ Created tier: Heart (1,000+ points)
   ✅ Created tier: Mind (5,000+ points)
   ✅ Created tier: Overdrive (15,000+ points)
   ✅ Created 8 rewards
   🎉 Loyalty system seeded successfully!
   ```

2. **Verify Data in Prisma Studio**
   - Refresh Prisma Studio (if still open)
   - Check `LoyaltyTier` table: Should have 4 tiers
   - Check `Reward` table: Should have 8 rewards

### Step 6: Commit Schema Changes

```bash
# Check what changed
git status

# Should show:
# modified: prisma/schema.prisma
# modified: app/api/auth/signup/route.ts (error handling improvement)

# Stage and commit
git add prisma/schema.prisma app/api/auth/signup/route.ts
git commit -m "Migrate to PostgreSQL for production on Vercel"

# Push to GitHub
git push origin main
```

### Step 7: Deploy to Production

1. **Automatic Deployment**
   - Vercel auto-deploys when you push to `main`
   - Wait ~2-3 minutes for build to complete
   - Check deployment status in Vercel dashboard

2. **Manual Deployment (Alternative)**
   ```bash
   vercel --prod
   ```

### Step 8: Test Authentication

1. **Visit Production URL**
   - Go to your production URL (e.g., `head-over-feels.vercel.app`)

2. **Test Signup**
   - Click "Sign Up" or navigate to `/signup`
   - Fill in email and password
   - Submit form
   - **Expected**: Success! No 500 errors

3. **Test Sign In**
   - Sign out (if needed)
   - Sign in with credentials you just created
   - **Expected**: Successfully logged in

4. **Verify Database**
   - Go back to Prisma Studio (connected to production)
   - Check `Customer` table: Should have your new user
   - Check `loyaltyTierId`: Should be set to the "Head" tier ID

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] Database created in Vercel (Neon, iad1 region)
- [ ] Environment variables auto-configured in Vercel
- [ ] Local `.env.local` updated with `DATABASE_URL`
- [ ] `npx prisma db push` completed successfully
- [ ] Loyalty tiers seeded (4 tiers, 8 rewards)
- [ ] Schema changes committed and pushed to GitHub
- [ ] Production deployment succeeded
- [ ] Signup works without 500 errors
- [ ] Sign in works correctly
- [ ] User created in production database

---

## 🔧 Troubleshooting

### Error: "P1001: Can't reach database server"

**Cause:** Connection string incorrect or database not accessible

**Solution:**
1. Verify `DATABASE_URL` in `.env.local` is correct
2. Check Vercel dashboard → Storage → Your database → Connection string
3. Ensure you copied `POSTGRES_PRISMA_URL` (not `POSTGRES_URL`)
4. Check for typos or missing characters

---

### Error: "prisma db push" fails with authentication error

**Cause:** Database credentials expired or incorrect

**Solution:**
1. Go to Vercel dashboard → Storage → Your database
2. Click "Rotate credentials" if needed
3. Copy new `POSTGRES_PRISMA_URL`
4. Update `.env.local`
5. Run `npx prisma db push` again

---

### Error: Signup still returns 500 error

**Cause 1:** Loyalty tiers not seeded

**Solution:**
```bash
# Check if tiers exist
npx prisma studio
# Go to LoyaltyTier table
# If empty, run:
npx tsx scripts/seed-loyalty.ts
```

**Cause 2:** Environment variable not deployed

**Solution:**
1. Vercel dashboard → Settings → Environment Variables
2. Verify `POSTGRES_PRISMA_URL` exists for Production
3. If missing, add it manually (copy from Storage tab)
4. Redeploy: `vercel --prod`

---

### Error: "Module not found: Can't resolve '@prisma/client'"

**Cause:** Prisma client not regenerated after schema change

**Solution:**
```bash
npx prisma generate
npm run build
```

---

### Local development breaks (can't find SQLite file)

**Cause:** `.env.local` now points to PostgreSQL, not SQLite

**Solution Option 1 - Use PostgreSQL locally too:**
- Keep current `.env.local` with PostgreSQL connection
- Run migrations: `npx prisma db push`
- Seed local database: `npx tsx scripts/seed-loyalty.ts`

**Solution Option 2 - Keep SQLite for local dev:**
1. Rename `.env.local` to `.env.production.local`
2. Create new `.env.local`:
   ```bash
   DATABASE_URL="file:./dev.db"
   ```
3. Keep both files:
   - `.env.local` = SQLite for development
   - `.env.production.local` = PostgreSQL for production builds

---

## 📊 Cost Information

### Neon Free Tier (Current)
- **Storage:** 512 MB
- **Compute:** 191 hours/month
- **Branches:** 10 database branches
- **History:** 7-day point-in-time recovery
- **Cost:** $0/month

### Usage Estimate for Your App
- **Database Size:** ~50-100 MB (thousands of products/users)
- **Compute Usage:** ~5-10 hours/month (serverless, only active during requests)
- **Verdict:** Free tier sufficient for first 6-12 months

### When to Upgrade
- Users: 10,000+ active users
- Orders: 1,000+ per month
- Database: Approaching 500 MB
- Compute: Consistent high traffic
- **Cost:** ~$19/month (Launch plan)

---

## 🔄 Alternative: Supabase (If Neon Issues)

If Neon doesn't work or you prefer Supabase:

1. **Create Supabase Project**
   - Visit [supabase.com](https://supabase.com)
   - Create new project
   - Choose iad1 region
   - Wait for provisioning

2. **Get Connection String**
   - Go to Settings → Database
   - Copy "Connection string" (Transaction mode)
   - Format: `postgres://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

3. **Add to Vercel**
   - Vercel dashboard → Settings → Environment Variables
   - Add `DATABASE_URL` with Supabase connection string
   - Apply to all environments

4. **Continue from Step 3** (Update local environment)

---

## 📚 Key Differences: SQLite vs PostgreSQL

| Feature | SQLite (Local) | PostgreSQL (Production) |
|---------|---------------|------------------------|
| **Storage** | File in `/prisma/dev.db` | External Neon server |
| **Persistence** | Deleted on Vercel deploy | Permanent, survives deploys |
| **Connection** | Direct file access | Network connection (pooled) |
| **Concurrency** | Limited (file locks) | High (handles 100+ connections) |
| **Migrations** | `prisma db push` | `prisma migrate deploy` (recommended) |
| **Cost** | Free (local file) | Free tier → $19/month |
| **Performance** | Fast (local) | ~1-3ms (same region) |

---

## 🎯 Next Steps After Migration

### Immediate
1. ✅ Test all auth flows (signup, signin, signout)
2. ✅ Create a test order to verify cart and checkout work
3. ✅ Check loyalty points calculation

### Within 24 Hours
1. Configure Stripe production webhook
   - See `STRIPE_SETUP.md` for instructions
   - Update `STRIPE_WEBHOOK_SECRET` in Vercel
2. Test email sending (Resend)
   - Verify `RESEND_API_KEY` is set
   - Test drop notifications

### Within 1 Week
1. Monitor database usage in Neon dashboard
2. Set up database backups (Neon automatic)
3. Test cron job execution (`/api/cron/check-drops`)
4. Add monitoring/logging (optional: Sentry, LogRocket)

---

## 💡 Pro Tips

### Tip 1: Use Prisma Studio for Quick Debugging
```bash
npx prisma studio
```
Opens visual database browser - great for checking data without SQL queries.

### Tip 2: Keep SQLite for Fast Local Development
Many developers use SQLite locally (fast, no network) and PostgreSQL in production (persistent). Just use separate `.env` files.

### Tip 3: Database Migrations vs Push
- `prisma db push`: Quick, good for development, no migration history
- `prisma migrate deploy`: Production-ready, versioned migrations, recommended for teams

For now, `db push` is fine (solo developer). When you hire a team, switch to migrations.

### Tip 4: Connection Pooling
Neon provides pooled connections by default (`POSTGRES_PRISMA_URL` uses pooling). This prevents "too many connections" errors in serverless environments.

### Tip 5: Monitor Your Database
- Neon dashboard shows storage usage, compute hours
- Set up alerts before hitting free tier limits
- Vercel deployment logs show database connection issues

---

## 📞 Support

### Neon Issues
- [Neon Documentation](https://neon.tech/docs)
- [Neon Discord](https://discord.gg/neon)
- Support: support@neon.tech

### Prisma Issues
- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Discord](https://discord.gg/prisma)
- GitHub: [prisma/prisma](https://github.com/prisma/prisma)

### Vercel Issues
- [Vercel Documentation](https://vercel.com/docs)
- Support: vercel.com/support

---

## 🎉 Congratulations!

You've successfully migrated from SQLite to PostgreSQL! Your Head Over Feels app now has:

✅ Persistent database storage on Vercel  
✅ Production-ready authentication  
✅ Scalable infrastructure  
✅ Loyalty system ready to track points  
✅ Foundation for processing real orders  

**Next milestone:** Configure Stripe webhooks and process your first real payment! 🚀

---

**Last Updated:** October 27, 2025  
**Version:** 1.0  
**Author:** Head Over Feels Development Team
