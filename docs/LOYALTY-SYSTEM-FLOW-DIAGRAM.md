# Loyalty System - Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CARE POINTS LOYALTY SYSTEM - PHASE 2                    │
│                           Automation Complete ✅                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER SIGNUP                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POST /api/auth/signup                                                      │
│  {                                                                          │
│    email, password, name,                                                   │
│    referralCode: "FRIEND123" (optional)                                     │
│  }                                                                          │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  1️⃣  Validate referral code → Find referrer                                │
│  2️⃣  Assign "Head" tier (1x multiplier)                                    │
│  3️⃣  Create customer with referredBy field                                 │
│  4️⃣  Award +50 welcome points                                              │
│  5️⃣  Increment referral code usage counter                                 │
│                                                                             │
│  ✅ Customer created with 50 points                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FIRST PURCHASE                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Customer places order ($150)                                               │
│  → Stripe processes payment                                                 │
│  → Webhook: payment_intent.succeeded                                        │
│                                                                             │
│  POST /api/stripe/webhook                                                   │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  1️⃣  Update order status to CONFIRMED                                      │
│  2️⃣  Send confirmation email                                               │
│  3️⃣  Release cart reservations                                             │
│  4️⃣  Reduce inventory                                                      │
│                                                                             │
│  🎯 LOYALTY AUTOMATION:                                                     │
│                                                                             │
│  5️⃣  Check if first purchase → YES                                         │
│                                                                             │
│      a) Award purchase points:                                              │
│         • Base: $150 × 1pt/$1 = 150 points                                  │
│         • Tier multiplier: 150 × 1.0 (Head) = 150 points                    │
│         → +150 points                                                       │
│                                                                             │
│      b) Award first purchase bonus:                                         │
│         → +100 points                                                       │
│                                                                             │
│      c) Check referredBy field → Found referrer!                            │
│         • Referrer at Heart tier (1.25x)                                    │
│         • Award: 250 × 1.25 = 313 points to referrer                        │
│         → Referrer gets +313 points                                         │
│                                                                             │
│  6️⃣  Update annual spend: $0 → $150                                        │
│  7️⃣  Check tier upgrade: $150 < $200 → No upgrade yet                      │
│                                                                             │
│  ✅ Customer now has: 50 (welcome) + 150 (purchase) + 100 (bonus) = 300    │
│  ✅ Referrer now has: +313 points                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  REVIEW SUBMISSION & APPROVAL                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POST /api/reviews                                                          │
│  {                                                                          │
│    productId, customerId, rating: 5,                                        │
│    comment: "Love this product!"                                            │
│  }                                                                          │
│  → Status: PENDING                                                          │
│                                                                             │
│  ↓ (Admin reviews in admin panel)                                          │
│                                                                             │
│  PATCH /api/reviews/[id]                                                    │
│  { status: "APPROVED" }                                                     │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  🎯 LOYALTY AUTOMATION:                                                     │
│                                                                             │
│  1️⃣  Check: status changed from PENDING → APPROVED? YES                    │
│  2️⃣  Award review points:                                                  │
│      • Base: 25 points                                                      │
│      • Customer at Head tier (1.0x)                                         │
│      • Award: 25 × 1.0 = 25 points                                          │
│      → +25 points                                                           │
│                                                                             │
│  ✅ Customer now has: 300 + 25 = 325 points                                 │
│                                                                             │
│  Note: Re-approving same review = no duplicate points                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SECOND PURCHASE (Tier Upgrade)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Customer places another order ($75)                                        │
│  → Stripe webhook fires again                                               │
│                                                                             │
│  🎯 LOYALTY AUTOMATION:                                                     │
│                                                                             │
│  1️⃣  Check if first purchase → NO (already has orders)                     │
│                                                                             │
│  2️⃣  Award purchase points only:                                           │
│      • Base: $75 × 1pt/$1 = 75 points                                       │
│      • Tier multiplier: 75 × 1.0 (Head) = 75 points                         │
│      → +75 points                                                           │
│                                                                             │
│  3️⃣  Update annual spend: $150 + $75 = $225                                │
│                                                                             │
│  4️⃣  Check tier upgrade:                                                   │
│      • Current: Head ($0 minimum)                                           │
│      • Next: Heart ($200 minimum)                                           │
│      • Annual spend: $225 ≥ $200? YES!                                      │
│      → UPGRADE TO HEART TIER! 🎉                                            │
│                                                                             │
│  5️⃣  Tier upgrade bonus:                                                   │
│      • Award: 100 × 1.25 (new tier) = 125 points                            │
│      → +125 points                                                          │
│                                                                             │
│  ✅ Customer now has: 325 + 75 + 125 = 525 points                           │
│  ✅ Customer upgraded to Heart tier (1.25x multiplier)                      │
│  ✅ All future points now get 1.25x boost!                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  BIRTHDAY POINTS (Automatic)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CRON JOB (runs daily at midnight)                                          │
│  POST /api/cron/birthday-points                                             │
│  Authorization: Bearer CRON_SECRET                                          │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  1️⃣  Query all customers with birthday = today                             │
│  2️⃣  For each birthday customer:                                           │
│                                                                             │
│      • Customer at Heart tier (1.25x)                                       │
│      • Base birthday points: 50                                             │
│      • With multiplier: 50 × 1.25 = 63 points                               │
│      → +63 points                                                           │
│                                                                             │
│  3️⃣  Log results and send report                                           │
│                                                                             │
│  ✅ Customer now has: 525 + 63 = 588 points                                 │
│                                                                             │
│  Schedule via:                                                              │
│  • Vercel Cron (vercel.json)                                                │
│  • GitHub Actions (.github/workflows/)                                      │
│  • External service (cron-job.org, etc.)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  POINTS SUMMARY                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Customer's Journey (Year 1):                                               │
│                                                                             │
│  ┌────────────────────────┬────────────┬──────────────┬──────────────┐     │
│  │ Action                 │ Base Pts   │ Tier         │ Final Pts    │     │
│  ├────────────────────────┼────────────┼──────────────┼──────────────┤     │
│  │ Signup                 │ +50        │ None (base)  │ +50          │     │
│  │ First Purchase ($150)  │ +150       │ 1.0x (Head)  │ +150         │     │
│  │ First Purchase Bonus   │ +100       │ None (bonus) │ +100         │     │
│  │ Approved Review        │ +25        │ 1.0x (Head)  │ +25          │     │
│  │ Second Purchase ($75)  │ +75        │ 1.0x (Head)  │ +75          │     │
│  │ Tier Upgrade Bonus     │ +100       │ 1.25x (Heart)│ +125         │     │
│  │ Birthday               │ +50        │ 1.25x (Heart)│ +63          │     │
│  ├────────────────────────┴────────────┴──────────────┼──────────────┤     │
│  │ TOTAL EARNED                                       │ 588 points   │     │
│  └────────────────────────────────────────────────────┴──────────────┘     │
│                                                                             │
│  Can Redeem:                                                                │
│  ✅ Free Shipping (900 pts) - Need 312 more                                 │
│  ✅ $5 Off (500 pts) - Can redeem now!                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  TIER PROGRESSION                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🧠 HEAD                  ❤️  HEART                                         │
│  ├─ $0/year              ├─ $200/year                                       │
│  ├─ 1.0x multiplier      ├─ 1.25x multiplier                                │
│  ├─ Base benefits        ├─ Free shipping                                   │
│  └─ Starting tier        ├─ Early drop access (24hr)                        │
│                          └─ Tier upgrade bonus                              │
│                                                                             │
│  🧘 MIND                  ⚡ OVERDRIVE                                       │
│  ├─ $500/year            ├─ Invite-only (top 1%)                            │
│  ├─ 1.5x multiplier      ├─ 2.0x multiplier                                 │
│  ├─ All Heart benefits   ├─ All Mind benefits                               │
│  ├─ Exclusive products   ├─ Personal concierge                              │
│  ├─ Priority support     ├─ Members wall feature                            │
│  └─ Birthday 2x bonus    └─ VIP events access                               │
│                                                                             │
│  Customer's Current Status:                                                 │
│  • Tier: ❤️ Heart (1.25x)                                                   │
│  • Annual Spend: $225                                                       │
│  • Points: 588                                                              │
│  • Next Tier: 🧘 Mind (needs $275 more)                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  DATABASE TRACKING (Full Audit Trail)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PointsTransaction Table:                                                   │
│                                                                             │
│  ┌───────┬────────────────┬────────┬─────────────────┬───────────────┐     │
│  │ ID    │ Type           │ Points │ Description     │ Metadata      │     │
│  ├───────┼────────────────┼────────┼─────────────────┼───────────────┤     │
│  │ tx_01 │ ACCOUNT_CREATE │ +50    │ Welcome bonus   │ {}            │     │
│  │ tx_02 │ PURCHASE       │ +150   │ Order #ORD-001  │ {orderId,...} │     │
│  │ tx_03 │ FIRST_PURCHASE │ +100   │ First order     │ {orderId,...} │     │
│  │ tx_04 │ REVIEW         │ +25    │ Review #REV-01  │ {reviewId,..} │     │
│  │ tx_05 │ PURCHASE       │ +75    │ Order #ORD-002  │ {orderId,...} │     │
│  │ tx_06 │ TIER_UPGRADE   │ +125   │ Upgraded→Heart  │ {tierId,...}  │     │
│  │ tx_07 │ BIRTHDAY       │ +63    │ Birthday gift   │ {}            │     │
│  └───────┴────────────────┴────────┴─────────────────┴───────────────┘     │
│                                                                             │
│  • Never deleted (permanent audit trail)                                    │
│  • Includes metadata (order ID, tier multiplier, etc.)                      │
│  • Supports negative values for redemptions                                 │
│  • Optional expiry dates for time-limited bonuses                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  API ENDPOINTS (Available Now)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GET /api/loyalty/customers/[customerId]/stats                              │
│  → Returns: points, tier, history, progress to next tier                    │
│                                                                             │
│  GET /api/loyalty/customers/[customerId]/rewards                            │
│  → Returns: available rewards (filtered by tier & points)                   │
│                                                                             │
│  GET /api/loyalty/customers/[customerId]/referral                           │
│  → Returns: unique referral code & usage stats                              │
│                                                                             │
│  POST /api/cron/birthday-points                                             │
│  → Triggers: birthday points for all customers with today's birthday        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  NEXT: PHASE 3 - CUSTOMER UI                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Coming Soon:                                                               │
│  1. Loyalty Dashboard Page (/loyalty)                                       │
│  2. Points Balance Widget (in navigation)                                   │
│  3. Rewards Catalog Page (/loyalty/rewards)                                 │
│  4. Redemption Flow (modals + checkout integration)                         │
│  5. Tier Progress Visualization                                             │
│  6. Referral Sharing Widget                                                 │
│                                                                             │
│  Ready to build? Say: "Let's move on to Phase 3"                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
