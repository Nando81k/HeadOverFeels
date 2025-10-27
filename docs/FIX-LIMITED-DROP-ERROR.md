# Limited Edition Drop Creation - Error Fix

## Issue
Getting 500 Internal Server Error when creating a limited edition drop product:
```
POST http://localhost:3000/api/products 500 (Internal Server Error)
```

## Root Causes & Fixes

### 1. Images Field Type Mismatch ✅ FIXED
**Problem**: API expected `images` as a JSON string, but could receive an array from the form.

**Solution**: Updated Zod schema to accept both formats:
```typescript
images: z.union([
  z.string(), // JSON string
  z.array(z.string()) // Array of strings
]).transform(val => {
  // Convert to JSON string if it's an array
  if (Array.isArray(val)) {
    return JSON.stringify(val)
  }
  return val
}).default('[]')
```

### 2. CategoryId Null Handling ✅ FIXED
**Problem**: `categoryId` could be sent as `null` or empty string, causing database errors.

**Solution**: Updated to use `.nullish()` and transform to `undefined`:
```typescript
categoryId: z.string().nullish().transform(val => val || undefined)
```

### 3. Limited Drop Fields Null Handling ✅ FIXED
**Problem**: `releaseDate`, `dropEndDate`, and `maxQuantity` needed better null handling.

**Solution**: 
```typescript
releaseDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
dropEndDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
maxQuantity: z.number().int().positive().nullish()
```

### 4. TypeScript Type Fix ✅ FIXED
**Problem**: Type mismatch for `maxQuantity` in productCreateData.

**Solution**: 
```typescript
const productCreateData: {
  // ... other fields
  maxQuantity?: number | null  // Allow null
  // ... other fields
} = {
  ...productData,
  slug,
  maxQuantity: productData.maxQuantity ?? undefined  // Convert null to undefined
}
```

### 5. Enhanced Error Logging ✅ ADDED
**Added**: Better console logging for debugging:
```typescript
console.log('Received product data:', JSON.stringify(body, null, 2))
console.log('Validated data:', JSON.stringify(validatedData, null, 2))
console.error('Error details:', error instanceof Error ? error.message : String(error))
```

## Changes Made

**File**: `/app/api/products/route.ts`

1. Updated `createProductSchema` with better type handling
2. Added logging for request body and validated data
3. Improved error messages with details
4. Fixed TypeScript types for `productCreateData`

## Testing

### Build Status
✅ **Build Successful** - All TypeScript errors resolved

### Try Creating a Drop Again

1. Navigate to: `http://localhost:3000/admin/products/new`
2. Fill in the form:
   - Name: "Test Drop [LIMITED DROP]"
   - Price: 100
   - Add at least one variant with inventory
   - **Check**: ☑️ "This is a limited edition drop"
   - Set release date (now)
   - Set drop end date (7 days from now)
   - Set max quantity (matching total inventory)
3. Click "Create Product"

### If Still Getting Errors

Check the browser console and terminal logs. The enhanced logging will now show:
- Exact data being sent
- Validation results
- Specific error messages

## Quick Test Example

Create a minimal test drop:
```json
{
  "name": "Test Drop [LIMITED DROP]",
  "description": "Test limited drop",
  "price": 100,
  "isActive": true,
  "isFeatured": true,
  "isLimitedEdition": true,
  "releaseDate": "2025-10-23T14:00",
  "dropEndDate": "2025-10-30T14:00",
  "maxQuantity": 50,
  "variants": [
    {
      "sku": "TEST-001",
      "size": "M",
      "color": "Black",
      "inventory": 50,
      "isActive": true
    }
  ],
  "images": []
}
```

## Additional Notes

- All fields properly handle `null`, `undefined`, and empty strings
- Images can be sent as array or JSON string
- CategoryId is optional and handled correctly
- Limited drop fields are all optional (enabled only when checkbox is checked)
- Build passes with no TypeScript errors

## Need More Help?

If errors persist:
1. Check terminal for detailed error logs
2. Check browser console for validation details
3. Verify database schema is up to date: `npx prisma migrate dev`
4. Regenerate Prisma client: `npx prisma generate`
5. Clear Next.js cache: `rm -rf .next`

---

**Status**: ✅ Ready to create limited drops!
