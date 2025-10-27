# Quick Restock Modal - Implementation Guide

## Overview
This document describes the implementation of the Quick Restock Modal feature, which allows admins to efficiently update product inventory directly from the product list page without navigating to the full edit form.

## Implementation Date
January 26, 2025

## Features Implemented

### 1. RestockModal Component
**File**: `/components/admin/RestockModal.tsx`

A fully-featured modal dialog for bulk inventory updates with:

#### UI Features
- **Variant Table View**: All product variants displayed in a clean, scannable table
- **Current vs. New Inventory**: Side-by-side comparison with color-coded status
  - 🔴 Red: Out of stock (0 units)
  - 🟠 Orange: Low stock (1-5 units)
  - 🟢 Green: Normal stock (6+ units)
- **Live Change Calculation**: Shows +/- change for each variant
- **Total Change Summary**: Displays aggregate inventory change
- **Restock Notes**: Optional text field for recording reasons/notes
- **Smart Validation**: Number inputs with minimum value of 0
- **Responsive Design**: Works on desktop and tablet screens

#### User Experience
- Modal opens instantly with current inventory pre-filled
- Changes are highlighted in real-time
- Reset button to revert all changes
- Loading states during API calls
- Error handling with user-friendly messages
- Success callback triggers product list refresh

### 2. Product List Integration
**File**: `/app/admin/products/page.tsx`

#### Restock Button
- Blue "Restock" button added to each product row
- Package icon for visual clarity
- Opens modal with selected product data

#### Stock Status Indicators
Enhanced inventory display with visual badges:
- **Out of Stock** (0 units): Red text + red badge
- **Low Stock** (1-5 units): Orange text + orange badge
- **Normal Stock** (6+ units): Standard text color

#### Modal State Management
```typescript
const [restockModal, setRestockModal] = useState<{
  isOpen: boolean
  product: Product | null
}>({ isOpen: false, product: null })
```

### 3. API Endpoint
**File**: `/app/api/products/[id]/restock/route.ts`

**Endpoint**: `PATCH /api/products/:id/restock`

#### Request Body
```typescript
{
  variants: [
    { id: "variant_id", inventory: 50 },
    { id: "variant_id_2", inventory: 25 }
  ],
  notes: "Quarterly restock from Supplier A" // optional
}
```

#### Response
Returns updated product with all variants:
```typescript
{
  id: "product_id",
  name: "Product Name",
  variants: [...], // Updated variants with new inventory
  category: {...},
  // ... other product fields
}
```

#### Validation
- ✅ Product existence check
- ✅ Variant ID validation (must belong to product)
- ✅ Inventory must be non-negative integer
- ✅ Transaction-based updates (all or nothing)

#### Error Handling
- 404: Product not found
- 400: Invalid variant IDs or validation errors
- 500: Database or server errors

## User Workflow

### Admin Restocking Process

1. **Navigate to Products**: Go to `/admin/products`
2. **Identify Product**: Find product needing restock (use stock indicators)
3. **Click Restock**: Click blue "Restock" button on product row
4. **Modal Opens**: See all variants with current inventory
5. **Update Inventory**: Enter new inventory values
   - See live change calculations (+/-)
   - View total change summary
6. **Add Notes (Optional)**: Record reason for restock
7. **Review Changes**: Verify all updates are correct
8. **Submit**: Click "Update Inventory" button
9. **Confirmation**: Modal closes, product list refreshes with new values

### Quick Actions
- **Reset**: Revert all changes to original values
- **Cancel**: Close modal without saving
- **Keyboard**: ESC key closes modal

## Technical Details

### Component Props

**RestockModal**:
```typescript
interface RestockModalProps {
  isOpen: boolean              // Controls modal visibility
  onClose: () => void          // Close handler
  productId: string            // Product ID for API call
  productName: string          // Display in modal header
  variants: Variant[]          // All product variants
  onSuccess: () => void        // Callback after successful update
}
```

**Variant Structure**:
```typescript
interface Variant {
  id: string
  sku: string
  size?: string
  color?: string
  inventory: number
}
```

### State Management

**Modal State**:
```typescript
const [inventoryUpdates, setInventoryUpdates] = useState<Record<string, number>>()
const [notes, setNotes] = useState('')
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')
```

**Change Detection**:
```typescript
const hasChanges = variants.some(
  (v) => inventoryUpdates[v.id] !== v.inventory
)
```

**Total Change Calculation**:
```typescript
const getTotalChange = () => {
  return variants.reduce((sum, v) => {
    const change = inventoryUpdates[v.id] - v.inventory
    return sum + change
  }, 0)
}
```

### API Integration

**Fetch Call**:
```typescript
const response = await fetch(`/api/products/${productId}/restock`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    variants: updates, 
    notes 
  }),
})
```

**Transaction-Based Updates**:
```typescript
await prisma.$transaction(
  validatedData.variants.map((update) =>
    prisma.productVariant.update({
      where: { id: update.id },
      data: { inventory: update.inventory },
    })
  )
)
```

## Visual Design

### Color Scheme

**Stock Status Colors**:
- Out of Stock: `bg-red-100 text-red-700` (badge), `text-red-600` (text)
- Low Stock: `bg-orange-100 text-orange-700` (badge), `text-orange-600` (text)
- Normal Stock: `bg-green-100 text-green-700` (badge)

**Change Indicators**:
- Positive (+): `bg-green-100 text-green-700`
- Negative (-): `bg-red-100 text-red-700`
- Total Summary: `bg-blue-50 border-blue-200`

**Modal Styling**:
- Header: Blue accent (`bg-blue-100`, `text-blue-600`)
- Backdrop: 50% black overlay
- Max Width: 3xl (48rem)
- Max Height: 90vh with scrolling

### Responsive Layout

**Variant Table Grid** (12 columns):
- Variant Info: 3 cols
- SKU: 2 cols  
- Current Inventory: 2 cols (center-aligned)
- New Inventory Input: 2 cols
- Change Indicator: 3 cols (right-aligned)

**Mobile Considerations**:
- Grid collapses gracefully on smaller screens
- Touch-friendly input sizes
- Scrollable table container

## Testing Checklist

### Functionality Tests
- [ ] Click Restock button opens modal
- [ ] Modal displays correct product name and variants
- [ ] Current inventory values pre-fill correctly
- [ ] Input validation (no negative numbers)
- [ ] Change calculations update in real-time
- [ ] Total change summary calculates correctly
- [ ] Reset button reverts all changes
- [ ] Cancel button closes modal without saving
- [ ] Submit disabled when no changes made
- [ ] Success callback refreshes product list
- [ ] Modal closes after successful update

### API Tests
- [ ] Valid request updates inventory correctly
- [ ] Transaction ensures all-or-nothing updates
- [ ] Invalid variant IDs return 400 error
- [ ] Non-existent product returns 404 error
- [ ] Negative inventory rejected
- [ ] Notes field saved properly (if implemented)

### UI/UX Tests
- [ ] Stock badges display correct colors
- [ ] Loading states show during API calls
- [ ] Error messages display clearly
- [ ] Modal closes on backdrop click
- [ ] ESC key closes modal
- [ ] Inputs are keyboard accessible
- [ ] Color contrast meets accessibility standards

### Edge Cases
- [ ] Product with single variant
- [ ] Product with 10+ variants (scrolling)
- [ ] All variants out of stock
- [ ] All variants at low stock
- [ ] Updating only one variant
- [ ] Updating all variants at once
- [ ] Very large inventory numbers (1000+)
- [ ] Setting inventory to 0 (out of stock)

## Performance Considerations

### Optimizations
- **Optimistic UI Updates**: Product list could update immediately
- **Debounced Inputs**: Prevent excessive re-renders on typing
- **Memoized Calculations**: Use `useMemo` for total change
- **Lazy Loading**: Modal component only renders when open

### Database
- **Transaction-Based**: All variant updates succeed or fail together
- **Indexed Queries**: variant.id is primary key (fast lookups)
- **Minimal Data Transfer**: Only updated variants sent to API

## Future Enhancements

### Potential Improvements
- [ ] **Restock History**: Log all inventory changes with timestamps
- [ ] **Bulk Restock**: Select multiple products at once
- [ ] **CSV Import**: Upload inventory updates from spreadsheet
- [ ] **Low Stock Notifications**: Email alerts for products below threshold
- [ ] **Restock Suggestions**: AI-powered recommendations based on sales
- [ ] **Supplier Integration**: Auto-generate purchase orders
- [ ] **Barcode Scanner**: Scan products to quickly access restock modal
- [ ] **Undo Feature**: Revert recent restocks
- [ ] **Restock Schedule**: Plan future inventory deliveries
- [ ] **Analytics Dashboard**: Track restock frequency and patterns

### Database Schema Addition
```prisma
model RestockLog {
  id          String   @id @default(cuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  userId      String?  // Track who made the change
  changes     String   // JSON of inventory updates
  notes       String?
  createdAt   DateTime @default(now())
}
```

## Troubleshooting

### Common Issues

**Modal doesn't open**:
- Check console for errors
- Verify RestockModal import
- Ensure product data is loaded

**Changes not saving**:
- Check network tab for API errors
- Verify API endpoint is accessible
- Check database connection

**Stock indicators wrong color**:
- Verify totalInventory calculation
- Check Tailwind CSS classes
- Clear browser cache

**Performance issues**:
- Limit products loaded per page
- Add pagination to product list
- Use React.memo for RestockModal

## Files Modified

### New Files
- [x] `/components/admin/RestockModal.tsx` - Main modal component
- [x] `/app/api/products/[id]/restock/route.ts` - API endpoint

### Modified Files
- [x] `/app/admin/products/page.tsx` - Added Restock button and modal integration

## Migration Required
No database migrations needed. Feature uses existing `inventory` field on `ProductVariant` model.

## Environment Variables
No new environment variables required.

## Dependencies
No new npm packages required. Uses existing:
- `lucide-react` for icons
- `@/components/ui/button` for buttons
- `prisma` for database

## Rollback Plan

If issues arise:

1. **Remove Restock Button**:
   - Delete lines adding Restock button in product list
   - Remove RestockModal import

2. **Delete API Endpoint**:
   - Remove `/app/api/products/[id]/restock/route.ts`

3. **Delete Modal Component**:
   - Remove `/components/admin/RestockModal.tsx`

No database changes to revert (no migrations added).

## Support

For questions or issues, refer to:
- Main documentation: `/docs/README.md`
- Admin implementation: `/ADMIN_IMPLEMENTATION.md`
- API documentation: Check `/app/api/products/` folder

## Notes

- Stock thresholds can be configured:
  - Low stock: Currently 1-5 units (adjust in code)
  - Out of stock: 0 units
- Notes field is optional but recommended for audit trails
- Consider adding RestockLog model for full history tracking
- Modal uses fixed positioning (z-index: 50)
- All inventory updates are atomic (transaction-based)
