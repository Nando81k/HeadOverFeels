# Quick Start: Create a Limited Edition Drop

## 🚀 Fast Track (5 minutes)

### Step 1: Go to Admin
Navigate to: **http://localhost:3000/admin/products/new**

### Step 2: Fill Basic Info
```
Name: [Your Product] [LIMITED DROP]
Price: $XX (premium pricing recommended)
Description: Include 🔥 ⏰ emojis + scarcity messaging
```

### Step 3: Add Variants with Inventory
```
Size S  - Inventory: 20
Size M  - Inventory: 30
Size L  - Inventory: 30
Size XL - Inventory: 20
Total: 100 units
```

### Step 4: Enable Limited Edition Drop ⭐
**Check the box: ☑️ This is a Limited Edition Drop**

Fill in these 3 fields:
1. **Release Date**: `2025-10-23T14:00` (now or future)
2. **Drop End Date**: `2025-10-30T14:00` (7 days recommended)
3. **Max Quantity**: `100` (match total inventory)

### Step 5: Upload Images
- At least 3 images
- High quality (800x1000+)
- Professional shots

### Step 6: Settings
- ✅ Active
- ✅ Featured
- Select Category

### Step 7: Create!
Click **"Create Product"** button

## ✅ Done!
Your limited drop is live with:
- ⏰ Countdown timer
- 🎯 Stock counter
- 🔥 Urgency messaging
- ⚡ Auto-disable when sold out or time expires

## 📊 Example Drop Config
```javascript
{
  name: "Midnight Legend Hoodie [LIMITED DROP]",
  price: 120,
  compareAtPrice: 180,
  isLimitedEdition: true,
  releaseDate: "2025-10-23T14:00",
  dropEndDate: "2025-10-30T14:00",  // 7 days
  maxQuantity: 100,
  variants: [
    { size: "S", inventory: 20 },
    { size: "M", inventory: 30 },
    { size: "L", inventory: 30 },
    { size: "XL", inventory: 20 }
  ]
}
```

## 🎯 Drop Duration Recommendations
- **48 hours**: Intense urgency, high FOMO
- **7 days**: Balanced reach + urgency
- **2 weeks**: Maximum audience reach

## 💡 Pro Tips
1. Use premium pricing (20-40% markup)
2. Add countdown urgency in description
3. Show compare-at price for value perception
4. Upload 5+ high-quality images
5. Enable "Featured" for homepage visibility
6. Use emojis: 🔥 ⏰ 🎯 ✨ ⚡

## 🔗 Quick Links
- Create Drop: `/admin/products/new`
- View Products: `/admin/products`
- Manage Collections: `/admin/collections`
- Storefront: `/products`

---
**Ready to create your first drop? Let's go! 🚀**
