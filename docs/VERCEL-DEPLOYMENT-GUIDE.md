# Vercel Deployment Guide - Step by Step

## ✅ Prerequisites Complete
- [x] Vercel CLI installed
- [x] `vercel.json` configured with cron job
- [x] `CRON_SECRET` ready: `LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=`

---

## 🚀 Step-by-Step Deployment

### Step 1: Login to Vercel

```bash
vercel login
```

**What happens:**
- Opens browser for authentication
- Choose: GitHub, GitLab, Bitbucket, or Email
- Follow prompts to authenticate

---

### Step 2: Link Project (First Time Only)

```bash
vercel
```

**You'll be asked:**

1. **"Set up and deploy?"** → Press `Y`
2. **"Which scope?"** → Choose your account/team
3. **"Link to existing project?"** → Press `N` (first time) or `Y` (if exists)
4. **"What's your project's name?"** → Press Enter (uses folder name) or type custom name
5. **"In which directory is your code located?"** → Press Enter (uses current directory)

**Output:**
```
🔗 Linked to your-username/head-over-feels
🔍 Inspect: https://vercel.com/...
✅ Preview: https://head-over-feels-xxx.vercel.app
```

This creates a **preview deployment** (not production yet).

---

### Step 3: Deploy to Production

```bash
vercel --prod
```

**Output:**
```
🔍 Inspect: https://vercel.com/...
✅ Production: https://head-over-feels.vercel.app
```

**Your site is now live!** 🎉

---

### Step 4: Add Environment Variables

#### Option A: Via Vercel Dashboard (Recommended)

1. **Go to**: https://vercel.com/dashboard
2. **Select your project**: "head-over-feels"
3. **Click**: "Settings" → "Environment Variables"
4. **Add each variable:**

   **DATABASE_URL:**
   - Name: `DATABASE_URL`
   - Value: `file:./dev.db` (or your production database URL)
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **CRON_SECRET:**
   - Name: `CRON_SECRET`
   - Value: `LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=`
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **RESEND_API_KEY:**
   - Name: `RESEND_API_KEY`
   - Value: `re_Z3AxxPGA_B74UDM3LaZid71uCegLCUZ9M`
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **EMAIL_FROM:**
   - Name: `EMAIL_FROM`
   - Value: `Head Over Feels <onboarding@resend.dev>`
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **STRIPE_WEBHOOK_SECRET:**
   - Name: `STRIPE_WEBHOOK_SECRET`
   - Value: Get from Stripe Dashboard (see below)
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:**
   - Name: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Value: Get from Stripe Dashboard (see below)
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **STRIPE_SECRET_KEY:**
   - Name: `STRIPE_SECRET_KEY`
   - Value: Get from Stripe Dashboard (see below)
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **CLOUDINARY_CLOUD_NAME:** (if using Cloudinary)
   - Name: `CLOUDINARY_CLOUD_NAME`
   - Value: Your Cloudinary cloud name
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **CLOUDINARY_API_KEY:** (if using Cloudinary)
   - Name: `CLOUDINARY_API_KEY`
   - Value: Your Cloudinary API key
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

   **CLOUDINARY_API_SECRET:** (if using Cloudinary)
   - Name: `CLOUDINARY_API_SECRET`
   - Value: Your Cloudinary API secret
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

#### Option B: Via CLI

```bash
vercel env add CRON_SECRET production
# Paste: LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=

vercel env add CRON_SECRET preview
# Paste: LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=

# Repeat for other environment variables
```

---

### Step 5: Get Stripe Production Webhook Secret

**Current webhook secret is for LOCAL testing only!**

1. **Go to**: https://dashboard.stripe.com/webhooks
2. **Click**: "Add endpoint"
3. **Endpoint URL**: `https://your-site.vercel.app/api/stripe/webhook`
4. **Events to send**: Select:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.succeeded`
5. **Click**: "Add endpoint"
6. **Reveal**: "Signing secret" (starts with `whsec_`)
7. **Copy**: The webhook secret
8. **Add to Vercel**: Update `STRIPE_WEBHOOK_SECRET` environment variable

**Important:** The local webhook secret from Stripe CLI won't work in production!

---

### Step 6: Redeploy with Environment Variables

After adding environment variables, redeploy:

```bash
vercel --prod
```

This ensures all environment variables are loaded.

---

### Step 7: Run Database Migrations (Production Database)

**If using a production database (not SQLite):**

```bash
# Connect to production
vercel env pull .env.production.local

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**If using SQLite (dev.db):**
- Your local database will be deployed with the code
- **Warning**: Not recommended for production (data loss on redeployments)
- Consider upgrading to PostgreSQL (Vercel Postgres, Neon, PlanetScale)

---

### Step 8: Verify Cron Job

1. **Go to**: https://vercel.com/dashboard
2. **Select your project**
3. **Click**: Latest deployment
4. **Check "Functions" tab**: Look for `/api/cron/birthday-points`
5. **Check "Logs" tab**: Cron executions will appear here daily

**Manual Test:**
```bash
curl -X POST https://your-site.vercel.app/api/cron/birthday-points \
  -H "Authorization: Bearer LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=" \
  -H "Content-Type: application/json"
```

---

### Step 9: Verify Loyalty System Works

**Test the loyalty endpoints:**

```bash
# Replace CUSTOMER_ID with actual customer ID from your database
curl https://your-site.vercel.app/api/loyalty/customers/CUSTOMER_ID/stats

curl https://your-site.vercel.app/api/loyalty/customers/CUSTOMER_ID/rewards

curl https://your-site.vercel.app/api/loyalty/customers/CUSTOMER_ID/referral
```

---

## 📊 Post-Deployment Checklist

- [ ] Site loads: https://your-site.vercel.app
- [ ] All environment variables added in Vercel dashboard
- [ ] Stripe production webhook configured
- [ ] Cron job appears in Vercel Functions
- [ ] Test purchase flow end-to-end
- [ ] Test loyalty points awarding
- [ ] Test birthday cron endpoint manually
- [ ] Monitor Vercel logs for first automated cron run (midnight UTC)

---

## 🔍 Monitoring Your Deployment

### View Logs
```bash
vercel logs --prod
```

Or visit: Vercel Dashboard → Project → Logs

### View Cron Executions
- Vercel Dashboard → Project → Logs
- Filter by: `/api/cron/birthday-points`
- Shows daily executions at midnight UTC

### Monitor Points Transactions
```bash
# Via Prisma Studio (local)
npx prisma studio

# Via API
curl https://your-site.vercel.app/api/loyalty/customers/CUSTOMER_ID/stats
```

---

## 🚨 Troubleshooting

### Build Failed
```bash
# Check build logs
vercel logs --prod

# Common fixes:
# 1. Run build locally first
npm run build

# 2. Fix any TypeScript errors
npm run build

# 3. Redeploy
vercel --prod
```

### Environment Variables Not Working
```bash
# Pull latest environment variables
vercel env pull

# Verify they're set
vercel env ls

# Redeploy to apply changes
vercel --prod
```

### Cron Not Running
- Check Vercel tier (Hobby tier supports 1 cron job)
- Verify `vercel.json` is in project root
- Check Functions tab in Vercel dashboard
- Look for cron job in deployment details

### Stripe Webhook Failing
- Verify you're using **production** webhook secret (not CLI secret)
- Check endpoint URL matches your domain
- Verify events are selected in Stripe dashboard
- Check Vercel logs for webhook errors

### Database Issues
- SQLite doesn't work well in production (ephemeral filesystem)
- Upgrade to PostgreSQL:
  - Vercel Postgres: https://vercel.com/docs/storage/vercel-postgres
  - Neon: https://neon.tech
  - PlanetScale: https://planetscale.com

---

## 🎯 Quick Command Reference

```bash
# Login
vercel login

# Deploy preview
vercel

# Deploy production
vercel --prod

# View logs
vercel logs --prod

# Pull environment variables
vercel env pull

# List environment variables
vercel env ls

# Add environment variable
vercel env add VARIABLE_NAME production

# Remove deployment
vercel remove [deployment-url]
```

---

## 📚 Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Vercel Docs**: https://vercel.com/docs
- **Cron Jobs**: https://vercel.com/docs/cron-jobs
- **Environment Variables**: https://vercel.com/docs/environment-variables
- **Stripe Webhooks**: https://dashboard.stripe.com/webhooks

---

## 🎉 Success!

Once deployed, your loyalty system will:
- ✅ Award points automatically on purchases
- ✅ Award points when reviews are approved
- ✅ Award welcome points on signup
- ✅ Award referral points
- ✅ Award birthday points daily at midnight UTC
- ✅ Auto-upgrade customer tiers based on spending

**Your Care Points loyalty system is now LIVE!** 🚀

Need help? Check the Vercel logs or test endpoints manually to verify everything works.
