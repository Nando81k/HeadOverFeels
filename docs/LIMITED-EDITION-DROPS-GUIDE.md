# Creating Limited Edition Drop Products - Guide

## Overview
Limited Edition Drops are special product releases with:
- ⏰ Time-limited availability (countdown timer)
- 🎯 Maximum quantity cap (scarcity)
- 🔥 Exclusive "Drop" branding
- ⚡ Urgency-driven purchase behavior

## Step-by-Step Guide

### 1. Access Admin Product Creation
Navigate to: `http://localhost:3000/admin/products/new`

### 2. Basic Product Information
Fill in the standard fields:
- **Name**: Include "[LIMITED DROP]" or "[LIMITED EDITION]" suffix
  - Example: "Midnight Legend Hoodie [LIMITED DROP]"
- **Description**: Emphasize scarcity and urgency
  - Mention limited quantity
  - Highlight drop end date
  - Use emojis: 🔥 ⏰ 🎯 ✨
- **Price**: Consider premium pricing for exclusivity
- **Compare At Price**: Show original value to create urgency

### 3. Product Variants
Add size/color variants with **LIMITED inventory**:
- Click "Add Variant"
- Set **Inventory** carefully - this counts towards maxQuantity
- Example:
  - S: 20 units
  - M: 30 units
  - L: 30 units
  - XL: 20 units
  - Total: 100 units

### 4. Limited Edition Drop Section ⭐
This is the key section! Enable the checkbox:

**☑️ This is a Limited Edition Drop**

Once checked, fill in:

#### Release Date
- Set to NOW if launching immediately
- Or schedule for future date/time
- Format: `2025-10-23T14:00` (datetime-local)

#### Drop End Date ⏰
- Set end date (e.g., 7 days from now)
- Creates urgency with countdown
- Format: `2025-10-30T14:00` (datetime-local)

#### Max Quantity 🎯
- Total units available globally
- Should match total inventory across all variants
- Example: 100 units
- Once sold out, drop ends automatically

### 5. Product Images
Upload high-quality images:
- Hero shot (front view)
- Back view
- Detail shots (embroidery, tags, etc.)
- Lifestyle/model shots
- Use 800x1000 or larger resolution

### 6. Settings
- ✅ **Active**: Enable to make visible
- ✅ **Featured**: Show on homepage
- 📦 **Category**: Select appropriate category

### 7. Submit
Click "Create Product" - your limited drop is now live!

## What Happens After Creation

### Frontend Features (Automatic)
1. **Countdown Timer** appears on product page
   - Shows days, hours, minutes, seconds remaining
   - Updates in real-time
   - Located below product images

2. **"Limited Edition" Badge**
   - Displayed on product cards
   - Shows on product detail page
   - Creates visual urgency

3. **Stock Counter**
   - Shows remaining units
   - Updates as sales occur
   - "Only X left!" messaging

4. **Purchase Restrictions**
   - Prevents purchase after drop ends
   - Shows "Drop Ended" message
   - Hides "Add to Cart" button after deadline

### Example Limited Drop Products

#### Example 1: Midnight Legend Hoodie
```
Name: Midnight Legend Hoodie [LIMITED DROP]
Price: $120 (Compare At: $180)
Release: Oct 23, 2025 2:00 PM
End Date: Oct 30, 2025 2:00 PM (7 days)
Max Quantity: 100 units
Variants:
  - S (20), M (30), L (30), XL (20)
```

#### Example 2: Sunset Collection Tee
```
Name: Sunset Collection Tee [LIMITED EDITION]
Price: $45 (Compare At: $65)
Release: Oct 23, 2025 6:00 PM
End Date: Oct 25, 2025 6:00 PM (48 hours)
Max Quantity: 200 units
Variants:
  - S (40), M (60), L (60), XL (40)
```

## Best Practices

### Timing
- ⏰ 48-hour drops: Creates intense urgency
- 📅 7-day drops: Allows wider reach
- 🎯 Weekly drops: Build anticipation

### Quantities
- 🔥 50-100 units: Ultra-exclusive
- ⚡ 100-300 units: Limited but accessible
- 🎪 300-500 units: Mass-appeal limited

### Marketing Copy
Use urgency-driven language:
- "Only 100 pieces worldwide"
- "Once they're gone, they're gone forever"
- "Will never be restocked"
- "Collector's item"
- "Exclusive release"

### Pricing Strategy
- Premium pricing (20-40% above regular)
- Show compare-at price
- Emphasize value and exclusivity

### Images
- Professional photography
- Lifestyle shots showing exclusivity
- Detail shots of premium features
- Behind-the-scenes content

## Monitoring Your Drop

### Check Drop Status
1. Go to `/admin/products`
2. Find your limited edition product
3. Click "Edit"
4. View current inventory levels
5. Check time remaining

### Update Drop
You can edit:
- ✅ Drop end date (extend or shorten)
- ✅ Max quantity (increase only)
- ✅ Inventory per variant
- ❌ Cannot change after sales start

## After Drop Ends

### What Happens
- Product automatically shows "Drop Ended"
- Add to Cart button disabled
- Product remains visible as archive
- Can set `isActive: false` to hide

### Next Steps
1. Analyze sales data
2. Plan next drop
3. Build email list of interested customers
4. Create FOMO for next release

## Technical Details

### Database Fields
```typescript
isLimitedEdition: boolean    // Enable drop mode
releaseDate: Date            // When drop starts
dropEndDate: Date            // When drop ends
maxQuantity: number          // Total units available
```

### Countdown Timer Component
Located in: `/components/products/CountdownTimer.tsx`
- Auto-updates every second
- Shows time remaining
- Triggers onExpire callback

### Stock Calculation
```typescript
totalStock = variants.reduce((sum, v) => sum + v.inventory, 0)
isAvailable = totalStock > 0 && now < dropEndDate
```

## Troubleshooting

### Timer Not Showing
- Check `isLimitedEdition: true`
- Verify `dropEndDate` is set
- Ensure dropEndDate is in future

### Can't Purchase
- Check current time vs releaseDate
- Verify inventory > 0
- Check dropEndDate hasn't passed

### Wrong Inventory Count
- Sum all variant inventories
- Should match maxQuantity
- Update variants if needed

## Questions?
Check the admin dashboard at `/admin/products` to manage all your limited drops!
