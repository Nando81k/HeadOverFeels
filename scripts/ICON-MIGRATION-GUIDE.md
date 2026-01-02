# Icon Migration Guide: Lucide React → Phosphor Icons

## Overview

This guide explains how to migrate all Lucide React icons to Phosphor Icons across the Head Over Feels codebase.

## Quick Start

### Automated Migration (Recommended)

```bash
# 1. Preview changes without modifying files
node scripts/migrate-icons-to-phosphor.js --dry-run

# 2. Review the output, then run actual migration
node scripts/migrate-icons-to-phosphor.js

# 3. Verify the changes
npm run build
```

### Manual Migration (For Individual Files)

If you need to migrate specific files manually, follow this pattern:

#### Step 1: Update Import Statement

**Client Components** (files with `'use client'`):
```tsx
// Before
import { Search, ShoppingCart, Heart } from 'lucide-react'

// After
import { MagnifyingGlass, ShoppingCart, Heart } from '@phosphor-icons/react'
```

**Server Components** (no `'use client'` directive):
```tsx
// Before
import { Package, Truck, Shield } from 'lucide-react'

// After
import { Package, Truck, Shield } from '@phosphor-icons/react/dist/ssr'
```

#### Step 2: Update Icon Usage in JSX

**Size Conversions**:
```tsx
// Before
<Search className="w-5 h-5" />

// After
<MagnifyingGlass size={20} weight="bold" />
```

**With Additional Classes**:
```tsx
// Before
<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />

// After
<ArrowRight size={16} weight="bold" className="group-hover:translate-x-1 transition-transform" />
```

## Icon Mapping Reference

### Navigation & UI
- `Search` → `MagnifyingGlass`
- `Menu` → `List`
- `Home` → `House`
- `ChevronLeft` → `CaretLeft`
- `ChevronRight` → `CaretRight`
- `ChevronDown` → `CaretDown`
- `ChevronUp` → `CaretUp`

### Shopping & Commerce
- `ShoppingBag` → `Bag`
- `ShoppingCart` → `ShoppingCart` (same name)
- `Package` → `Package` (same name)
- `Trash2` → `Trash`

### Actions & Status
- `Plus` → `Plus` (same name)
- `Minus` → `Minus` (same name)
- `Check` → `Check` (same name)
- `Loader2` → `CircleNotch`
- `RotateCcw` → `ArrowClockwise`
- `RefreshCw` → `ArrowClockwise`

### Feedback & Alerts
- `AlertCircle` → `Warning`
- `AlertTriangle` → `Warning`
- `CheckCircle2` → `CheckCircle`

### Communication
- `Mail` → `EnvelopeSimple`
- `MessageCircle` → `ChatCircle`
- `Send` → `PaperPlaneTilt`
- `Bell` → `Bell` (same name)

### User & Account
- `User` → `User` (same name)
- `LogIn` → `SignIn`
- `LogOut` → `SignOut`

### Business & Commerce
- `DollarSign` → `CurrencyDollar`
- `TrendingUp` → `TrendingUp` (same name)
- `TrendingDown` → `TrendingDown` (same name)
- `BarChart3` → `ChartBar`

### UI Elements
- `SlidersHorizontal` → `Faders`
- `Filter` → `Funnel`
- `Settings` → `Gear`
- `Eye` → `Eye` (same name)
- `EyeOff` → `EyeSlash`
- `Crown` → `Crown` (same name)
- `Award` → `Medal`
- `Sparkles` → `Sparkles` (same name)

## Size Conversion Chart

| Tailwind Classes | Phosphor Size |
|-----------------|---------------|
| `w-3 h-3`       | `size={12}`   |
| `w-4 h-4`       | `size={16}`   |
| `w-5 h-5`       | `size={20}`   |
| `w-6 h-6`       | `size={24}`   |
| `w-8 h-8`       | `size={32}`   |
| `w-10 h-10`     | `size={40}`   |
| `w-12 h-12`     | `size={48}`   |
| `w-16 h-16`     | `size={64}`   |
| `w-20 h-20`     | `size={80}`   |
| `w-24 h-24`     | `size={96}`   |

## Weight Conversions

| Lucide | Phosphor |
|--------|----------|
| `strokeWidth={1}` | `weight="thin"` |
| `strokeWidth={1.5}` | `weight="light"` |
| `strokeWidth={2}` | `weight="regular"` |
| No strokeWidth | `weight="bold"` (default) |
| Decorative icons | `weight="fill"` or `weight="duotone"` |

## Special Cases

### Exception: WishlistIcon
**DO NOT migrate** the `WishlistIcon` component - it should remain unchanged as per project requirements.

### Spinner Icons
```tsx
// Before
<Loader2 className="w-5 h-5 animate-spin" />

// After
<CircleNotch size={20} weight="bold" className="animate-spin" />
```

### Icons with Hover Effects
Preserve all additional className values:
```tsx
// Before
<Heart className="w-5 h-5 hover:text-red-500 transition-colors" />

// After
<Heart size={20} weight="bold" className="hover:text-red-500 transition-colors" />
```

## Verification Steps

After migration:

1. **Build Check**:
   ```bash
   npm run build
   ```

2. **Search for Remaining Lucide Imports**:
   ```bash
   grep -r "from 'lucide-react'" app/ components/
   ```

3. **Visual Testing**:
   - Test navigation (desktop & mobile)
   - Test cart and checkout flow
   - Test product pages
   - Test admin dashboard
   - Test search and filters

4. **TypeScript Errors**:
   Check VS Code for any TypeScript errors in migrated files

## Troubleshooting

### Icon Not Rendering
- Check if import path is correct (client vs server component)
- Verify icon name mapping is correct
- Check console for errors

### TypeScript Errors
- Ensure `@phosphor-icons/react` is installed: `npm install @phosphor-icons/react`
- Restart TypeScript server in VS Code: Cmd+Shift+P → "Restart TypeScript Server"

### Size Issues
- Phosphor uses numeric pixels, not Tailwind classes
- Adjust `size={X}` prop to desired pixel value
- Keep other className values for positioning/colors

## Migration Script Details

The automated script (`migrate-icons-to-phosphor.js`):

✅ **What it does**:
- Finds all files importing from 'lucide-react'
- Converts imports to Phosphor paths (client vs server)
- Replaces icon names using mapping table
- Converts className sizes to size prop
- Adds default weight="bold" to icons
- Preserves other className values
- Skips files containing WishlistIcon

⚠️ **What it doesn't do**:
- Handle complex conditional icon rendering
- Optimize weight values (all set to "bold" by default)
- Handle icons passed as props/variables
- Migrate docs/markdown files

## Post-Migration Cleanup

After successful migration:

```bash
# Optional: Remove old lucide-react package
npm uninstall lucide-react

# Optional: Remove material-symbols if not used
npm uninstall material-symbols
```

## Need Help?

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review completed files for examples (Navigation.tsx, app/page.tsx)
3. Use `--dry-run` flag to preview changes before applying
4. Manually migrate complex cases that the script can't handle

## Files Successfully Migrated (Manual)

✅ Completed:
- components/layout/Navigation.tsx
- app/page.tsx
- app/cart/page.tsx
- components/cart/CartItem.tsx
- components/home/NewArrivalsCarousel.tsx
- components/home/BestSellersCarousel.tsx
- components/home/CategoryCarousel.tsx
- components/home/FeaturedCollectionsCarousel.tsx
- components/collections/CollectionCarousel.tsx
- components/drops/DropHeroSection.tsx
- app/checkout/page.tsx
- components/checkout/PaymentForm.tsx
- app/order/confirmation/page.tsx
- app/products/page.tsx

Use these as reference examples for manual migrations.
