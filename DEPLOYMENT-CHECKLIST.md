# Vercel Deployment Checklist

Copy this checklist and check off items as you complete them!

## 🚀 Deployment Steps

### Phase 1: Initial Setup
- [ ] Vercel CLI installed (✅ Already done!)
- [ ] Run `vercel login` and authenticate
- [ ] Run `vercel` to create preview deployment
- [ ] Verify preview URL works

### Phase 2: Production Deployment  
- [ ] Run `vercel --prod` to deploy to production
- [ ] Note your production URL (e.g., head-over-feels.vercel.app)
- [ ] Verify site loads in browser

### Phase 3: Environment Variables
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

#### Required Variables (Add All):
- [ ] `CRON_SECRET` = `LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=`
- [ ] `DATABASE_URL` = Your database connection string
- [ ] `RESEND_API_KEY` = `re_Z3AxxPGA_B74UDM3LaZid71uCegLCUZ9M`
- [ ] `EMAIL_FROM` = `Head Over Feels <onboarding@resend.dev>`
- [ ] `STRIPE_SECRET_KEY` = Get from Stripe Dashboard
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = Get from Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` = **Production webhook secret** (see below)

#### Optional Variables (If Using):
- [ ] `CLOUDINARY_CLOUD_NAME` = Your Cloudinary cloud name
- [ ] `CLOUDINARY_API_KEY` = Your Cloudinary API key  
- [ ] `CLOUDINARY_API_SECRET` = Your Cloudinary API secret

**Important:** Check all three environments (Production, Preview, Development) for each!

### Phase 4: Stripe Production Webhook
- [ ] Go to https://dashboard.stripe.com/webhooks
- [ ] Click "Add endpoint"
- [ ] URL: `https://YOUR-SITE.vercel.app/api/stripe/webhook`
- [ ] Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.succeeded`
- [ ] Click "Add endpoint"
- [ ] Copy the "Signing secret" (starts with `whsec_`)
- [ ] Update `STRIPE_WEBHOOK_SECRET` in Vercel with this new secret

### Phase 5: Redeploy with Variables
- [ ] Run `vercel --prod` again to apply environment variables
- [ ] Wait for deployment to complete
- [ ] Verify site still loads

### Phase 6: Database Setup (If using PostgreSQL)
If you're upgrading from SQLite to PostgreSQL:
- [ ] Create production database (Vercel Postgres, Neon, or PlanetScale)
- [ ] Update `DATABASE_URL` in Vercel
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Run seed script: `npx tsx scripts/seed-loyalty.ts`
- [ ] Redeploy: `vercel --prod`

### Phase 7: Verification & Testing

#### Test Site Functionality:
- [ ] Homepage loads
- [ ] Product pages load
- [ ] Navigation works
- [ ] Images display

#### Test Loyalty System:
- [ ] Create test account: `curl https://YOUR-SITE.vercel.app/api/auth/signup`
- [ ] Check loyalty stats: `curl https://YOUR-SITE.vercel.app/api/loyalty/customers/CUSTOMER_ID/stats`
- [ ] Verify 50 welcome points awarded

#### Test Stripe Integration:
- [ ] Place test order using Stripe test card: `4242 4242 4242 4242`
- [ ] Verify order confirmation email received
- [ ] Verify purchase points awarded
- [ ] Check Stripe dashboard for payment

#### Test Cron Job:
- [ ] Check Vercel Dashboard → Functions for `/api/cron/birthday-points`
- [ ] Test manually: 
  ```bash
  curl -X POST https://YOUR-SITE.vercel.app/api/cron/birthday-points \
    -H "Authorization: Bearer LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A="
  ```
- [ ] Verify response shows birthday check completed

### Phase 8: Monitoring Setup
- [ ] Bookmark Vercel Dashboard logs: https://vercel.com/dashboard
- [ ] Set up Vercel log notifications (optional)
- [ ] Add calendar reminder to check cron logs tomorrow
- [ ] Bookmark Stripe Dashboard: https://dashboard.stripe.com

---

## 📝 Quick Commands

```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# View logs
vercel logs --prod

# Test birthday cron
curl -X POST https://YOUR-SITE.vercel.app/api/cron/birthday-points \
  -H "Authorization: Bearer LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A="

# Test loyalty stats
curl https://YOUR-SITE.vercel.app/api/loyalty/customers/CUSTOMER_ID/stats
```

---

## 🚨 Common Issues & Fixes

### "vercel: command not found"
✅ Already fixed! Vercel CLI is installed.

### Build fails with TypeScript errors
```bash
# Fix locally first
npm run build

# Then redeploy
vercel --prod
```

### Stripe webhook returns 401
- Make sure you're using the **production** webhook secret
- The local CLI secret (`whsec_a3e2...`) won't work in production

### Cron job not appearing in Vercel
- Verify `vercel.json` exists in project root
- Check Vercel tier (Hobby tier supports 1 cron job)
- Redeploy: `vercel --prod`

### Environment variables not loading
```bash
# Redeploy after adding variables
vercel --prod
```

---

## ✅ Success Criteria

Your deployment is successful when:

1. ✅ Site loads at production URL
2. ✅ All pages work (home, products, cart, checkout)
3. ✅ Test purchase completes successfully
4. ✅ Loyalty points awarded automatically
5. ✅ Emails send correctly
6. ✅ Cron job appears in Vercel Functions
7. ✅ Manual cron test returns success

---

## 📚 Documentation

- **Full Deployment Guide**: `/docs/VERCEL-DEPLOYMENT-GUIDE.md`
- **Birthday Cron Setup**: `/docs/BIRTHDAY-CRON-SETUP.md`
- **Loyalty System Overview**: `/docs/LOYALTY-SYSTEM-CARE-POINTS.md`

---

## 🎯 Next Steps After Deployment

Once deployed and verified:
1. Monitor Vercel logs for first 24 hours
2. Wait for first automated cron run (midnight UTC)
3. Verify birthday points awarded correctly
4. Move on to Phase 3: Build customer-facing loyalty dashboard

---

**Ready to deploy?** Start with: `vercel login`

Good luck! 🚀
