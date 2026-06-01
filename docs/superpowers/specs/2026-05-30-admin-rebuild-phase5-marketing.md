# Phase 5: Marketing — Sub-spec

**Status:** Approved 2026-05-31. Hand off to writing-plans.

**Parent spec:** `docs/superpowers/specs/2026-05-30-admin-rebuild-design.md`
**Sibling specs:** Phase 2 (Dashboard), Phase 3 (Products & Drops), Phase 4 (Fulfillment) — all shipped.

## Goal

Build a new V2 `/admin/marketing` umbrella page that unifies the existing `/admin/promotions`, `/admin/popups`, `/admin/newsletter`, and `/admin/abandoned-carts` V1 pages into a single 5-tab Shopify-style experience, plus dedicated full-page editors for Newsletter Campaigns and Popups. Reuse all existing Prisma schema — zero migrations.

## Decisions table

| # | Decision | Choice |
|---|---|---|
| 1 | Tab structure | **B** — 5 flat tabs: `promotions` · `popups` · `subscribers` · `campaigns` · `carts` (splits V1's nested Newsletter into two top-level Marketing tabs) |
| 2a | KPI strip (4) | **C** — Active Promotions (warning when 0) · Popup conversions 7d · Subscribers total (with +N this week delta) · Carts to recover (warning when > 5). Cards click → matching tab. |
| 2b | Inspector pattern | **i** — Tab-appropriate Inspector everywhere. Promotions/Popups/Campaigns full edit; Subscribers read-only + unsubscribe/delete; Carts contents + 3 action buttons. |
| 3a | Campaign composer | **B** — Dedicated `/admin/marketing/campaigns/[id]/edit` page (not inline in tab) |
| 3b | Popup config UX | **A** — Polished config form in Inspector + dedicated `/admin/marketing/popups/[id]/edit` for full editing (visual builder deferred to Phase 5.5) |
| 3c | Promotion code generation | **A** — Single code field + "Suggest" button (manual entry wins). Bulk code generation deferred to Phase 5.5 (would need `PromotionCode[]` child table). |
| 4a | Bulk actions | **A (conservative)** — per-tab conservative sets (no bulk send-campaign, no bulk reassign) |
| 4b | Abandoned cart workflow | **ii** — Active Inspector workflow: Send Recovery Email, Generate One-Time Code, Mark Recovered. No auto-cron (deferred to Phase 5.5). |

## Architecture

### Routing + dispatcher pattern (mirrors Phase 2/3/4)

```
app/admin/marketing/page.tsx                              ← dispatcher (V1 stub vs V2 root)
app/admin/marketing/campaigns/[id]/edit/page.tsx          ← dispatcher (V1 redirect to /admin/newsletter vs V2 editor)
app/admin/marketing/popups/[id]/edit/page.tsx             ← dispatcher (V1 redirect to /admin/popups/[id] vs V2 editor)
components/admin/_v1/AdminMarketingV1.tsx                 ← stub linking to existing V1 pages
components/admin/dashboard/AdminMarketingV2.tsx           ← V2 root composition
components/admin/dashboard/MarketingTabPills.tsx          ← client wrapper around TabPills
```

V1 has no `/admin/marketing` page today (only individual sub-pages). The V1 stub renders a short message + 4 cards linking to the existing V1 pages (`/admin/promotions`, `/admin/popups`, `/admin/newsletter`, `/admin/abandoned-carts`) — leaves V1 pages intact, identical to Phase 4's `AdminOrderDetailV1` stub pattern.

The two editor pages dispatch independently: when the flag is off, redirect to the existing V1 page (`/admin/newsletter` for campaigns, `/admin/popups/[id]` for popups). When on, render the V2 editor.

### V2 root composition (`AdminMarketingV2`)

```
AdminLayout
├── MarketingTabPills (5 tabs)
├── MarketingKpiStrip (Suspense) — 4 StatCards, each <Link href={`?tab=${target}`}>
├── FilterBar placeholder (// TODO(phase-5.5))
└── Main content slot (Suspense per tab)
    ├── promotions   → <PromotionsListView />
    ├── popups       → <PopupsListView />
    ├── subscribers  → <SubscribersListView />
    ├── campaigns    → <CampaignsListView />
    └── carts        → <AbandonedCartsListView />
```

Each slot is its own async server-component function so Suspense boundaries stream independently (mirrors `AdminDashboardV2.tsx`, `AdminProductsV2.tsx`, `AdminFulfillmentV2.tsx`).

## Schema additions

**Zero new models.** All four V1 systems already have rich Prisma models:

- `Promotion` — 5 types (`PERCENTAGE | FIXED_AMOUNT | FREE_SHIPPING | BOGO | BUY_X_GET_Y`), nullable `code` (single string), usage tracking (`usedCount`, `maxUsesTotal`, `maxUsesPerCustomer`), date windows, `customerEmails` array for scoping, `excludeFromLoyalty` flag, `stackable` flag, `autoApply` flag, `productIds` / `collectionIds` for targeting
- `MarketingPopup` + `PopupVariant` + `PopupAnalytics` — full A/B variant support with daily impressions/clicks/dismissals/conversions per variant; trigger config (`DELAY | SCROLL | EXIT_INTENT | IMMEDIATE`); frequency (`ONCE_PER_SESSION | ONCE_PER_DAY | ONCE_EVER | ALWAYS`); template + position enums; optional `promotionId` FK
- `NewsletterSubscriber` + `NewsletterCampaign` + `NewsletterCampaignDelivery` — full lifecycle, `audienceFilter` as JSON, delivery audit trail with status `SENT | FAILED` and `providerMessageId`, campaign status `DRAFT | QUEUED | SENDING | SENT | FAILED`
- `AbandonedCart` — `recoveryEmailSent`, `recoveryEmailSentAt`, `recovered`, `recoveredAt`, `recoveryOrderId`, `discountCode` (existing field — populated when `generateCartRecoveryCode` action runs)

**Deferred to Phase 5.5:**
- `PromotionCode[]` child table for bulk-generated codes
- Auto-cron recovery emails on carts > 1h old
- UTM attribution per source
- Configurable popup visual builder
- Promotion-segment targeting (beyond customerEmails array)
- Email open/click tracking via Resend webhooks

## Components

### Shared list primitives — `components/admin/marketing/`

| File | Role |
|---|---|
| `MarketingListTable.tsx` | Generic desktop sticky-header table with CVA-driven per-tab column variants. Props include a `variant: 'promotions' \| 'popups' \| 'subscribers' \| 'campaigns' \| 'carts'` that maps to a column set. |
| `MarketingListCardMobile.tsx` | Generic mobile card with same `variant` prop. Long-press multi-select, swipe-left per-variant quick action. |

### Per-tab views — `components/admin/marketing/`

| File | Role |
|---|---|
| `PromotionsListView.tsx` | Orchestrator. Wires MarketingListTable (variant=promotions) + MarketingListCardMobile + PromotionInspector + PromotionBulkSheet |
| `PopupsListView.tsx` | Same orchestrator pattern with PopupInspector + PopupBulkSheet |
| `SubscribersListView.tsx` | Same with SubscriberInspector + SubscriberBulkSheet |
| `CampaignsListView.tsx` | Same with CampaignInspector (read-only summary + "Open editor →" link) + CampaignBulkSheet |
| `AbandonedCartsListView.tsx` | Same with AbandonedCartInspector + AbandonedCartBulkSheet |

### Inspectors — `components/admin/marketing/`

| File | Editable scope |
|---|---|
| `PromotionInspector.tsx` | name, type select, value, code + "Suggest" button, start/end dates, min purchase, max uses, isActive toggle, autoApply toggle |
| `PopupInspector.tsx` | name, template select, position select, trigger select + value, frequency, content textarea, isActive toggle. "Open editor →" link for A/B variants + scheduling |
| `SubscriberInspector.tsx` | Read-only profile (email, source, UTM, signup date, verified). Buttons: Unsubscribe, Delete (SUPER_ADMIN-gated, disabled otherwise) |
| `CampaignInspector.tsx` | Read-only summary (subject, audience size, sent count, status pill). Buttons: Duplicate, Delete (drafts only), "Open editor →" link |
| `AbandonedCartInspector.tsx` | Cart contents preview (items + total + age), customer info. 3 buttons: Send Recovery Email, Generate One-Time Code, Mark Recovered |

### BulkSheets — `components/admin/marketing/`

| File | Actions |
|---|---|
| `PromotionBulkSheet.tsx` | Activate · Deactivate · Delete |
| `PopupBulkSheet.tsx` | Activate · Deactivate · Duplicate · Delete |
| `SubscriberBulkSheet.tsx` | Unsubscribe · Export CSV · Delete (SUPER_ADMIN) |
| `CampaignBulkSheet.tsx` | Duplicate · Delete (drafts only) |
| `AbandonedCartBulkSheet.tsx` | Send Recovery Emails · Generate One-Time Codes · Mark Recovered |

### Full-page editors — `components/admin/marketing/editor/`

| File | Role |
|---|---|
| `CampaignEditor.tsx` | Composer for `/admin/marketing/campaigns/[id]/edit`. Fields: name, subject, preheader, hero image URL, CTA label/URL, markdown body, audience filter sidebar (activeOnly, source, signupDateFrom/To, customerMode), Save Draft, Queue Send, Send Test (with delivery log), Live Preview pane. Mirrors V1 structure but in V2 dark theme + tighter density. |
| `PopupEditor.tsx` | Full editor for `/admin/marketing/popups/[id]/edit`. Tabs/sections: Basics (name, template, position), Trigger (type + value), Frequency, Content (rich textarea per variant, including primary variant + A/B variants list with CRUD), Targeting (URL patterns, new vs returning), Schedule (start/end), Activation. Save/Activate buttons at footer. |

## Data layer — `lib/admin/marketing.ts` (new)

```ts
// KPI
loadMarketingKpis(): Promise<MarketingKpiData>
// { activePromotions, popupConversions7d, subscriberCount, subscriberDeltaPct, cartsToRecover }

// Tab loaders (return PaginatedResult<RowShape>)
loadPromotionsTab(filters?: PromotionsFilters): Promise<PaginatedResult<PromotionRow>>
loadPopupsTab(filters?: PopupsFilters): Promise<PaginatedResult<PopupRow>>
loadSubscribersTab(filters?: SubscribersFilters): Promise<PaginatedResult<SubscriberRow>>
loadCampaignsTab(filters?: CampaignsFilters): Promise<PaginatedResult<CampaignRow>>
loadAbandonedCartsTab(filters?: CartsFilters): Promise<PaginatedResult<AbandonedCartRow>>

// Detail loaders (Inspector + editor)
loadPromotionDetail(id: string): Promise<PromotionDetailFull | null>
loadPopupDetail(id: string): Promise<PopupDetailFull | null>            // includes variants + 7-day analytics rollup
loadSubscriberDetail(id: string): Promise<SubscriberDetailFull | null>
loadCampaignDetail(id: string): Promise<CampaignDetailFull | null>      // includes delivery rollup + audience preview
loadAbandonedCartDetail(id: string): Promise<AbandonedCartDetailFull | null>  // includes parsed cart items
```

Row shapes are lean (table-friendly); detail shapes include relations needed by Inspector + editor pages.

## Server actions — `app/admin/marketing/actions.ts` (new)

```ts
// Promotions
createPromotion(input: CreatePromotionInput): ActionResult<{ id: string }>
updatePromotion(id: string, input: UpdatePromotionInput): ActionResult
deletePromotion(id: string): ActionResult
togglePromotionActive(id: string): ActionResult
suggestPromotionCode(): ActionResult<{ code: string }>                  // generates random 8-char, returns suggestion without writing
checkPromotionCodeUnique(code: string): ActionResult<{ unique: boolean }>
bulkActivatePromotions(ids: string[]): BulkResult
bulkDeactivatePromotions(ids: string[]): BulkResult
bulkDeletePromotions(ids: string[]): BulkResult
getPromotionDetailForInspector(id: string): Promise<PromotionDetailFull | null>

// Popups
createPopup(input): ActionResult<{ id: string }>
updatePopup(id, input): ActionResult
deletePopup(id): ActionResult
togglePopupActive(id): ActionResult
duplicatePopup(id): ActionResult<{ id: string }>
updatePopupVariant(variantId, input): ActionResult
createPopupVariant(popupId, input): ActionResult<{ id: string }>
deletePopupVariant(variantId): ActionResult
bulkActivatePopups(ids): BulkResult
bulkDeactivatePopups(ids): BulkResult
bulkDuplicatePopups(ids): BulkResult
bulkDeletePopups(ids): BulkResult
getPopupDetailForInspector(id): Promise<PopupDetailFull | null>

// Subscribers
unsubscribeSubscriber(id): ActionResult
deleteSubscriber(id): ActionResult                                       // SUPER_ADMIN — PII deletion
bulkUnsubscribeSubscribers(ids): BulkResult
bulkExportSubscribersCsv(ids: string[]): ActionResult<{ csv: string }>
bulkDeleteSubscribers(ids): BulkResult                                   // SUPER_ADMIN
getSubscriberDetailForInspector(id): Promise<SubscriberDetailFull | null>

// Campaigns (wrap existing /api/admin/newsletter logic)
createCampaignDraft(input): ActionResult<{ id: string }>
updateCampaignDraft(id, input): ActionResult
duplicateCampaign(id): ActionResult<{ id: string }>
deleteCampaign(id): ActionResult                                         // drafts only
queueCampaignSend(id): ActionResult
sendCampaignTest(id, email): ActionResult
previewCampaignAudience(id): ActionResult<{ count: number }>
bulkDuplicateCampaigns(ids): BulkResult
bulkDeleteCampaigns(ids): BulkResult                                     // drafts only
getCampaignDetailForInspector(id): Promise<CampaignDetailFull | null>

// Abandoned Carts
sendCartRecoveryEmail(cartId): ActionResult                              // enqueues via existing email queue
generateCartRecoveryCode(cartId): ActionResult<{ code: string; promotionId: string }>
                                                                          // creates Promotion + writes code to AbandonedCart.discountCode
markCartRecovered(cartId): ActionResult                                  // manual override
bulkSendRecoveryEmails(cartIds): BulkResult
bulkGenerateRecoveryCodes(cartIds): BulkResult
bulkMarkCartsRecovered(cartIds): BulkResult
getAbandonedCartDetailForInspector(id): Promise<AbandonedCartDetailFull | null>
```

**Total: ~40 server actions across 5 domains** (counting `get*ForInspector` wrappers). `requireAdmin()` for everything; `requireAdminRole('SUPER_ADMIN')` for `deleteSubscriber` + bulk delete subscribers (PII-deletion gate). All mutations call `revalidatePath('/admin/marketing')` plus tab-specific paths where relevant (e.g., campaign editor saves call `revalidatePath('/admin/marketing/campaigns/[id]/edit')`).

`get*ForInspector` actions are server-action wrappers around their loaders — same pattern as Phase 3 PR #92 hotfix. Keeps Prisma out of the client bundle.

## Data flow

1. Page dispatcher reads `searchParams.tab` → renders `AdminMarketingV2` → SSR cascade kicks off 1 KPI Suspense + 1 main-tab Suspense.
2. Each tab slot awaits its specific loader; `revalidate = 60` on the page.
3. Mutations in Inspector / BulkSheet call server actions → `revalidatePath('/admin/marketing')`.
4. Campaign editor save → `updateCampaignDraft` → `revalidatePath` on both the list tab AND the editor page.
5. Generate cart recovery code: creates a `Promotion` in a `$transaction` with `customerEmails: [cart.customerEmail]`, writes the code to `AbandonedCart.discountCode`, optionally enqueues an email with the code embedded.
6. Send-test path on campaigns: wraps the existing `/api/admin/newsletter/campaigns/[id]/send-test` route logic in `sendCampaignTest` server action — no logic duplication.

## Error handling

- Server actions return `ActionResult<T>` / `BulkResult` (same shapes as Phase 3/4).
- Email queue failures: action returns `{ ok: true, queuedId }` (queue handles retries); only fails if the enqueue write itself fails.
- Code generation idempotency: `suggestPromotionCode` returns a suggestion WITHOUT writing; `createPromotion` (and `generateCartRecoveryCode`) is the unique-constraint check site — retry-on-collision up to 5 attempts before surfacing error.
- `bulkExportSubscribersCsv` returns the CSV blob string in the `ActionResult.data`; client triggers download via `Blob + a.download` (Phase 4 BulkExportCsv precedent).
- Stripe-style: no Stripe touch in Marketing. Email sends are the only external dependency, all routed through the existing durable EmailQueue.

## Testing

Per-component test files using Vitest + @testing-library/react (Phase 1 harness). Target ~150–200 tests across the phase.

- 1 KPI loader + 5 tab loaders + 5 detail loaders test files (one per tab, with mocked Prisma)
- 1 actions test file (covers all ~38 actions with mocked Prisma + mocked EmailQueue.enqueueEmail)
- 5 ListView orchestrator test files
- 5 Inspector test files
- 5 BulkSheet test files
- 2 editor test files (CampaignEditor + PopupEditor)
- 3 dispatcher tests (list page + 2 editor pages) — `vi.resetModules()` + dynamic import pattern
- 1 `AdminMarketingV2` smoke test
- 1 RMA-counter-style concurrency test for `suggestPromotionCode` (verifies collision retry under parallel calls)

## Wave plan (drives the implementation plan)

| Wave | Tasks | Parallel? | Notes |
|---|---|---|---|
| W1 | Data layer (`lib/admin/marketing.ts`) + Server actions (`actions.ts`) | 2 parallel | No schema, no migration — no W0 foundation needed |
| W2 | `MarketingListTable` (generic, CVA variants) + `MarketingListCardMobile` | 2 parallel | |
| W3 | 5 Inspectors (Promotion, Popup, Subscriber, Campaign, AbandonedCart) | 5 parallel | |
| W4 | 5 BulkSheets | 5 parallel | |
| W5 | 5 ListViews (orchestrators) | 5 parallel | Depend on W2 + W3 + W4 |
| W6 | `AdminMarketingV2` root + page dispatcher (opus) | Sequential | Critical integration |
| W7 | CampaignEditor + PopupEditor + their dispatcher pages | 3 parallel | Independent editors |
| W8 | Verification + QA doc | Sequential | Final |

~22–25 tasks total. Comparable to Phase 4 (23 tasks) — smaller because no schema work and no detail-page sprawl, but Waves 3–5 each have 5 parallel siblings.

## Constraints (per master spec)

- Dark futurist + Linear Calm density.
- Mobile co-equal — long-press multi-select, swipe-left row actions, BottomActionSheet, full-screen Inspector on mobile.
- Per-widget Suspense boundaries with `revalidate = 60`.
- Branch naming `wave5p5/task-N-<short-name>`; worktree isolation on every Agent dispatch.
- Per-fix PRs — one focused commit per PR; controller batches per wave.
- Each subagent reads this spec + the plan for its specific task.
- No `dark:` Tailwind modifiers (PR #93 precedent).
- No Prisma in the client bundle (PR #92 precedent).
- `PaginatedResult` shape is `{ items, total, page, pageSize }` — destructure `.items` (Phase 3/4 precedent).
- Vitest 4.1.7: 1-arg `vi.fn<T>()` generics.

## Out of scope (deferred to Phase 5.5+)

- Bulk promotion code generation (`PromotionCode[]` child table).
- Auto-cron recovery emails on carts > 1h.
- UTM attribution beyond what's already stored on `NewsletterSubscriber`.
- Visual popup builder (drag-drop content blocks).
- Promotion segmentation beyond `customerEmails` array (real audience targeting).
- Email open/click tracking via Resend webhooks.
- Configurable return-window per popup template.
- Loyalty offer crossover tab (Phase 7 owns the cross-page integration).
