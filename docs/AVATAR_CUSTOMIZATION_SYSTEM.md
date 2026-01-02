# Avatar Customization System - Complete Guide

## Overview

The Avatar Customization System allows customers to create and personalize 3D avatars using items unlocked through purchases. When a customer buys a product, they automatically unlock the digital version of that item to equip on their avatar.

## Key Features

- **3D Avatar Rendering**: Interactive 3D avatars using Three.js and React Three Fiber
- **Purchase-Based Unlocking**: Avatar items are automatically unlocked when orders are completed
- **Slot-Based System**: 7 customization slots (Hair, Headwear, Top, Outerwear, Bottom, Shoes, Accessory)
- **Rarity System**: Items have rarity levels (Common, Uncommon, Rare, Epic, Legendary)
- **Admin Management**: Full admin interface for creating and managing avatar items

## Database Schema

### UserAvatar
Stores each customer's avatar configuration:
- `customerId` - Links to Customer
- `configuration` - JSON object with equipped items by slot
- `skinTone` - Hex color for skin tone (default: #FFE0BD)
- `bodyType` - Avatar body type (default: "default")

### AvatarItem
Represents available avatar items:
- `name` - Item name
- `slot` - Which slot it occupies (HAIR, TOP, BOTTOM, SHOES, etc.)
- `modelUrl` - URL to 3D model file (GLB/GLTF format)
- `thumbnailUrl` - Preview image
- `productId` - Optional link to Product (unlocked on purchase)
- `rarity` - Item rarity level
- `isDefault` - If true, available to all users

### UserAvatarItem
Tracks unlocked items per customer:
- `customerId` - The customer who unlocked it
- `avatarItemId` - The item that was unlocked
- `unlockedVia` - How it was unlocked ("purchase", "loyalty_reward", "admin_grant")
- `orderId` - Reference to order if unlocked via purchase

## Technical Architecture

### Frontend Components

#### AvatarCanvas (`/components/avatar/AvatarCanvas.tsx`)
Main 3D rendering component using React Three Fiber:
```tsx
<AvatarCanvas
  configuration={{ top: "item-id-1", bottom: "item-id-2" }}
  skinTone="#FFE0BD"
  bodyType="default"
  interactive={true}
/>
```

Features:
- OrbitControls for 360° rotation
- Professional lighting setup (ambient + directional + point lights)
- Shadow rendering
- Environment reflections

#### AvatarModel (`/components/avatar/AvatarModel.tsx`)
Handles 3D model loading and composition:
- Base body rendering with customizable skin tone
- Dynamic item loading from GLB/GLTF files
- Layer-based rendering for each slot

#### AvatarCustomizer (`/components/avatar/AvatarCustomizer.tsx`)
Complete UI for avatar customization:
- Live 3D preview
- Slot-based item selection
- Visual indicators for locked/unlocked items
- Rarity color coding
- Save functionality

### API Endpoints

#### GET `/api/avatar`
Fetch user's avatar data:
```typescript
Headers: { 'x-customer-id': 'customer-id' }

Response: {
  avatar: {
    id: string,
    configuration: { slot: itemId },
    skinTone: string,
    bodyType: string
  },
  unlockedItems: AvatarItem[],
  defaultItems: AvatarItem[]
}
```

#### PUT `/api/avatar`
Update avatar configuration:
```typescript
Headers: { 'x-customer-id': 'customer-id' }
Body: {
  configuration: { top: 'item-id', bottom: 'item-id' },
  skinTone: '#FFE0BD',
  bodyType: 'default'
}
```

Validates that user owns all equipped items.

#### GET `/api/avatar/items`
Browse all avatar items:
```typescript
Query: ?slot=TOP (optional)
Headers: { 'x-customer-id': 'customer-id' } (optional)

Response: {
  items: [{
    ...itemData,
    unlocked: boolean // if customerId provided
  }]
}
```

#### POST `/api/avatar/items` (Admin Only)
Create new avatar item:
```typescript
Headers: { 'x-is-admin': 'true' }
Body: {
  name: string,
  slot: AvatarSlot,
  modelUrl: string,
  thumbnailUrl?: string,
  productId?: string,
  rarity: ItemRarity,
  isDefault: boolean
}
```

#### POST `/api/avatar/unlock`
Manual unlock endpoint (primarily for testing):
```typescript
Body: {
  orderId: string,
  customerId: string
}
```

## Integration Points

### Stripe Webhook Integration
Avatar items are automatically unlocked in `/app/api/stripe/webhook/route.ts`:

```typescript
// After order payment succeeds
if (order.customerId) {
  // Fetch order with avatar items
  const orderWithAvatarItems = await prisma.order.findUnique({
    include: { items: { include: { product: { include: { avatarItems: true }}}}}
  });

  // Unlock all avatar items from purchased products
  for (const orderItem of orderWithAvatarItems.items) {
    if (orderItem.product.avatarItems) {
      await prisma.userAvatarItem.upsert({
        where: { customerId_avatarItemId: { customerId, avatarItemId }},
        create: { customerId, avatarItemId, unlockedVia: 'purchase', orderId }
      });
    }
  }
}
```

### Product Association
Products can have associated avatar items:
1. Admin creates avatar item and links it to a product
2. When customer purchases that product, they unlock the avatar item
3. Item becomes available in their avatar customization interface

## Admin Workflows

### Creating Avatar Items

1. Navigate to `/admin/avatar-items`
2. Click "Add Avatar Item"
3. Fill in the form:
   - **Name**: Display name for the item
   - **Slot**: Which body part it occupies
   - **Model URL**: Link to GLB/GLTF 3D model file
   - **Thumbnail URL**: Preview image (optional)
   - **Rarity**: Common → Legendary
   - **Associated Product**: Link to product for auto-unlock
   - **Is Default**: Make available to all users without purchase

4. Submit to create

### 3D Model Requirements

Avatar items should be in GLB or GLTF format:
- **File Size**: Keep under 5MB for performance
- **Polygons**: Optimize to 10k-50k polygons
- **Textures**: Use compressed textures (1024x1024 or smaller)
- **Position**: Models should be positioned to fit default avatar scale
- **Format**: GLB preferred (single file with embedded textures)

Recommended tools:
- Blender (free, open-source)
- Mixamo (free rigged characters)
- Sketchfab (3D model marketplace with GLB export)

## User Workflows

### Customizing Avatar

1. User logs in and navigates to their profile
2. Avatar customization section displays current avatar
3. User can:
   - Rotate avatar with mouse/touch
   - Select different slots (Hair, Top, Bottom, etc.)
   - Browse unlocked items for that slot
   - Click to equip/unequip items
   - Save configuration

4. Avatar persists across sessions

### Unlocking Items

Items are unlocked automatically when:
1. User completes a purchase
2. Order payment is confirmed via Stripe webhook
3. System checks if purchased products have linked avatar items
4. Items are added to user's collection
5. User receives notification (future enhancement)

## Usage Example

### Adding Avatar Customizer to Profile Page

```tsx
import AvatarCustomizer from '@/components/avatar/AvatarCustomizer';

// In your profile page component
<div className="container">
  <h1>My Profile</h1>
  
  {/* Other profile sections */}
  
  <AvatarCustomizer customerId={user.id} />
</div>
```

### Standalone Avatar Display

```tsx
import AvatarCanvas from '@/components/avatar/AvatarCanvas';

// Display avatar in any view
<div className="w-full h-96">
  <AvatarCanvas
    configuration={avatarConfig}
    skinTone="#FFE0BD"
    interactive={false} // Read-only display
  />
</div>
```

## Dependencies

### NPM Packages
```json
{
  "three": "^0.160.0",
  "@react-three/fiber": "^8.15.0",
  "@react-three/drei": "^9.92.0"
}
```

Install with:
```bash
npm install three @react-three/fiber @react-three/drei
```

## Future Enhancements

### Planned Features
1. **Animation System**: Idle poses and emotes
2. **Avatar Snapshots**: Take photos of avatar for profile pictures
3. **Social Sharing**: Share avatar on social media
4. **Avatar Marketplace**: Trade items between users
5. **Limited Edition Items**: Time-limited exclusive drops
6. **Achievement Items**: Unlock via loyalty milestones
7. **Customizable Skin Tones**: UI picker for skin color
8. **Body Type Selection**: Different body shapes

### Performance Optimizations
1. **Model Caching**: Preload common models
2. **LOD System**: Level of detail for different devices
3. **Texture Compression**: Optimize texture loading
4. **Lazy Loading**: Load items on-demand

## Troubleshooting

### Common Issues

**Issue**: Avatar not rendering
- Check browser WebGL support
- Verify model URLs are accessible
- Check console for Three.js errors

**Issue**: Items not unlocking after purchase
- Verify Stripe webhook is configured
- Check webhook logs for errors
- Ensure product has associated avatar items

**Issue**: Performance issues
- Reduce model polygon count
- Compress textures
- Limit number of simultaneously loaded models

**Issue**: Models appear broken or misaligned
- Verify GLB/GLTF file integrity
- Check model scale and position in Blender
- Ensure proper vertex normals

## API Testing

### Testing Avatar APIs with cURL

```bash
# Get avatar data
curl -X GET http://localhost:3000/api/avatar \
  -H "x-customer-id: customer-id"

# Update avatar
curl -X PUT http://localhost:3000/api/avatar \
  -H "x-customer-id: customer-id" \
  -H "Content-Type: application/json" \
  -d '{"configuration":{"top":"item-id"}}'

# Create avatar item (admin)
curl -X POST http://localhost:3000/api/avatar/items \
  -H "x-is-admin: true" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cool T-Shirt",
    "slot": "TOP",
    "modelUrl": "https://example.com/shirt.glb",
    "rarity": "COMMON",
    "isDefault": true
  }'
```

## Security Considerations

1. **Item Ownership Validation**: API validates user owns items before equipping
2. **Admin-Only Creation**: Only admins can create avatar items
3. **Model URL Validation**: Ensure URLs point to trusted sources
4. **Rate Limiting**: Consider adding rate limits for avatar updates

## Support

For issues or questions:
- Check database schema in `prisma/schema.prisma`
- Review API endpoints in `app/api/avatar/`
- Inspect components in `components/avatar/`
- Check Stripe webhook in `app/api/stripe/webhook/route.ts`

---

**System Status**: ✅ Fully Implemented
**Last Updated**: November 2025
**Version**: 1.0.0
