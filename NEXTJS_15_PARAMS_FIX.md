# Next.js 15+ Dynamic Route Params Fix

## Issue
When upgrading to Next.js 15+, dynamic route params in Server Components changed from synchronous objects to Promises. This causes runtime errors like:

```
Argument `where` of type CustomerWhereUniqueInput needs at least one of `id` or `email` arguments.
where: { id: undefined }
```

## Root Cause
In Next.js 15+, the `params` prop in Server Components is now a **Promise** that must be awaited.

## Solution

### Before (Next.js 14 and earlier)
```typescript
interface PageProps {
  params: {
    id: string;
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = params;  // ❌ id is undefined in Next.js 15+
  // ...
}
```

### After (Next.js 15+)
```typescript
interface PageProps {
  params: Promise<{    // 👈 params is now a Promise
    id: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;  // ✅ Await the Promise
  // ...
}
```

## Files Fixed

### Server Components (await params)
- ✅ `/app/admin/customers/[id]/page.tsx` - **FIXED**

### Client Components (no change needed - use `useParams()`)
- ✅ `/app/products/[slug]/page.tsx` - Already uses `use(params)` (React 19)
- ✅ `/app/admin/products/[id]/page.tsx` - Uses `useParams()` hook
- ✅ `/app/admin/orders/[id]/page.tsx` - Uses `useParams()` hook  
- ✅ `/app/admin/collections/[id]/page.tsx` - Uses `useParams()` hook
- ✅ `/app/orders/[id]/track/page.tsx` - Uses `useParams()` hook

## Pattern Guide

### For Server Components
```typescript
// Always await params in async Server Components
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

### For Client Components (React 19+)
```typescript
'use client'
import { use } from 'react'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);  // React 19's use() hook
}
```

### For Client Components (Traditional)
```typescript
'use client'
import { useParams } from 'next/navigation'

export default function Page() {
  const params = useParams();
  const id = params.id as string;
}
```

## Verification

**Before Fix:**
```
Runtime Error: Invalid prisma.customer.findUnique() invocation
where: { id: undefined }
```

**After Fix:**
```
✅ Page loads successfully
✅ Customer data fetched correctly
✅ All CRM features working
```

## Additional Resources
- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [Dynamic Routes in App Router](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [React 19 `use()` Hook](https://react.dev/reference/react/use)

---

**Status**: ✅ **RESOLVED**  
**Fixed**: October 25, 2025  
**Impact**: Customer CRM detail page now works correctly
