# Avatar Customization - Quick Start Guide

Get your avatar system up and running in 5 minutes!

## 1. ✅ Verify Installation

The system is already installed and configured. Verify by checking:

```bash
# Confirm database migration
npx prisma studio
# Look for: UserAvatar, AvatarItem, UserAvatarItem tables

# Confirm dependencies
npm list three @react-three/fiber @react-three/drei
```

## 2. 🎨 Create Your First Avatar Item

### Option A: Via Admin UI

1. Start your dev server:
```bash
npm run dev
```

2. Navigate to: `http://localhost:3000/admin/avatar-items`

3. Click "Add Avatar Item" and fill in:
   - **Name**: "Basic T-Shirt"
   - **Slot**: TOP
   - **Model URL**: Use a sample GLB file or placeholder
   - **Rarity**: COMMON
   - **Is Default**: ✅ (makes it available to everyone)

4. Click "Create Item"

### Option B: Via API

```bash
curl -X POST http://localhost:3000/api/avatar/items \
  -H "x-is-admin: true" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Basic T-Shirt",
    "slot": "TOP",
    "modelUrl": "https://example.com/tshirt.glb",
    "rarity": "COMMON",
    "isDefault": true
  }'
```

### Option C: Directly in Database

```typescript
// Use Prisma Studio or this code snippet
await prisma.avatarItem.create({
  data: {
    name: "Basic T-Shirt",
    slot: "TOP",
    modelUrl: "https://example.com/tshirt.glb",
    rarity: "COMMON",
    isDefault: true,
  },
});
```

## 3. 🧍 Test the Avatar Customizer

### Add to Profile Page

Open `app/profile/page.tsx` and add:

```tsx
import AvatarCustomizer from '@/components/avatar/AvatarCustomizer';

// Inside your component, after other profile sections:
{user && (
  <div className="mt-8">
    <AvatarCustomizer customerId={user.id} />
  </div>
)}
```

### Or Create a Standalone Test Page

Create `app/avatar/page.tsx`:

```tsx
'use client';

import { useAuth } from '@/lib/auth/context';
import AvatarCustomizer from '@/components/avatar/AvatarCustomizer';

export default function AvatarTestPage() {
  const { user } = useAuth();
  
  if (!user) {
    return <div>Please sign in</div>;
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Avatar Customization</h1>
      <AvatarCustomizer customerId={user.id} />
    </div>
  );
}
```

Visit: `http://localhost:3000/avatar`

## 4. 🛍️ Link Avatar Item to Product

### Via Admin UI (Recommended)

When creating an avatar item in `/admin/avatar-items`:
- Select a product from the "Associated Product" dropdown
- Now purchasing that product unlocks the avatar item!

### Via Database

```typescript
await prisma.avatarItem.create({
  data: {
    name: "Cool Hoodie (Digital)",
    slot: "OUTERWEAR",
    modelUrl: "https://example.com/hoodie.glb",
    productId: "your-product-id", // Link to existing product
    rarity: "RARE",
    isDefault: false, // Only unlocked via purchase
  },
});
```

## 5. 🧪 Test Purchase → Unlock Flow

1. **Create a test product** with linked avatar item
2. **Make a test purchase** (use Stripe test mode)
3. **Complete payment** via Stripe webhook
4. **Check avatar customizer** - item should be unlocked!

### Manual Testing (Skip Payment)

```bash
# Manually unlock an item for testing
curl -X POST http://localhost:3000/api/avatar/unlock \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-order-id",
    "customerId": "your-customer-id"
  }'
```

## 6. 📦 Sample 3D Models (For Testing)

Since you need GLB/GLTF files, here are free sources:

### Free 3D Model Resources
1. **Sketchfab** (https://sketchfab.com)
   - Filter by: Free Download, GLB format
   - Great for clothing items

2. **Mixamo** (https://www.mixamo.com)
   - Free rigged characters
   - Export as FBX → Convert to GLB with Blender

3. **Poly Pizza** (https://poly.pizza)
   - Public domain 3D models
   - Direct GLB download

4. **Ready Player Me** (https://readyplayer.me)
   - Avatar creation tool with GLB export
   - Perfect for base avatars

### Quick Test Models (Placeholders)

For immediate testing without real 3D files, use placeholder URLs:

```typescript
// These won't render but won't break the system
{
  modelUrl: "https://placeholder.com/avatar/tshirt.glb",
  thumbnailUrl: "https://via.placeholder.com/200",
}
```

## 7. 🎯 Quick Integration Checklist

- [ ] Database tables created (UserAvatar, AvatarItem, UserAvatarItem)
- [ ] At least one default avatar item created
- [ ] AvatarCustomizer component added to profile page
- [ ] Test avatar loading and rendering
- [ ] Create product with linked avatar item
- [ ] Test purchase → unlock flow
- [ ] Check Stripe webhook logs for avatar unlock confirmation

## 8. 🐛 Common Quick Fixes

### Avatar Canvas Blank/Black
```tsx
// Ensure you have ambient light
<ambientLight intensity={0.5} />
<directionalLight position={[5, 5, 5]} intensity={1} />
```

### Items Not Showing
```sql
-- Check if items exist
SELECT * FROM avatar_items;

-- Check if items are unlocked for user
SELECT * FROM user_avatar_items WHERE customerId = 'your-id';
```

### Stripe Webhook Not Unlocking Items
```typescript
// Check webhook logs in Stripe Dashboard
// Verify STRIPE_WEBHOOK_SECRET is set in .env
// Check console logs for "✅ Unlocked X avatar item(s)"
```

## 9. 🚀 Next Steps

Once basic setup works:

1. **Add More Items**: Create items for all 7 slots
2. **Create Rarity Tiers**: Mix common and rare items
3. **Link to Products**: Associate items with real products
4. **Customize Appearance**: Adjust avatar colors and styles
5. **Add Animations**: Implement avatar poses (future enhancement)

## 10. 📚 Full Documentation

For detailed information, see:
- `AVATAR_CUSTOMIZATION_SYSTEM.md` - Complete system documentation
- `prisma/schema.prisma` - Database schema
- `components/avatar/` - Component source code
- `app/api/avatar/` - API endpoints

## Support

Having issues? Check:
1. Browser console for errors
2. Network tab for failed API calls
3. Prisma Studio for database state
4. `npm run dev` terminal for server logs

---

**Ready to go!** The system is fully functional and ready for customization. Start by creating some avatar items and testing the customization interface! 🎉
