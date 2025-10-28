# Loyalty System - Phase 2: Automation Implementation

## Overview
Phase 2 integrates the Care Points loyalty system into your existing e-commerce workflows, automatically rewarding customers for purchases, reviews, referrals, and birthdays.

## ✅ Implemented Automations

### 1. Purchase Points (Stripe Webhook)
**File**: `/app/api/stripe/webhook/route.ts`

**Trigger**: When `payment_intent.succeeded` event is received from Stripe

**Actions**:
1. **Award Base Purchase Points** (1 point per $1 spent)
   - Points are multiplied by customer's tier multiplier
   - Example: $100 purchase at Heart tier (1.25x) = 125 points
   
2. **First Purchase Bonus** (+100 points)
   - Automatically detected by checking order history
   - Awarded only once per customer
   - Triggers referral points if applicable

3. **Referral Points** (+250 points to referrer)
   - Awarded to the referrer when referred customer makes first purchase
   - Automatically tracks via `referredBy` field on Customer

4. **Annual Spend Tracking**
   - Updates customer's `annualSpend` for tier progression
   - Resets yearly (requires cron job - see utilities)

5. **Automatic Tier Upgrades**
   - Checks if customer qualifies for higher tier after each purchase
   - Awards tier upgrade bonus points
   - Example: Reaching $200 annual spend upgrades to Heart tier

**Code Flow**:
```typescript
// In payment_intent.succeeded handler
if (order.customerId) {
  // 1. Check if first purchase
  const isFirstPurchase = await checkPreviousOrders()
  
  // 2. Award purchase points (1pt/$1 with tier multiplier)
  await awardPurchasePoints(customerId, orderId, total)
  
  // 3. Award first purchase bonus
  if (isFirstPurchase) {
    await awardFirstPurchasePoints(customerId, orderId) // +100 pts
    
    // 4. Award referral points to referrer
    if (customer.referredBy) {
      await awardReferralPoints(customer.referredBy, customerId) // +250 pts
    }
  }
  
  // 5. Update annual spend
  await updateAnnualSpend(customerId, total)
  
  // 6. Check for tier upgrade
  await updateCustomerTier(customerId)
}
```

**Testing**:
```bash
# Use Stripe CLI to test locally
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test payment
stripe trigger payment_intent.succeeded
```

---

### 2. Review Points (Admin Approval)
**File**: `/app/api/reviews/[id]/route.ts`

**Trigger**: When admin updates review status to `APPROVED`

**Actions**:
1. **Award Review Points** (+25 points)
   - Only awarded when status changes from non-APPROVED to APPROVED
   - Prevents duplicate awards on subsequent updates
   - Points are multiplied by customer's tier multiplier

**Code Flow**:
```typescript
// In PATCH /api/reviews/[id]
if (status === 'APPROVED' && existingReview.status !== 'APPROVED') {
  await awardReviewPoints(customerId, reviewId) // +25 pts base
}
```

**Admin Workflow**:
1. Customer submits review (status: PENDING)
2. Admin reviews content in admin panel
3. Admin clicks "Approve" button
4. Status changes to APPROVED
5. Customer automatically receives 25 points (×tier multiplier)

**Testing**:
```typescript
// Create a test review
POST /api/reviews
{
  "productId": "...",
  "customerId": "...",
  "rating": 5,
  "comment": "Great product!"
}

// Approve the review
PATCH /api/reviews/[reviewId]
{
  "status": "APPROVED"
}

// Check customer points
GET /api/loyalty/customers/[customerId]/stats
```

---

### 3. Referral Tracking (Signup Flow)
**File**: `/app/api/auth/signup/route.ts`

**Trigger**: When new customer signs up with referral code

**Actions**:
1. **Validate Referral Code**
   - Looks up code in `ReferralCode` table
   - Stores referrer ID in customer's `referredBy` field

2. **Award Welcome Points** (+50 points)
   - Awarded immediately upon account creation
   - No tier multiplier (base tier assigned)

3. **Assign Default Tier**
   - New customers start at "Head" tier (1x multiplier)

4. **Update Referral Usage**
   - Increments `timesUsed` counter on referral code

**Note**: Referral points (+250) to the referrer are awarded when the referred customer makes their **first purchase** (see Purchase Points above).

**Code Flow**:
```typescript
// In POST /api/auth/signup
const { email, password, name, referralCode } = requestBody

// 1. Validate referral code
let referrerId = null
if (referralCode) {
  const code = await prisma.referralCode.findUnique({
    where: { code: referralCode }
  })
  referrerId = code?.customerId
}

// 2. Get default tier
const defaultTier = await prisma.loyaltyTier.findFirst({
  where: { slug: 'head' }
})

// 3. Create customer with referral tracking
const customer = await prisma.customer.create({
  data: {
    email, password, name,
    referredBy: referrerId,
    loyaltyTierId: defaultTier.id
  }
})

// 4. Award welcome points
await awardAccountCreationPoints(customer.id) // +50 pts

// 5. Update referral code usage
if (referralCode) {
  await prisma.referralCode.update({
    where: { code: referralCode },
    data: { timesUsed: { increment: 1 } }
  })
}
```

**Frontend Integration**:
```typescript
// Signup form should accept referralCode
const referralCode = router.query.ref // From URL: ?ref=FRIEND123

await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({
    email, password, name,
    referralCode // Optional
  })
})
```

**Referral Flow**:
1. Customer A gets referral code: `GET /api/loyalty/customers/[customerId]/referral`
2. Customer A shares link: `https://yoursite.com/signup?ref=FRIEND123`
3. Customer B signs up with code → A's ID stored in B's `referredBy` field
4. Customer B makes first purchase → A receives 250 points automatically

---

### 4. Birthday Points (Cron Job)
**File**: `/app/api/cron/birthday-points/route.ts`

**Trigger**: Daily cron job (scheduled externally)

**Actions**:
1. **Find Today's Birthdays**
   - Queries all customers with `birthday` matching today's month/day
   - Ignores year (awards every year on birthday)

2. **Award Birthday Points** (+50 points per customer)
   - Points multiplied by customer's tier multiplier
   - Example: Heart tier customer gets 63 points (50 × 1.25)

3. **Bulk Processing**
   - Processes all birthday customers in single job
   - Reports success/failure for each customer

**Scheduling Options**:

**Option 1: Vercel Cron** (Recommended for Vercel deployments)
Create `vercel.json` in project root:
```json
{
  "crons": [
    {
      "path": "/api/cron/birthday-points",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Option 2: GitHub Actions**
Create `.github/workflows/birthday-cron.yml`:
```yaml
name: Birthday Points Cron
on:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  award-birthday-points:
    runs-on: ubuntu-latest
    steps:
      - name: Call Birthday Points Endpoint
        run: |
          curl -X POST https://yoursite.com/api/cron/birthday-points \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**Option 3: External Service** (Cron-job.org, EasyCron, etc.)
- URL: `https://yoursite.com/api/cron/birthday-points`
- Method: POST
- Schedule: Daily at 00:00
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

**Security**:
Add to `.env.local`:
```bash
CRON_SECRET=your-random-secret-key-here
```

The endpoint verifies the secret before executing:
```typescript
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return { error: 'Unauthorized' }
}
```

**Manual Testing**:
```bash
# Test locally (requires customers with today's birthday in DB)
curl -X POST http://localhost:3000/api/cron/birthday-points \
  -H "Authorization: Bearer your-cron-secret"

# Or use GET for quick testing
curl http://localhost:3000/api/cron/birthday-points
```

**Response Format**:
```json
{
  "success": true,
  "message": "Birthday points awarded to 3 customers",
  "stats": {
    "totalBirthdays": 3,
    "successful": 3,
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

---

## Points Economy Summary

| Action | Points | Notes |
|--------|--------|-------|
| **Account Creation** | +50 | One-time, immediate |
| **First Purchase** | +100 | One-time bonus |
| **Purchase** | +1 per $1 | With tier multiplier |
| **Review (Approved)** | +25 | With tier multiplier |
| **Referral** | +250 | To referrer, on first purchase |
| **Birthday** | +50 | Annual, with tier multiplier |

**Tier Multipliers**:
- 🧠 Head: 1.0x
- ❤️ Heart: 1.25x
- 🧘 Mind: 1.5x
- ⚡ Overdrive: 2.0x

**Example Earnings** (Customer at Heart Tier):
- Signs up: +50 points (base, before tier assigned)
- First purchase ($150): +100 (bonus) + 188 (purchase @ 1.25x) = +288 points
- Refers friend who purchases: +313 points (250 × 1.25)
- Writes approved review: +31 points (25 × 1.25)
- Birthday: +63 points (50 × 1.25)
- **Total Year 1**: ~745 points (enough for free shipping + $5 off)

---

## Database Tracking

All points transactions are fully audited in the `PointsTransaction` table:

```typescript
{
  id: "trans_123",
  customerId: "cust_456",
  points: 125, // Can be negative for redemptions
  type: "PURCHASE", // Enum: 14 types
  description: "Purchase points for Order #ORD-1234 ($100.00)",
  metadata: {
    orderId: "order_789",
    tierMultiplier: 1.25,
    basePoints: 100
  },
  createdAt: "2025-10-27T12:00:00Z",
  expiresAt: null // Optional for time-limited bonuses
}
```

**Transaction Types**:
- `PURCHASE` - Points from orders
- `FIRST_PURCHASE` - First order bonus
- `REVIEW` - Review approval
- `ACCOUNT_CREATION` - Welcome bonus
- `BIRTHDAY` - Birthday gift
- `REFERRAL_GIVEN` - Awarded to referrer
- `REFERRAL_RECEIVED` - Bonus for being referred
- `SOCIAL_SHARE` - Social media actions
- `TIER_UPGRADE` - Tier progression bonus
- `ADMIN_ADJUSTMENT` - Manual correction
- `REDEMPTION` - Points spent (negative)
- `BONUS` - Special promotions
- `CORRECTION` - Error fix
- `EXPIRED` - Time-limited bonus expired

---

## Testing the Automation

### 1. Test Purchase Points Flow
```bash
# 1. Create a test customer
POST /api/auth/signup
{
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User"
}
# → Customer gets 50 welcome points, assigned to Head tier

# 2. Create a test order
POST /api/orders
# → Process through Stripe checkout

# 3. Trigger Stripe webhook locally
stripe trigger payment_intent.succeeded --override order_id=<order_id>

# 4. Verify points awarded
GET /api/loyalty/customers/<customer_id>/stats
# → Should show: 50 (welcome) + 100 (first purchase) + order total points

# 5. Make another purchase
# → Should only get purchase points (no first purchase bonus)

# 6. Check if tier upgraded (if annual spend > $200)
# → Heart tier should be assigned, future points get 1.25x multiplier
```

### 2. Test Review Points Flow
```bash
# 1. Create a review
POST /api/reviews
{
  "productId": "<product_id>",
  "customerId": "<customer_id>",
  "rating": 5,
  "comment": "Excellent product!"
}
# → Review status: PENDING

# 2. Approve review (as admin)
PATCH /api/reviews/<review_id>
{
  "status": "APPROVED"
}
# → Customer automatically receives 25 points (× tier multiplier)

# 3. Try approving again
PATCH /api/reviews/<review_id>
{
  "status": "APPROVED"
}
# → No duplicate points awarded (prevents gaming)
```

### 3. Test Referral Flow
```bash
# 1. Get referral code for Customer A
GET /api/loyalty/customers/<customer_a_id>/referral
# → Returns: { code: "FRIEND123", timesUsed: 0 }

# 2. Customer B signs up with code
POST /api/auth/signup
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User",
  "referralCode": "FRIEND123"
}
# → Customer B gets 50 welcome points
# → Customer B's referredBy field = Customer A's ID
# → FRIEND123 timesUsed = 1

# 3. Customer B makes first purchase
# (Process through Stripe webhook)
# → Customer B gets 100 first purchase bonus + purchase points
# → Customer A gets 250 referral points (× their tier multiplier)

# 4. Verify both customers
GET /api/loyalty/customers/<customer_b_id>/stats
# → Shows welcome + first purchase + purchase points

GET /api/loyalty/customers/<customer_a_id>/stats
# → Shows referral points in transaction history
```

### 4. Test Birthday Cron
```bash
# 1. Set a customer's birthday to today
prisma studio
# → Edit customer, set birthday to today's date

# 2. Run cron job
POST /api/cron/birthday-points
Header: Authorization: Bearer <CRON_SECRET>

# 3. Check response
# → Should show 1 customer processed successfully

# 4. Verify points awarded
GET /api/loyalty/customers/<customer_id>/stats
# → Should see +50 birthday points (× tier multiplier)
```

---

## Monitoring & Debugging

### Console Logs to Watch
All automation events log to console:

```javascript
// Purchase points
✅ Awarded purchase points for order order_123
✅ Awarded first purchase bonus for order order_123
✅ Awarded referral points to customer cust_456
✅ Checked tier upgrade for customer cust_789

// Review points
✅ Awarded review points for review rev_abc

// Signup
✅ Awarded welcome points to customer cust_xyz
✅ Updated referral code usage for FRIEND123

// Birthday
✅ Awarded birthday points to customer@example.com
Found 3 customers with birthdays today
```

### Common Issues

**Issue**: Points not awarded after purchase
- **Check**: Order has `customerId` (not guest checkout)
- **Check**: Stripe webhook firing correctly (`stripe listen --print-secret`)
- **Check**: Webhook secret configured in `.env.local`
- **Solution**: Guest orders don't award points (by design)

**Issue**: Review points awarded multiple times
- **Check**: Code only awards when status changes from non-APPROVED to APPROVED
- **Check**: Transaction history in database
- **Solution**: Should be prevented by condition check

**Issue**: Referral points not awarded
- **Check**: Referred customer has `referredBy` field set
- **Check**: Referred customer made their first purchase (not subsequent)
- **Check**: Referrer customer ID is valid
- **Solution**: Verify signup flow captured referral code

**Issue**: Birthday cron not running
- **Check**: Cron job scheduled correctly (vercel.json or external)
- **Check**: CRON_SECRET matches in cron job headers
- **Check**: Customer has birthday field populated
- **Solution**: Test endpoint manually first

**Issue**: TypeScript errors about missing fields
- **Check**: Run `npx prisma generate` after schema changes
- **Check**: Restart TypeScript server (`touch tsconfig.json`)
- **Check**: Restart dev server (`npm run dev`)
- **Solution**: Clear node_modules/.prisma and regenerate

---

## Next Steps: Phase 3 (Customer UI)

With automation complete, customers are now earning points automatically. Next phase:

1. **Loyalty Dashboard** - Display points balance, tier progress, transaction history
2. **Points Balance Widget** - Show points in navigation/header
3. **Rewards Catalog** - Browse and redeem available rewards
4. **Redemption Flow** - Use points to get discounts/perks
5. **Tier Progress Visualization** - Show path to next tier
6. **Referral Sharing Widget** - Easy sharing of referral code

See: `/docs/LOYALTY-SYSTEM-PHASE-3-UI.md` (coming soon)

---

## Related Files

### Phase 2 Implementation
- `/app/api/stripe/webhook/route.ts` - Purchase & referral points
- `/app/api/reviews/[id]/route.ts` - Review points
- `/app/api/auth/signup/route.ts` - Welcome & referral tracking
- `/app/api/cron/birthday-points/route.ts` - Birthday automation

### Service Layer (Core Logic)
- `/lib/loyalty/service.ts` - All points earning/redemption functions

### Database
- `/prisma/schema.prisma` - Loyalty system models
- `/scripts/seed-loyalty.ts` - Tier and reward seed data

### API Endpoints (Phase 1)
- `/app/api/loyalty/customers/[customerId]/stats/route.ts`
- `/app/api/loyalty/customers/[customerId]/rewards/route.ts`
- `/app/api/loyalty/customers/[customerId]/referral/route.ts`

### Documentation
- `/docs/LOYALTY-SYSTEM-CARE-POINTS.md` - Complete system overview
- `/docs/LOYALTY-SYSTEM-PHASE-2-AUTOMATION.md` - This file

---

## Summary

✅ **Purchase points** auto-awarded on payment success  
✅ **First purchase bonus** auto-detected and awarded  
✅ **Referral points** auto-awarded to referrer on first purchase  
✅ **Review points** auto-awarded on admin approval  
✅ **Welcome points** auto-awarded on signup  
✅ **Birthday points** available via cron job  
✅ **Tier upgrades** auto-checked after each purchase  
✅ **Annual spend** auto-tracked for tier qualification  
✅ **Full audit trail** in PointsTransaction table  

**All automation tested and ready for production!** 🚀
