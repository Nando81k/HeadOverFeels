# Head Over Feels - Care Points Loyalty System

## 🎯 Overview

The **Care Points** loyalty system is designed to increase repeat purchases, boost average order value, and create emotional connection to the Head Over Feels brand. It's not just about discounts — it's about belonging, mental wellness, and making a difference.

## 🧱 Core Structure

### Points Economy

#### Ways to Earn Care Points

| Action | Points | Trigger |
|--------|--------|---------|
| Purchase | 1 point per $1 | `PURCHASE` |
| Account Creation | +50 | `ACCOUNT_CREATION` |
| First Purchase Bonus | +100 | `FIRST_PURCHASE` |
| Product Review | +25 | `REVIEW` |
| Social Follow | +50 | `SOCIAL_FOLLOW` |
| Social Share | +50 | `SOCIAL_SHARE` |
| UGC Upload | +100-200 | `UGC_UPLOAD` |
| Birthday | +50 | `BIRTHDAY` |
| Referral (successful) | +250 | `REFERRAL_GIVE` |

#### Ways to Redeem Care Points

| Reward | Points Cost | Type |
|--------|-------------|------|
| $5 Off | 500 | Discount |
| Free Shipping | 900 | Perk |
| $20 Off | 1,500 | Discount |
| Early Drop Access | 2,500 | Exclusive |
| Unlock Exclusive Product | 3,000 | Exclusive |
| Mental Health Charity Donation | 500 | Purpose |
| Digital Wellness Pack | 750 | Digital |
| Mental Health Care Box | 5,000 | Physical |

## 🔺 Tier System

### Tier Progression

| Tier | Annual Spend | Point Multiplier | Benefits |
|------|--------------|------------------|----------|
| **Head** | $0 | 1.0x | • Birthday points<br>• Access to drops<br>• Community membership |
| **Heart** | $200 | 1.25x | • All Head benefits<br>• Early drop access<br>• Mental health care box once/year<br>• 25% bonus on all points |
| **Mind** | $500 | 1.5x | • All Heart benefits<br>• Free shipping always<br>• Exclusive items access<br>• Name on members wall<br>• 50% bonus on all points |
| **Overdrive** | Invite Only | 2.0x | • All Mind benefits<br>• Private drop access<br>• Custom embroidered item once/year<br>• Concierge service<br>• 100% bonus on all points |

### Tier Names Philosophy

- **Head**: You're thinking about it - considering the brand
- **Heart**: You feel it - emotional connection established
- **Mind**: You understand it - deeper relationship, clarity of purpose
- **Overdrive**: You embody it - top 1%, brand advocates

## 💻 Technical Implementation

### Database Schema

```prisma
// Core Models
- LoyaltyTier: Tier definitions with benefits
- PointsTransaction: All point earning/spending records
- Reward: Available rewards catalog
- RewardRedemption: Customer redemption history
- ReferralCode: Unique referral codes per customer

// Customer Extensions
- Customer.loyaltyTierId
- Customer.currentPoints (available balance)
- Customer.lifetimePoints (total earned ever)
- Customer.annualSpend (for tier calculation)
- Customer.referredBy
```

### Service Functions

Located in `/lib/loyalty/service.ts`:

**Points Earning:**
- `awardPoints()` - Base function with tier multiplier
- `awardPurchasePoints()` - 1 point per $1
- `awardAccountCreationPoints()` - +50 welcome bonus
- `awardFirstPurchasePoints()` - +100 first order bonus
- `awardReviewPoints()` - +25 per review
- `awardBirthdayPoints()` - +50 birthday gift
- `awardReferralPoints()` - +250 to referrer
- `awardSocialPoints()` - Variable for social actions

**Points Redemption:**
- `hasEnoughPoints()` - Check balance
- `deductPoints()` - Spend points on rewards

**Tier Management:**
- `updateCustomerTier()` - Auto-upgrade based on spend
- `getCustomerLoyaltyStats()` - Full loyalty dashboard data
- `getAvailableRewards()` - Filtered by tier & points

**Referrals:**
- `generateReferralCode()` - Create unique code
- `getReferralCode()` - Get or create code

**Maintenance:**
- `expireOldPoints()` - Expire time-limited bonuses
- `resetAnnualSpend()` - Reset yearly for tier recalc

### API Endpoints

```
GET /api/loyalty/customers/[customerId]/stats
GET /api/loyalty/customers/[customerId]/rewards
GET /api/loyalty/customers/[customerId]/referral
```

## 🎨 Brand-Specific Perks (Differentiators)

### Purpose-Driven Rewards

1. **Mental Health Charity Donations**
   - 500 points = $5 donated to NAMI
   - Customers contribute to mental health causes
   - Shows impact beyond commerce

2. **Digital Wellness Content**
   - Journal templates for self-reflection
   - Guided meditation audio files
   - Inspirational phone wallpapers
   - "Open Letter" drops about resilience

3. **Physical Care Items**
   - Annual mental health care box (Heart tier+)
   - Self-care products, exclusive merch, mindfulness tools
   - Custom embroidered items (Overdrive)
   - Name engraved on "members wall" (Mind tier+)

### Community & Belonging

- **Members-Only Content**: Behind-the-scenes stories, mental health resources
- **Early Access**: Limited drops 24 hours before public
- **Exclusive Products**: Items only available to Mind tier+
- **Personalization**: Custom embroidery, name recognition

## 🚀 Implementation Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Database schema
- [x] Core service functions
- [x] API endpoints
- [x] Seed default tiers & rewards

### Phase 2: Automation (NEXT)
- [ ] Auto-award points on purchase completion
- [ ] Auto-award points on review approval
- [ ] Birthday points cron job
- [ ] Tier upgrade automation
- [ ] Referral tracking

### Phase 3: Customer UI
- [ ] Loyalty dashboard page
- [ ] Points balance widget in nav
- [ ] Rewards catalog page
- [ ] Redemption flow
- [ ] Tier progress visualization
- [ ] Referral code sharing widget

### Phase 4: Admin Tools
- [ ] Loyalty analytics dashboard
- [ ] Manual point adjustments
- [ ] Tier management
- [ ] Reward creation/editing
- [ ] Customer tier overrides
- [ ] Redemption fulfillment tracking

### Phase 5: Notifications & Engagement
- [ ] Email: Welcome to tier
- [ ] Email: Tier upgrade
- [ ] Email: Points expiring soon
- [ ] Email: Birthday bonus
- [ ] Email: Referral success
- [ ] In-app notifications

### Phase 6: Advanced Features
- [ ] Points expiration logic
- [ ] Limited-time bonus campaigns
- [ ] Gamification badges
- [ ] Leaderboards (opt-in)
- [ ] Social proof (X customers at Mind tier)

## 📊 Success Metrics

Track these KPIs to measure loyalty system effectiveness:

1. **Repeat Purchase Rate**: % of customers making 2+ orders
2. **Average Order Value**: Compare loyalty members vs non-members
3. **Customer Lifetime Value**: Track by tier
4. **Points Redemption Rate**: Are customers engaging?
5. **Tier Distribution**: How many in each tier?
6. **Referral Conversion**: How many referred customers purchase?
7. **Reward Preference**: Which rewards are most popular?
8. **Emotional Engagement**: Survey tier satisfaction

## 🎯 Launch Strategy

### Pre-Launch (1 week before)
1. Seed database with tiers & rewards
2. Email existing customers: "Something special is coming"
3. Tease on social media
4. Prepare FAQ page

### Launch Day
1. **Email Blast**: "Introducing Care Points"
   - Automatic tier assignment based on past spend
   - Bonus points for existing customers (loyalty)
   - How to earn & redeem guide
2. **Website Banner**: "Earn Care Points with Every Purchase"
3. **Social Campaign**: Share tier benefits, charity component
4. **PR Angle**: "Streetwear brand gives back to mental health"

### Post-Launch (First month)
1. Monitor adoption rates
2. A/B test reward values
3. Gather feedback from top spenders
4. Adjust point costs if needed
5. Plan first exclusive member drop

## 💡 Best Practices

### Do's:
- ✅ Always offer non-discount perks (early access, exclusive items)
- ✅ Celebrate tier upgrades prominently
- ✅ Make points visible everywhere (header, product pages, cart)
- ✅ Send reminders about points balance
- ✅ Highlight purpose-driven rewards (charity)
- ✅ Use emotional language ("Care Points", not "Loyalty Points")

### Don'ts:
- ❌ Train customers to wait for discounts only
- ❌ Make tier requirements too difficult
- ❌ Ignore redemptions (fulfill promptly)
- ❌ Overcomplicate the rules
- ❌ Forget to promote the system
- ❌ Make it feel transactional vs emotional

## 🔗 Related Files

### Backend
- `/prisma/schema.prisma` - Database models
- `/lib/loyalty/service.ts` - Core business logic
- `/app/api/loyalty/*` - REST API endpoints
- `/scripts/seed-loyalty.ts` - Initial data

### Frontend (To Be Created)
- `/components/loyalty/DashboardPage.tsx`
- `/components/loyalty/TierProgress.tsx`
- `/components/loyalty/RewardsGrid.tsx`
- `/components/loyalty/PointsBalance.tsx`
- `/components/loyalty/ReferralWidget.tsx`

### Admin (To Be Created)
- `/app/admin/loyalty/*` - Management interface

## 📝 Notes

- Points are called "Care Points" throughout the UI for brand consistency
- Tier names (Head, Heart, Mind, Overdrive) reflect the emotional journey
- System prioritizes belonging and purpose over pure discounts
- Annual spend resets yearly for fair tier progression
- Overdrive tier is invite-only to maintain exclusivity
- Charity integration differentiates from generic loyalty programs

---

**Built with 💙 for the Head Over Feels community**
