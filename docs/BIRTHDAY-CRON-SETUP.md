# Birthday Points Cron Setup Guide

## ✅ Completed Setup

### 1. Environment Variable Added

**File**: `.env.local`

```bash
CRON_SECRET=LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=
```

✅ This secure random key is already added to your `.env.local` file.

### 2. Vercel Cron Configuration Created

**File**: `vercel.json`

```json
{
  "crons": [{
    "path": "/api/cron/birthday-points",
    "schedule": "0 0 * * *"
  }]
}
```

✅ This file has been created and will automatically work when you deploy to Vercel.

**Schedule**: Runs daily at midnight UTC (12:00 AM)

### 3. GitHub Actions Workflow Created (Alternative)

**File**: `.github/workflows/birthday-points-cron.yml`

✅ This file has been created as an alternative option.

---

## 🚀 Deployment Instructions

### Option A: Vercel Cron (Recommended - Easiest)

**When you deploy to Vercel, the cron job will automatically activate!**

1. **Deploy to Vercel:**
   ```bash
   vercel deploy --prod
   ```

2. **Add Environment Variable in Vercel Dashboard:**
   - Go to your project in Vercel
   - Navigate to **Settings** → **Environment Variables**
   - Add: `CRON_SECRET` = `LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=`
   - Apply to: **Production**, **Preview**, **Development**
   - Click **Save**

3. **Verify Cron Job:**
   - Go to **Deployments** → Click latest deployment
   - Check **Functions** tab → Look for `/api/cron/birthday-points`
   - Cron jobs will appear in **Logs** tab when they run

4. **Test Manually** (optional):
   ```bash
   curl -X POST https://your-site.vercel.app/api/cron/birthday-points \
     -H "Authorization: Bearer LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A="
   ```

**That's it!** Vercel handles scheduling automatically. 🎉

---

### Option B: GitHub Actions

If you prefer GitHub Actions or want redundancy:

1. **Add Repository Secrets:**
   - Go to your GitHub repo
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Add:
     - Name: `CRON_SECRET`
     - Value: `LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=`
   - Add:
     - Name: `SITE_URL`
     - Value: `https://your-site.vercel.app` (your production URL)

2. **Enable Workflow:**
   - The workflow file is already in `.github/workflows/birthday-points-cron.yml`
   - Commit and push to GitHub
   - Workflow will automatically run daily at midnight UTC

3. **Test Manually:**
   - Go to **Actions** tab in GitHub
   - Select "Birthday Points Automation"
   - Click "Run workflow" → "Run workflow"

**Benefit**: Works independently of Vercel, provides backup scheduling.

---

### Option C: External Cron Service

If you want to use an external service:

**Services**: cron-job.org, EasyCron, AWS EventBridge, etc.

1. **Configure Service:**
   - URL: `https://your-site.vercel.app/api/cron/birthday-points`
   - Method: `POST`
   - Schedule: `0 0 * * *` (daily at midnight)
   - Headers:
     ```
     Authorization: Bearer LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=
     Content-Type: application/json
     ```

2. **Test:**
   - Most services provide a "Test Now" button
   - Check your logs for successful execution

**Benefit**: Works with any hosting platform, not just Vercel.

---

## 🧪 Testing Locally

### Test the Birthday Endpoint

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Set a customer's birthday to today:**
   ```bash
   npx prisma studio
   # Navigate to Customer table
   # Edit a customer's birthday to today's date
   ```

3. **Call the cron endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/cron/birthday-points \
     -H "Authorization: Bearer LCBXgHfzlvyEndQTUfbOsaPdN7IsEPQX/7roA1Oo92A=" \
     -H "Content-Type: application/json"
   ```

4. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Birthday points awarded to 1 customers",
     "stats": {
       "totalBirthdays": 1,
       "successful": 1,
       "failed": 0
     },
     "results": [
       {
         "customerId": "cust_123",
         "email": "customer@example.com",
         "success": true
       }
     ]
   }
   ```

5. **Verify Points Awarded:**
   ```bash
   curl http://localhost:3000/api/loyalty/customers/CUSTOMER_ID/stats
   ```
   - Check `recentTransactions` for a `BIRTHDAY` type transaction

---

## 📊 Monitoring

### Check if Cron is Running

**Vercel:**
- Dashboard → Logs → Filter by `/api/cron/birthday-points`
- Will show execution logs daily at midnight

**GitHub Actions:**
- Actions tab → View workflow runs
- Shows success/failure status

### Monitor Points Awarded

```bash
# Check customer's transaction history
curl https://your-site.vercel.app/api/loyalty/customers/CUSTOMER_ID/stats

# Check recent transactions in database
npx prisma studio
# Navigate to PointsTransaction table
# Filter by type: "BIRTHDAY"
```

### Email Notifications (Optional Enhancement)

To get notified when birthdays are processed, modify `/app/api/cron/birthday-points/route.ts`:

```typescript
// Add at the end of successful execution
if (successCount > 0) {
  await sendEmail({
    to: 'admin@headoverfeels.com',
    subject: `Birthday Points: ${successCount} customers awarded`,
    html: `Processed ${birthdayCustomers.length} birthdays`
  })
}
```

---

## 🔒 Security Notes

1. **CRON_SECRET Protection:**
   - Never commit to Git (already in `.env.local`)
   - Add to Vercel environment variables
   - Use different secrets for production vs staging

2. **Endpoint Protection:**
   - The endpoint checks for Authorization header
   - Returns 401 if secret doesn't match
   - Safe to expose publicly (secret required)

3. **Rate Limiting (Optional):**
   - Vercel has built-in DDoS protection
   - Consider adding rate limiting for extra security

---

## ⏰ Cron Schedule Reference

Current schedule: `0 0 * * *` (Midnight UTC daily)

**Other common schedules:**
```
0 0 * * *   - Daily at midnight UTC
0 12 * * *  - Daily at noon UTC
0 */6 * * * - Every 6 hours
0 0 1 * *   - First day of month
0 0 * * 0   - Every Sunday
```

**Convert UTC to your timezone:**
- Midnight UTC = 4 PM PST / 7 PM EST (previous day)
- Adjust schedule if needed for your preferred time

---

## 🎯 What Happens Each Day

**At Midnight UTC:**

1. ✅ Cron triggers `/api/cron/birthday-points`
2. ✅ Endpoint queries all customers with birthdays today
3. ✅ For each birthday customer:
   - Awards 50 base points
   - Applies tier multiplier (1.0x to 2.0x)
   - Creates `BIRTHDAY` transaction record
   - Updates customer's `currentPoints` and `lifetimePoints`
4. ✅ Returns summary of customers processed
5. ✅ Logs results for monitoring

**Example Log:**
```
Found 3 customers with birthdays today
Awarded birthday points to customer@example.com (63 points at Heart tier)
Awarded birthday points to another@example.com (50 points at Head tier)
Awarded birthday points to vip@example.com (100 points at Overdrive tier)
```

---

## ✅ Setup Complete Checklist

- [x] `CRON_SECRET` added to `.env.local`
- [x] `vercel.json` created with cron configuration
- [x] `.github/workflows/birthday-points-cron.yml` created
- [ ] Deploy to Vercel (or push to trigger GitHub Actions)
- [ ] Add `CRON_SECRET` to Vercel environment variables
- [ ] Test manually to verify it works
- [ ] Monitor logs after first automated run

---

## 🆘 Troubleshooting

### Cron not running on Vercel
- Check if `vercel.json` is in project root
- Verify `CRON_SECRET` is set in Vercel environment variables
- Check Vercel dashboard → Functions → Look for cron job
- Pro tier required for cron (Hobby tier supports 1 cron)

### GitHub Actions not running
- Verify repository secrets are set correctly
- Check Actions tab for error messages
- Ensure workflow file is in `.github/workflows/`
- Default branch must have the workflow file

### Endpoint returns 401 Unauthorized
- Check Authorization header format: `Bearer SECRET`
- Verify secret matches in both endpoint and request
- Check for trailing spaces or special characters

### No customers receiving points
- Verify customers have birthdays set in database
- Check birthday format (should be valid Date)
- Run manual test with known birthday
- Check logs for error messages

---

## 📚 Related Documentation

- **Complete Loyalty Guide**: `/docs/LOYALTY-SYSTEM-CARE-POINTS.md`
- **Phase 2 Summary**: `/docs/LOYALTY-SYSTEM-PHASE-2-COMPLETE.md`
- **Flow Diagram**: `/docs/LOYALTY-SYSTEM-FLOW-DIAGRAM.md`
- **Vercel Cron Docs**: https://vercel.com/docs/cron-jobs
- **GitHub Actions Docs**: https://docs.github.com/en/actions

---

## 🎉 You're All Set!

Your birthday points automation is configured and ready to deploy. The cron job will automatically award points to customers on their birthdays once deployed to Vercel!

**Next Steps:**
1. Deploy to Vercel
2. Add CRON_SECRET to Vercel environment variables
3. Wait for first run at midnight (or test manually)
4. Monitor logs to confirm success

**Questions?** Check the troubleshooting section or test locally first! 🚀
