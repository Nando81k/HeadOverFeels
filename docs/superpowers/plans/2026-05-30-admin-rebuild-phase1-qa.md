# Admin Rebuild Phase 1 — QA Findings

Generated: 2026-05-30
Branch: wave3p1/task-21-22-verification
Spec: docs/superpowers/plans/2026-05-30-admin-rebuild-phase1.md

---

## Task 21: Verification results

### Step 1: Test suite — `npm run test:run`

**Result: 7 test files FAILED, 64 passed. 22 tests failed out of 251 total.**

All failures are pre-existing and unrelated to Phase 1 work (no admin-v2
shell tests exist yet because the spec's 18 new test files have not been
written in this branch — they are the subject of subsequent tasks).

Failing test files (pre-existing):

| File | Failed / Total | Root cause |
|------|---------------|------------|
| `tests/unit/collections-page.test.tsx` | 4 / 4 | UI query mismatches (pre-existing) |
| `tests/unit/fulfillment-case-drawer.test.tsx` | 2 / 5 | Element not found (pre-existing) |
| `tests/unit/fulfillment-queue-grid.test.tsx` | 2 / 2 | Multiple elements found (pre-existing) |
| `tests/unit/navigation-dropdown.test.tsx` | 2 / 10 | Element not found (pre-existing) |
| `tests/unit/navigation-mobile-menu-cart-widget.test.tsx` | 2 / 3 | waitFor timeout (pre-existing) |
| `tests/unit/product-page-client.test.tsx` | 4 / 7 | Element not found (pre-existing) |
| `tests/unit/profile-page-tabs.test.tsx` | 6 / 6 | Element not found (pre-existing) |

None of the failing tests touch admin-v2 components, AdminLayout, AdminLayoutV1,
or any Phase 1 deliverable.

### Step 2: Type-check — `npx tsc --noEmit`

**Result: 2 errors — pre-existing, unrelated to Phase 1.**

| File | Error |
|------|-------|
| `app/api/admin/admin-audit-logs/route.ts:78` | TS18047: `log.admin` is possibly `null` |
| `lib/seed/historical/reset.ts:75` | TS2322: `AdminRole` type incompatibility (`'MERCHANDISER'` not assignable) |

Neither error is in any file created or modified by Phase 1.

### Step 3: ESLint on changed files

**Result: 1 error, 2 warnings — evaluated against available Phase 1 files.**

Note: `components/admin/v2/` does not exist in this branch (Phase 1 shell
components have not been written yet). ESLint ran on `components/ui` and
`components/admin/AdminLayout.tsx`.

| File | Severity | Rule | Note |
|------|----------|------|------|
| `components/admin/AdminLayout.tsx:5` | warning | `@typescript-eslint/no-unused-vars` | `AdminReggie` imported but unused |
| `components/ui/EmptyState.tsx:4` | **error** | `@typescript-eslint/no-explicit-any` | Pre-existing `any` type |
| `components/ui/InlineEdit.tsx:73` | warning | `@typescript-eslint/no-unused-vars` | `error` var unused |

The `EmptyState.tsx` error is pre-existing and not introduced by Phase 1.
The `AdminLayout.tsx` warning is benign (AdminReggie is a future consumer).

### Step 4: Build — `npm run build`

**Result: BUILD FAILED — pre-existing TypeScript error, unrelated to Phase 1.**

Next.js TypeScript compilation aborted at:

```
./app/api/admin/admin-audit-logs/route.ts:78
Type error: 'log.admin' is possibly 'null'.
```

This is the same pre-existing error surfaced by `tsc --noEmit`. The spec notes
that a pre-existing admin page failure is acceptable; this is that failure.
Phase 1 changes do not touch `app/api/admin/admin-audit-logs/route.ts`.

### Step 5: Manual QA — flag OFF (`NEXT_PUBLIC_ADMIN_V2_ENABLED=false`)

**Status: HUMAN VERIFICATION REQUIRED (headless environment — browser unavailable)**

| Item | Status |
|------|--------|
| `/admin` loads — old admin still works | TBD by human |
| `/admin/products` loads — old admin still works | TBD by human |
| `/admin/fulfillment` loads — old admin still works | TBD by human |
| `/admin/customers` loads — old admin still works | TBD by human |
| No console errors in browser devtools | TBD by human |
| Existing functionality unchanged | TBD by human |

Run with: `NEXT_PUBLIC_ADMIN_V2_ENABLED=false npm run dev`

### Step 6: Manual QA — flag ON (`NEXT_PUBLIC_ADMIN_V2_ENABLED=true`)

**Status: HUMAN VERIFICATION REQUIRED (headless environment — browser unavailable)**

Run with: `NEXT_PUBLIC_ADMIN_V2_ENABLED=true npm run dev`

#### Desktop (1280px+)

| Item | Status |
|------|--------|
| New sidebar appears with 8 destinations | TBD by human |
| Header shows title/subtitle | TBD by human |
| Active nav item glows red | TBD by human |
| No console errors | TBD by human |

#### Tablet (~768px)

| Item | Status |
|------|--------|
| Sidebar collapses to icon rail — **KNOWN LIMITATION**: Phase 1 hides desktop sidebar below `lg:` and shows mobile nav; tablet handling is a Phase 1 known gap, documented for Phase 2 follow-up | TBD by human |

#### Mobile (375px)

| Item | Status |
|------|--------|
| Bottom nav shows 4 tabs + More | TBD by human |
| Top app bar shows title | TBD by human |
| Tapping More opens the bottom sheet with Dashboard, Customers, Loyalty, Support | TBD by human |
| No console errors | TBD by human |

#### Shared (both viewports, flag ON)

| Item | Status |
|------|--------|
| Page interior content from old pages renders inside the new shell | TBD by human |
| Cmd+K opens command palette | TBD by human |
| New nav commands present in command palette | TBD by human |

### Step 7: Known limitations / follow-up items

- Tablet (~768px) sidebar icon-rail is not implemented in Phase 1. Phase 1 uses
  `lg:` breakpoint to swap desktop sidebar for mobile bottom nav; the tablet
  experience falls through to the mobile nav. Document for Phase 2.
- The 18 new test files described in the spec (covering each primitive and the
  dispatcher) are the deliverable of Tasks 2–19 which precede this verification.
  If they are missing from the branch, they need to be created in a prior task.

---

## Retirement readiness audit

Components flagged for retirement in spec Section 4.D. Retirement happens
in the page-rebuild phases (3–9) when each consumer migrates to the new
primitives, NOT in Phase 1.

| Component | Usage count | Files | Phase to retire in |
|-----------|-------------|-------|--------------------|
| DashboardCard | 4 | `app/admin/page.tsx`, `app/admin/live-feed/page.tsx`, `app/admin/sales/page.tsx`, `app/admin/expenses/page.tsx` | Phase 2 (Dashboard rebuild) |
| DashboardStats | 0 | _(no consumers found)_ | Phase 2 |
| DataTable | 0 | _(no consumers found)_ | Phases 3, 7, 8, 9 (pages with tables) |
| FilterBar | 0 | _(no consumers found)_ | Phases 3, 7, 8 |
| PageHeader | 0 | _(no consumers found)_ | All page-rebuild phases |
| *MobileCard variants | 1 | `app/admin/products/page.tsx` (ProductMobileCard) | Page-rebuild phases by domain |

Note: Phase 1 does NOT delete any of these. They remain in use by V1
pages and during the transition. Each subsequent phase deletes its
specific consumer of these components.

Grep commands run (Task 22 Step 1):

```bash
grep -rl "from '@/components/admin/DashboardCard'" app components    # 4 files
grep -rl "from '@/components/admin/DashboardStats'" app components   # 0 files
grep -rl "from '@/components/admin/DataTable'" app components        # 0 files
grep -rl "from '@/components/admin/FilterBar'" app components        # 0 files
grep -rl "from '@/components/admin/PageHeader'" app components       # 0 files
grep -rl "from '@/components/admin/.*MobileCard'" app components     # 1 file
```

CustomerMobileCard and OrderMobileCard exist in `components/admin/` but have
no import consumers in `app/` or `components/` at this time (they may be used
via different import paths or are currently unused).

Audit run: 2026-05-30. Re-run these greps at the start of each page-rebuild
phase to confirm the component is still orphaned before deleting it.
