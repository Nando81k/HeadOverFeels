# Quick Integration Guide - Limited Drop Features

## 🎯 What We Built

You now have a complete limited edition drop system with:
1. ✅ **Email Notifications** - Users can subscribe to drops
2. ✅ **Dramatic Homepage Section** - Big countdown with animations
3. ✅ **Cart Reservations** - 15-minute time locks on checkout
4. ✅ **Reservation Timer** - Shows countdown in cart/checkout
5. ✅ **Anti-Overselling** - Database-level inventory protection

## 🚀 Quick Start

### Step 1: Add Homepage Drop Section

Edit `/app/page.tsx`:

```typescript
import { getActiveDrop } from '@/lib/drops';
import DropHeroSection from '@/components/drops/DropHeroSection';

export default async function HomePage() {
  const activeDrop = await getActiveDrop();
  
  return (
    <main>
      {/* Drop Section - Shows if there's an active or upcoming drop */}
      {activeDrop && <DropHeroSection product={activeDrop} />}
      
      {/* Rest of your homepage content */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2>Featured Products</h2>
        {/* ... */}
      </section>
    </main>
  );
}
```

### Step 2: Add Reservation on Add to Cart

When user clicks "Add to Cart" on a limited drop product:

```typescript
// In your AddToCartButton component
async function handleAddToCart() {
  // For limited edition products, create reservation first
  if (product.isLimitedEdition) {
    const sessionId = getOrCreateSessionId(); // From cookies/localStorage
    
    const reservationResponse = await fetch('/api/cart-reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        productVariantId: selectedVariant.id,
        quantity,
        sessionId,
      }),
    });

    if (!reservationResponse.ok) {
      const error = await reservationResponse.json();
      alert(error.error); // "Not enough inventory available"
      return;
    }

    const { reservation } = await reservationResponse.json();
    
    // Store reservation expiration in cart item
    addToCart({
      ...cartItem,
      reservation: {
        id: reservation.id,
        expiresAt: reservation.expiresAt,
      },
    });
  } else {
    // Regular products - just add to cart
    addToCart(cartItem);
  }
}
```

### Step 3: Show Reservation Timer in Cart

Edit your cart page to show the timer:

```typescript
import ReservationTimer from '@/components/cart/ReservationTimer';

export default function CartPage() {
  const { items } = useCart();
  
  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          {/* Product info */}
          <div>{item.product.name}</div>
          
          {/* Show timer if item has active reservation */}
          {item.reservation && (
            <ReservationTimer 
              expiresAt={item.reservation.expiresAt}
              onExpire={() => removeFromCart(item.id)}
              variant="compact"
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

### Step 4: Release Reservation on Checkout

After successful payment:

```typescript
async function handleCheckoutSuccess(sessionId: string) {
  // Release all reservations for this session
  await fetch(`/api/cart-reservations?sessionId=${sessionId}`, {
    method: 'DELETE',
  });
  
  // Clear cart
  clearCart();
  
  // Redirect to success page
  router.push('/order/success');
}
```

### Step 5: Handle Reservation Removal

When user removes item from cart:

```typescript
async function removeFromCart(itemId: string) {
  const item = cart.find(i => i.id === itemId);
  
  if (item?.reservation?.id) {
    // Release the reservation
    await fetch(`/api/cart-reservations?reservationId=${item.reservation.id}`, {
      method: 'DELETE',
    });
  }
  
  // Remove from cart state
  setCart(cart.filter(i => i.id !== itemId));
}
```

## 🎨 Customization

### Adjust Reservation Duration

Edit `/app/api/cart-reservations/route.ts`:

```typescript
// Change from 15 minutes to your preferred duration
const RESERVATION_DURATION_MS = 10 * 60 * 1000; // 10 minutes
```

### Customize Homepage Drop Section

Edit `/components/drops/DropHeroSection.tsx` to match your brand:
- Change gradient colors
- Adjust animation timing
- Modify countdown styling
- Update CTA button text

### Session ID Management

Create a utility to manage session IDs:

```typescript
// lib/session.ts
import { v4 as uuidv4 } from 'uuid';

export function getOrCreateSessionId(): string {
  const STORAGE_KEY = 'cart_session_id';
  
  // Try to get from localStorage
  if (typeof window !== 'undefined') {
    let sessionId = localStorage.getItem(STORAGE_KEY);
    
    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem(STORAGE_KEY, sessionId);
    }
    
    return sessionId;
  }
  
  // Server-side - generate new
  return uuidv4();
}
```

## 📧 Email Notifications (To Implement)

Users are already being stored in the database when they subscribe. To send emails:

1. **Install email service:**
```bash
npm install resend
# or
npm install @sendgrid/mail
```

2. **Create email template** in `/lib/email/templates/drop-notification.tsx`

3. **Send on drop launch** in `/app/api/drop-notifications/send/route.ts`:
```typescript
// Get all unnotified subscribers
const subscribers = await prisma.dropNotification.findMany({
  where: {
    productId,
    notified: false,
  },
});

// Send emails
for (const subscriber of subscribers) {
  await sendEmail({
    to: subscriber.email,
    subject: `🔥 ${product.name} Drop Is Live!`,
    template: 'drop-notification',
    data: { product },
  });
  
  // Mark as notified
  await prisma.dropNotification.update({
    where: { id: subscriber.id },
    data: {
      notified: true,
      notifiedAt: new Date(),
    },
  });
}
```

## 🧪 Testing

### Test the Homepage Section
1. Create a limited drop with future `releaseDate`
2. Visit homepage - should see countdown
3. Enter email and subscribe
4. Change `releaseDate` to past
5. Refresh - should see "DROP IS LIVE NOW"

### Test Cart Reservations
```bash
# Reserve inventory
curl -X POST http://localhost:3000/api/cart-reservations \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "YOUR_PRODUCT_ID",
    "productVariantId": "YOUR_VARIANT_ID",
    "quantity": 1,
    "sessionId": "test-session-123"
  }'

# Check available inventory (should be reduced)
# Try to reserve more than available (should fail)

# Release reservation
curl -X DELETE "http://localhost:3000/api/cart-reservations?sessionId=test-session-123"
```

## 🎯 Next Steps

### High Priority
1. **Integrate timer in cart** - Show `<ReservationTimer />` for limited drops
2. **Handle expiration** - Auto-remove expired items from cart
3. **Email notifications** - Send when drops launch
4. **Admin interface** - View subscribers, send notifications

### Nice to Have
5. **Queue system** - For extremely high-demand drops
6. **SMS notifications** - Via Twilio
7. **Early access** - VIP customers get 1-hour head start
8. **Social sharing** - Share countdown with friends
9. **Drop calendar** - Show all upcoming drops
10. **Analytics** - Track conversion rates per drop

## 📚 Documentation

- **Complete System Docs**: `/docs/DROP-SYSTEM-COMPLETE.md`
- **User Guide**: `/docs/LIMITED-EDITION-DROPS-GUIDE.md`
- **API Reference**: See comments in route files

## 🆘 Troubleshooting

### "Unknown argument `isLimitedEdition`"
```bash
# Regenerate Prisma Client
npx prisma generate

# Restart dev server
npm run dev
```

### Reservations not expiring
Check that cleanup function runs:
```typescript
// In /app/api/cart-reservations/route.ts
await cleanupExpiredReservations();
```

### Timer shows wrong time
Ensure dates are properly serialized:
```typescript
expiresAt={new Date(item.reservation.expiresAt)}
```

## 🎉 You're Done!

The core system is complete. Just integrate the components into your existing cart/checkout flow and you'll have a fully functional limited drop system with fair purchasing through time-based reservations!
