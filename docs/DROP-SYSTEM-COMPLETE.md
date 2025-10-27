# Limited Edition Drops - Complete System Documentation

## Overview
This document describes the complete Limited Edition Drop system with email notifications, dramatic homepage countdown, and checkout time limits to ensure fair purchasing.

## Features Implemented

### 1. Email Notification System ✅
Users can subscribe to be notified when a limited drop goes live.

**Database Model: `DropNotification`**
```prisma
model DropNotification {
  id         String   @id @default(cuid())
  email      String
  productId  String
  product    Product  @relation(...)
  notified   Boolean  @default(false)
  notifiedAt DateTime?
  source     String?  // "homepage", "product_page"
  createdAt  DateTime @default(now())
  
  @@unique([email, productId])
}
```

**API Endpoint: `/api/drop-notifications`**
- `POST` - Subscribe to drop notifications
  - Validates email and product
  - Prevents duplicate subscriptions
  - Returns confirmation message
- `GET?productId=xxx` - Get subscriber count (admin)

### 2. Dramatic Homepage Drop Section ✅
Large, visually striking hero section with animations and countdown.

**Component: `<DropHeroSection />`**
Location: `/components/drops/DropHeroSection.tsx`

**Features:**
- **Animated gradient background** with pulsing effects
- **Real-time countdown timer** showing days, hours, minutes, seconds
- **Product preview** with large image display
- **Stock indicator** showing percentage remaining
- **Email signup form** with success/error states
- **Responsive design** for all screen sizes
- **Conditional CTAs:**
  - If drop hasn't started → Email signup
  - If drop is live → "SHOP NOW" button
  
**Visual Elements:**
- Animated "LIMITED EDITION" badge
- Stock percentage bar (green → yellow → red)
- 3-column stats (Units Left, Total Made, Time Left)
- Framer Motion animations for smooth transitions

### 3. Cart Reservation System ✅
Time-based inventory locks to prevent overselling and ensure fair access.

**Database Model: `CartReservation`**
```prisma
model CartReservation {
  id               String          @id @default(cuid())
  sessionId        String
  productId        String
  product          Product         @relation(...)
  productVariantId String?
  productVariant   ProductVariant? @relation(...)
  quantity         Int
  expiresAt        DateTime        // 15 minutes from creation
  isActive         Boolean         @default(true)
  createdAt        DateTime        @default(now())
}
```

**API Endpoint: `/api/cart-reservations`**
- `POST` - Reserve inventory when adding to cart
  - Creates 15-minute reservation
  - Checks available inventory (actual - reserved)
  - Prevents overselling
  - Returns expiration time
- `DELETE` - Release reservation
  - On cart removal
  - On checkout completion
  - On session timeout

**Reservation Logic:**
```typescript
RESERVATION_DURATION = 15 minutes

Available Inventory = Actual Inventory - Active Reservations

On Add to Cart:
  1. Clean up expired reservations
  2. Calculate available inventory
  3. Check if enough available
  4. Create/update reservation with expiration
  5. Return session ID and expiration time

On Checkout/Remove:
  1. Mark reservation as inactive
  2. Inventory becomes available again
```

## Database Schema Updates

**Migration:** `20251023221536_add_drop_notifications_and_cart_reservations`

**New Models:**
- `DropNotification` - Email subscribers for drops
- `CartReservation` - Temporary inventory locks

**Updated Relations:**
- `Product` → `dropNotifications[]`
- `Product` → `cartReservations[]`
- `ProductVariant` → `cartReservations[]`

## Integration Points

### Homepage Integration
```typescript
// app/page.tsx
import { getActiveDrop } from '@/lib/drops';
import DropHeroSection from '@/components/drops/DropHeroSection';

export default async function HomePage() {
  const activeDrop = await getActiveDrop();
  
  return (
    <>
      {activeDrop && <DropHeroSection product={activeDrop} />}
      {/* Rest of homepage */}
    </>
  );
}
```

### Product Page Integration
When user adds limited drop item to cart:
```typescript
// Reserve inventory
const response = await fetch('/api/cart-reservations', {
  method: 'POST',
  body: JSON.stringify({
    productId,
    productVariantId,
    quantity,
    sessionId: getSessionId(), // From cookies/localStorage
  }),
});

const { reservation } = await response.json();
// Store reservation.expiresAt to show countdown in cart
```

### Cart/Checkout Integration
```typescript
// Show reservation timer
<ReservationTimer expiresAt={reservation.expiresAt} />

// On checkout completion
await fetch('/api/cart-reservations', {
  method: 'DELETE',
  params: { sessionId },
});

// On cart item removal
await fetch('/api/cart-reservations', {
  method: 'DELETE',
  params: { reservationId },
});
```

## Utility Functions

### `/lib/drops.ts`
```typescript
// Get active or upcoming drop for homepage
getActiveDrop() → ActiveDrop | null

// Priority: Live drops > Upcoming drops (soonest first)
```

## Next Steps (TODO)

### 4. Build Reservation UI Components
- [x] Create API and database models
- [ ] Add reservation timer to cart page
- [ ] Show "Reserved for X minutes" in cart
- [ ] Add countdown timer to checkout
- [ ] Handle expiration gracefully (remove from cart)
- [ ] Show notification when reservation expires

### 5. Admin Interface
- [ ] View drop subscribers list
- [ ] Send manual drop notifications
- [ ] Export subscriber emails (CSV)
- [ ] Track notification metrics
- [ ] View reservation analytics

### 6. Email Templates
- [ ] Drop notification confirmation (on subscribe)
- [ ] Drop launch notification (when drop goes live)
- [ ] Drop reminder (1 hour before launch)
- [ ] Low stock alert (< 20% remaining)

### 7. Additional Features
- [ ] SMS notifications (via Twilio)
- [ ] Queue system for high-demand drops
- [ ] Bot protection (CAPTCHA on checkout)
- [ ] Early access for VIP customers
- [ ] Waitlist for sold-out drops

## How Customers Experience It

### Before Drop Launch
1. Visit homepage
2. See dramatic countdown section
3. Enter email to get notified
4. Receive confirmation email
5. Get notification when drop goes live

### During Drop (Live)
1. Homepage shows "DROP IS LIVE NOW" 
2. Click "SHOP NOW" button
3. View product and select size
4. Add to cart → **Inventory reserved for 15 minutes**
5. Cart shows "Reserved until [time]" countdown
6. Complete checkout within 15 minutes
7. Reservation released on purchase

### Reservation Expiration
1. If user doesn't checkout in 15 minutes
2. Reservation expires automatically
3. Inventory becomes available for others
4. User sees "Your reservation expired" message
5. Can attempt to add to cart again (if stock remains)

## Anti-Overselling Protection

**Problem:** Two users checkout same item simultaneously

**Solution:**
1. User A adds item → Reservation created (15 min)
2. User B tries to add → Sees "Only X available" (excludes User A's reservation)
3. User A completes checkout → Inventory reduced, reservation deactivated
4. OR User A's reservation expires → Inventory available for User B

**Database-Level Protection:**
```sql
-- Available inventory calculation
SELECT 
  variant.inventory - COALESCE(SUM(reservation.quantity), 0) as available
FROM product_variants variant
LEFT JOIN cart_reservations reservation 
  ON reservation.productVariantId = variant.id
  AND reservation.isActive = true
  AND reservation.expiresAt > NOW()
WHERE variant.id = ?
```

## Configuration

### Reservation Duration
```typescript
// app/api/cart-reservations/route.ts
const RESERVATION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Can be adjusted per drop tier:
// - Hyped drops: 10 minutes (high demand)
// - Regular drops: 15 minutes (standard)
// - Low demand: 20 minutes (more time)
```

### Drop Priority Logic
```typescript
// lib/drops.ts
// Show on homepage in this order:
1. Live drops (drop currently happening)
   - Sort by dropEndDate ASC (ending soonest first)
2. Upcoming drops (not started yet)
   - Sort by releaseDate ASC (starting soonest first)
3. No drop available → null
```

## Testing the System

### Test Drop Notifications
```bash
curl -X POST http://localhost:3000/api/drop-notifications \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "productId": "YOUR_PRODUCT_ID",
    "source": "homepage"
  }'
```

### Test Cart Reservations
```bash
# Reserve inventory
curl -X POST http://localhost:3000/api/cart-reservations \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "YOUR_PRODUCT_ID",
    "productVariantId": "YOUR_VARIANT_ID",
    "quantity": 1
  }'

# Release reservation
curl -X DELETE "http://localhost:3000/api/cart-reservations?sessionId=SESSION_ID"
```

### Test Homepage Drop Section
1. Create limited drop product (with future releaseDate)
2. Visit homepage
3. Should see countdown to drop launch
4. Enter email and subscribe
5. Change releaseDate to past (make drop live)
6. Refresh homepage
7. Should see "DROP IS LIVE NOW" with "SHOP NOW" button

## Performance Considerations

### Cleanup Expired Reservations
```typescript
// Runs automatically on each reservation creation
// Can also add cron job for periodic cleanup
async function cleanupExpiredReservations() {
  await prisma.cartReservation.updateMany({
    where: {
      isActive: true,
      expiresAt: { lte: new Date() }
    },
    data: { isActive: false }
  });
}
```

### Database Indexes
```prisma
@@index([productVariantId, isActive, expiresAt])
@@index([sessionId])
@@index([productId, notified])
```

## Security Considerations

1. **Rate Limiting** - Limit reservation requests per IP
2. **Session Validation** - Verify session IDs
3. **Email Validation** - Prevent spam subscriptions
4. **CAPTCHA** - Add to checkout for high-demand drops
5. **Concurrent Requests** - Use database transactions

## Future Enhancements

1. **Dynamic Reservation Time** - Adjust based on demand
2. **Priority Queue** - VIP customers get first access
3. **Inventory Alerts** - Notify when stock low
4. **Drop Calendar** - Show upcoming drops
5. **Analytics Dashboard** - Track drop performance
6. **A/B Testing** - Test different countdown designs
7. **Social Sharing** - Share countdown with friends
8. **Referral Program** - Early access for referrals

## Dependencies Added

```json
{
  "dependencies": {
    "framer-motion": "^11.x.x",
    "uuid": "^10.x.x"
  },
  "devDependencies": {
    "@types/uuid": "^10.x.x"
  }
}
```

## Files Created/Modified

### Created
- `/app/api/drop-notifications/route.ts` - Email notification API
- `/app/api/cart-reservations/route.ts` - Inventory reservation API
- `/components/drops/DropHeroSection.tsx` - Homepage drop section
- `/lib/drops.ts` - Drop utility functions
- `/prisma/migrations/20251023221536_add_drop_notifications_and_cart_reservations/` - Database migration
- `/docs/DROP-SYSTEM-COMPLETE.md` - This documentation

### Modified
- `/prisma/schema.prisma` - Added DropNotification and CartReservation models

## Support

For questions or issues with the drop system, refer to:
- `/docs/LIMITED-EDITION-DROPS-GUIDE.md` - User guide
- `/docs/DROP-SYSTEM-COMPLETE.md` - Technical documentation (this file)
