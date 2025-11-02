# Promo & Discount System - TODO

## Current Status: ❌ NOT IMPLEMENTED

The promo/coupon system is **not yet built**. Only loyalty reward redemptions exist.

---

## What Exists (Loyalty Rewards Only)

### ✅ Loyalty Reward Coupons
- Customers can redeem Care Points for rewards
- Some rewards generate coupon codes (stored in `RewardRedemption.couponCode`)
- Examples:
  - "$5 Off Your Order" - 500 points
  - "$20 Off Your Order" - 1,500 points
  - "Free Shipping" - 900 points

**Limitation**: These are loyalty redemptions, not promotional codes

---

## What's Missing

### ❌ No Coupon/Promo Models
Current schema has no dedicated models for:
- Promotional codes (SUMMER25, WELCOME10, etc.)
- Automatic discounts
- Bulk coupon generation
- Expiration dates for promos
- Usage limits per code

### ❌ No Promo API Endpoints
No endpoints for:
- `/api/promo/validate` - Check if code is valid
- `/api/promo/apply` - Apply discount to cart
- `/api/promo/create` - Admin creates promo codes
- `/api/promo/list` - Admin views active promos

### ❌ No Admin Promo Management
- Can't create marketing promo codes
- Can't set discount rules (% off, $ off, free shipping)
- Can't set expiration dates or usage limits
- Can't track promo performance

### ❌ No Checkout Integration
- No coupon code input field in checkout
- No validation on checkout
- No discount application to order total
- No promo tracking on orders

---

## Implementation Plan (When Ready)

### Phase 1: Database Schema

**Add Coupon Model:**
```prisma
model Coupon {
  id          String   @id @default(cuid())
  code        String   @unique
  description String?
  
  // Discount rules
  discountType CouponDiscountType  // PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING
  discountValue Float               // 25 (for 25% off) or 10 (for $10 off)
  
  // Minimum requirements
  minOrderAmount Float?
  
  // Usage limits
  maxUses        Int?      // Total uses allowed
  usesCount      Int @default(0)
  maxUsesPerUser Int?      // Per customer limit
  
  // Validity
  startsAt  DateTime?
  expiresAt DateTime?
  isActive  Boolean @default(true)
  
  // Restrictions
  applicableProducts String?  // JSON array of product IDs
  applicableCollections String? // JSON array of collection IDs
  excludeLimitedEdition Boolean @default(false)
  
  // Metadata
  createdBy String?  // Admin user ID
  notes     String?  // Internal notes
  
  orders    Order[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("coupons")
}

enum CouponDiscountType {
  PERCENTAGE      // 25% off
  FIXED_AMOUNT    // $10 off
  FREE_SHIPPING   // Waive shipping
}
```

**Add to Order Model:**
```prisma
model Order {
  // ... existing fields
  
  couponId     String?
  coupon       Coupon?  @relation(fields: [couponId], references: [id])
  couponCode   String?
  discountAmount Float @default(0)
}
```

---

### Phase 2: API Endpoints

#### `/api/coupons/validate` (POST)
```typescript
// Input: { code: string, cartTotal: number }
// Output: { valid: boolean, discount: {...}, error?: string }

// Checks:
// - Code exists and active
// - Not expired
// - Not exceeded max uses
// - Meets minimum order amount
// - Customer hasn't exceeded per-user limit
```

#### `/api/coupons/apply` (POST)
```typescript
// Input: { code: string, orderId: string }
// Output: { success: boolean, newTotal: number }

// Actions:
// - Validate code
// - Calculate discount
// - Update order total
// - Increment coupon use count
// - Record coupon on order
```

#### `/api/admin/coupons` (GET, POST)
```typescript
// Admin panel CRUD for coupons
// - List all coupons
// - Create new promo codes
// - Update existing codes
// - Deactivate/delete codes
// - View usage stats
```

---

### Phase 3: Checkout Integration

**Checkout Form Updates:**
1. Add coupon code input field
2. "Apply" button to validate
3. Show discount breakdown
4. Update order total dynamically

**Validation Flow:**
```
1. User enters code → "SUMMER25"
2. Click "Apply"
3. Call /api/coupons/validate
4. If valid:
   - Show discount: "$25.00 off"
   - Update cart total
   - Store code in session
5. If invalid:
   - Show error message
   - Don't apply discount
```

**Order Creation:**
```typescript
// When creating order, include:
{
  couponId: validatedCoupon.id,
  couponCode: validatedCoupon.code,
  discountAmount: calculatedDiscount,
  subtotal: originalSubtotal,
  total: subtotal - discountAmount + shipping + tax
}
```

---

### Phase 4: Admin Panel

**Promo Management Dashboard:**
- Create new promo codes
- Set discount rules (% or $)
- Set expiration dates
- Set usage limits
- View performance metrics:
  - Total uses
  - Revenue attributed
  - Conversion rate

**Bulk Generation:**
- Generate 100 unique codes
- Example: WELCOME-XXXX (random suffix)
- Export CSV for distribution

---

### Phase 5: Marketing Features

**Automatic Discounts:**
```prisma
model AutoDiscount {
  id        String @id @default(cuid())
  name      String
  priority  Int
  
  // Trigger conditions
  triggerType AutoDiscountTrigger
  triggerValue String?  // JSON: min spend, collection ID, etc.
  
  // Discount rules
  discountType  CouponDiscountType
  discountValue Float
  
  isActive  Boolean
  startsAt  DateTime?
  expiresAt DateTime?
  
  @@map("auto_discounts")
}

enum AutoDiscountTrigger {
  MIN_SPEND          // Spend $100, get 10% off
  COLLECTION         // 20% off Outerwear collection
  FIRST_ORDER        // 15% off first purchase
  CART_ITEM_COUNT    // Buy 3, get 20% off
  LIMITED_DROP       // 10% off specific drop
}
```

**Cart-Level Rules:**
- "Buy 2, Get 1 Free" for specific products
- "Free shipping on orders $75+"
- "20% off your first order"

---

## Comparison: Loyalty Rewards vs Promo Codes

| Feature | Loyalty Rewards | Promo Codes |
|---------|----------------|-------------|
| **Generated By** | Customer redemption | Admin/Marketing |
| **Cost to Customer** | Care Points | Free (given code) |
| **Expiration** | Per redemption | Set by admin |
| **Usage Tracking** | In RewardRedemption | In Coupon model |
| **Multi-Use** | No (one-time) | Yes (if configured) |
| **Shareable** | No | Yes |
| **Purpose** | Loyalty program | Marketing campaigns |
| **Discount Types** | Fixed rewards | Flexible (%, $, shipping) |

---

## Why We Need Both

### Loyalty Rewards (Existing ✅)
- **Purpose**: Retain existing customers
- **Mechanics**: Earn points → Redeem for rewards
- **Personalized**: Tied to individual customer account
- **Long-term**: Builds ongoing relationship

### Promo Codes (Not Built ❌)
- **Purpose**: Acquire new customers + drive sales
- **Mechanics**: Enter code → Get discount
- **Public**: Can be shared/advertised
- **Short-term**: Time-limited campaigns

**Both systems serve different business goals.**

---

## Estimated Work Required

### Time: ~8-12 hours
1. Schema design + migration (1-2 hours)
2. API endpoints (3-4 hours)
3. Checkout integration (2-3 hours)
4. Admin panel UI (2-3 hours)
5. Testing (1-2 hours)

### Complexity: Medium
- Database changes required
- Checkout flow updates
- Multiple validation rules
- Admin UI work

---

## Decision: Implement Now or Later?

### Implement Now If:
- ✅ Planning marketing campaigns soon
- ✅ Need influencer/affiliate codes
- ✅ Want "first purchase" discounts
- ✅ Have budget for discount revenue loss

### Wait If:
- ❌ Focusing on organic growth first
- ❌ Loyalty rewards are sufficient
- ❌ Limited admin time for promo management
- ❌ Still testing pricing strategy

---

## Temporary Workaround (Until Built)

### Option 1: Manual Discounts
Admin can manually adjust order totals in admin panel

### Option 2: Loyalty-Only Promotions
"Sign up and get 50 bonus points!" (use loyalty system)

### Option 3: Bundle Pricing
Create products with built-in discounted prices

---

**Recommendation**: Implement promo system **after** CRM integration is validated with real orders. The loyalty rewards system can handle most use cases for now.

---

**Status**: ⏳ **PLANNED - NOT STARTED**

Promo/coupon system is designed but not yet implemented. Priority after CRM system is proven in production.
