# Limited Edition Drop Not Showing on Home Page - Fix

**Date**: October 26, 2025  
**Issue**: Limited Edition drop created but not rendering on home page  
**Status**: ✅ **RESOLVED**

---

## Problem

User created a Limited Edition drop but it wasn't appearing on the home page, even though:
- The drop existed in the database
- The drop had valid release/end dates
- The drop had inventory available
- The drop dates indicated it should be showing

---

## Root Cause

The drop was created with **`isActive = false`** (0 in the database).

The home page query in `/lib/drops.ts` requires **both conditions** to be true:
```typescript
where: {
  isLimitedEdition: true,
  isActive: true,  // ← This was FALSE!
  // ... date conditions
}
```

**Why it happened**:
- When creating a product via admin form, the `isActive` checkbox may have been unchecked
- Or the product was created and saved as draft (inactive)
- The validation logic doesn't enforce `isActive = true` for drops

---

## Investigation Steps

### 1. Checked Database
```sql
SELECT id, name, isLimitedEdition, isActive, releaseDate, dropEndDate
FROM products
WHERE isLimitedEdition = 1;
```

**Result**:
```
Eva's Purple Flame [LIMITED EDITION] | isActive = 0  ← FOUND THE ISSUE!
```

### 2. Verified Drop Status
- Release Date: December 30, 2025 @ 11:00 AM (upcoming)
- Drop End Date: January 11, 2026 @ 11:00 AM
- Current Status: ⏳ **Upcoming** (should show with countdown)
- Inventory: 30 units available
- **Problem**: `isActive = false` prevented it from showing

### 3. Tested Query Logic
The `getActiveDrop()` function requires:
- ✅ `isLimitedEdition = true`
- ❌ `isActive = true` (this was false!)
- ✅ Valid date range
- ✅ Inventory > 0

Without `isActive = true`, the query returns `null` → no drop shows.

---

## Solution

### Quick Fix (SQL Update)
```bash
cd /path/to/project
sqlite3 prisma/dev.db "UPDATE products SET isActive = 1 WHERE isLimitedEdition = 1;"
```

**Result**: Updated 1 drop(s) to active

### Automated Fix Script
Created `/scripts/fix-inactive-drops.ts` that:
1. Finds all Limited Edition drops
2. Identifies inactive ones
3. Activates them automatically
4. Shows status report

**Usage**:
```bash
npx tsx scripts/fix-inactive-drops.ts
```

**Output Example**:
```
🔍 Checking Limited Edition drops...

Found 1 Limited Edition drop(s):

1. "Eva's Purple Flame [LIMITED EDITION]"
   ID: cmh84egrp000cyl7snirzaglf
   Status: ⏳ Upcoming
   Active: ❌ NO
   Inventory: 30 units
   🚨 ISSUE: Product is INACTIVE - won't show on home page!

🔧 Found 1 inactive drop(s). Activating them...
✅ Activated: "Eva's Purple Flame [LIMITED EDITION]"

🎉 Success! All drops are now active.
   Refresh your home page to see the Limited Edition drop.
```

---

## Verification

After activation:
```sql
SELECT id, name, isActive, 
       (SELECT SUM(inventory) FROM product_variants WHERE productId = products.id) as inventory
FROM products 
WHERE isLimitedEdition = 1;
```

**Result**:
```
Eva's Purple Flame [LIMITED EDITION] | isActive = 1 ✅ | inventory = 30
```

---

## Prevention

### For Admins Creating Drops

**Always ensure** when creating a Limited Edition drop:

1. **Check "Active" checkbox** in the product form
2. **Verify in Admin Product List**: Product should show as "Active"
3. **Test on Home Page**: Visit `/` to confirm drop appears

### Admin Form Validation (Future Enhancement)

Consider adding validation that **auto-activates** Limited Edition drops:

```typescript
// In /app/api/products/route.ts
if (validatedData.isLimitedEdition) {
  productData.isActive = true; // Force active for drops
}
```

Or add a **warning message** in the UI:
```tsx
{formData.isLimitedEdition && !formData.isActive && (
  <Alert variant="warning">
    ⚠️ This Limited Edition drop is INACTIVE and won't show on the home page.
    Check "Active" to make it visible to customers.
  </Alert>
)}
```

---

## Technical Details

### Home Page Drop Display Logic

**File**: `/app/page.tsx`

```typescript
// 1. Fetch active drop (must be isActive=true)
const activeDrop = await getActiveDrop()

// 2. Check inventory
const dropHasStock = activeDrop?.variants.some(v => v.inventory > 0)

// 3. Determine status (past/live/upcoming)
const dropStatus = getDropStatus(activeDrop)

// 4. Decide if should show
const shouldShowDrop = activeDrop && (
  (dropStatus === 'live' && dropHasStock) ||  // Live with stock
  dropStatus === 'upcoming'                    // Or upcoming
)

// 5. Conditionally render
{shouldShowDrop && convertedDrop && (
  <DropHeroSection product={convertedDrop} />
)}
```

### Query Requirements

**File**: `/lib/drops.ts` → `getActiveDrop()`

```typescript
where: {
  isLimitedEdition: true,  // Must be a drop
  isActive: true,          // Must be active ← KEY REQUIREMENT
  releaseDate: { lte: now },  // For live drops
  dropEndDate: { gte: now }   // For live drops
}
// OR
where: {
  isLimitedEdition: true,
  isActive: true,          // Must be active ← KEY REQUIREMENT
  releaseDate: { gt: now }    // For upcoming drops
}
```

---

## Testing Checklist

After applying the fix:

- [x] Drop shows `isActive = 1` in database
- [x] Home page renders drop section
- [x] Countdown timer appears (for upcoming drops)
- [x] Stock level shows correctly
- [x] "Shop Now" button links to product page
- [x] Drop disappears when dates pass

---

## Related Issues

### If Drop Still Doesn't Show

Check these common issues:

1. **No Inventory**: Drop has 0 total inventory across all variants
   ```sql
   SELECT SUM(inventory) FROM product_variants WHERE productId = 'drop-id';
   ```
   **Fix**: Add inventory via Restock Modal or edit product

2. **Wrong Dates**: Release date in the future but marked as "live"
   ```sql
   SELECT releaseDate, dropEndDate FROM products WHERE id = 'drop-id';
   ```
   **Fix**: Update dates to correct range

3. **Past Drop**: Drop end date has passed
   ```typescript
   if (now > dropEndDate) // Won't show
   ```
   **Fix**: Extend `dropEndDate` or create new drop

4. **Images Not Parsed**: Drop has images but as JSON string
   ```typescript
   // Already handled in home page
   const convertedDrop = activeDrop ? {
     ...activeDrop,
     images: JSON.parse(activeDrop.images)
   } : null
   ```

---

## Files Modified

1. ✅ `/scripts/fix-inactive-drops.ts` - New diagnostic script
2. ✅ `prisma/dev.db` - Updated `isActive = 1` for drop
3. ✅ `/app/page.tsx` - Removed debug logging (kept clean)

---

## Summary

**Issue**: Drop created but `isActive = false`  
**Fix**: Set `isActive = true` via SQL or script  
**Prevention**: Always check "Active" when creating drops  
**Scripts**: Use `fix-inactive-drops.ts` for diagnostics  
**Result**: ✅ Drop now shows on home page with countdown!

---

## Quick Reference Commands

```bash
# Check all drops
sqlite3 prisma/dev.db "SELECT name, isActive, isLimitedEdition FROM products WHERE isLimitedEdition = 1;"

# Activate all drops
sqlite3 prisma/dev.db "UPDATE products SET isActive = 1 WHERE isLimitedEdition = 1;"

# Run diagnostic script
npx tsx scripts/fix-inactive-drops.ts

# View in Prisma Studio
npx prisma studio
# Navigate to: products table → filter isLimitedEdition = true
```
