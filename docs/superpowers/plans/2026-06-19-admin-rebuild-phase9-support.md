# Phase 9: Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a V2 admin Support experience (ticket list + ticket detail + live chat over SSE + inline return/refund + canned responses + SLA/bulk/agent-KPIs), gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED`, with one additive schema migration (new `CannedResponse` model + `SupportTicket.firstRespondedAt`), preserving all customer-facing support/chat APIs.

**Architecture:** Mirrors the Phase 4–8 V2 pattern: feature-flag dispatchers replace the three canonical `/admin/support*` routes; V1 pages relocate verbatim to `/admin/support-v1/*`; a new `lib/admin/support.ts` data layer + `app/admin/support/actions.ts` server actions back V2 server components that stream widgets via Suspense. Live chat upgrades the admin transport to Server-Sent Events backed by server-side DB polling (no Redis/websockets), with the existing polling endpoint retained as fallback and for the customer widget.

**Tech Stack:** Next.js 16 App Router, React 19 (RSC + Server Actions + Suspense + SSE route handlers), TypeScript strict, Prisma 6 + Neon, Tailwind v4 (`@theme`, direct dark colors), Framer Motion, Phosphor icons, Sonner toasts (`lib/toast.ts`), class-variance-authority, Vitest 4.1.7 + @testing-library/react + jsdom.

**Design spec:** `docs/superpowers/specs/2026-06-19-admin-rebuild-phase9-support.md`

---

## Cross-cutting agent notes (read once, applies to every task)

Hard-won lessons from Phases 3–8. Re-read whenever starting a task:

1. **This repo uses npm, NOT pnpm.** Run `npx vitest run <path>` for a single test file and `npx tsc --noEmit` for typecheck. NEVER run pnpm (it creates a spurious `pnpm-lock.yaml`). Worktrees have no `node_modules` — symlink it first: `ln -s <repo-root>/node_modules node_modules`.
2. **No Prisma value-imports in client bundles.** Use `import type` for any `lib/admin/support` types in `'use client'` files. Client mutations call server actions (value-importing `@/app/admin/support/actions` is fine — those are server functions). PR #92-era precedent.
3. **No `dark:` Tailwind modifiers.** V2 admin is always-dark; direct colors only: `bg-neutral-900/60`, `border-white/8`, `text-white/50`, `text-white/30`.
4. **`PaginatedResult` shape is `{ items, total, page, pageSize }`** — destructure `.items` (NOT `.rows`). All paginated loaders return this shape.
5. **Vitest 4.1.7 generics: use 1-arg `vi.fn<T>()`** (or zero-arg with `mockResolvedValue`). The two-arg `vi.fn<[Args], Return>()` form triggers TS2558.
6. **`requireAdmin()` no-arg overload** in server actions returns the admin userId string. `requireAdminRole('SUPER_ADMIN')` ONLY for: `issueRefund`, `bulkCloseTickets`. Every other Phase 9 mutation accepts plain ADMIN.
7. **Adopt verified prop shapes from merged earlier waves.** Plan prose is approximate; read the merged loader/action/component signatures directly and adopt verbatim. The Shared Contracts section below is the source of truth for types — if a merged file ever disagrees with prose elsewhere, the merged file wins and the Contracts section is the intended shape.
8. **Inspector-before-panel ordering (Phase 8 lesson).** Vite's static import-analysis resolves a `'use client'` component's imports BEFORE `vi.mock` can intercept. A panel that statically imports an inspector cannot have a passing test until that inspector exists on disk. Wave ordering reflects this: inspectors (W5) and the canned-response picker merge before the reply composer and detail composition that embed them.
9. **Preserve customer-facing APIs.** Do NOT delete or modify `app/api/support/tickets/**` or `app/api/chat/live/**` — the customer widget + ticket creation depend on them. Phase 9 adds admin server actions + an admin SSE endpoint alongside them.
10. **Admin identity mapping.** `SupportTicket.assignedToId` → `AdminUser.id`, but the session yields a Customer `userId`. Task 2/3 must resolve the current agent's `AdminUser` id (confirm the linkage field — likely `AdminUser.customerId` or an email match — by reading `prisma/schema.prisma` for the `AdminUser` model and an existing admin route that already does this lookup). The "Mine" tab + assignment default depend on it. Document the confirmed field in Task 2.
11. **All `ActionResult` returns** use `{ ok: true; data? } | { ok: false; error: string }` (Phase 8 shape). All mutations `revalidatePath('/admin/support')`, `revalidatePath('/admin/support/tickets')`, and (for ticket-scoped ops) `revalidatePath('/admin/support/tickets/${ticketId}')`.

---

## Wave summary

| Wave | Tasks | Parallel? | Model | Depends on |
|------|-------|-----------|-------|------------|
| W1  | 1 | sequential | sonnet | none |
| W2  | 2, 3 | 2 parallel | sonnet | W1 merged |
| W3  | 4, 5, 6 | 3 parallel | sonnet | W2 merged |
| W4  | 7, 8, 9, 10, 11 | 5 parallel | sonnet | W2 merged |
| W5  | 12, 13, 14, 15, 16, 17 | 6 parallel | sonnet | W2 merged |
| W6  | 18, 19, 20, 21 | 18 first, then 19-21 parallel | sonnet | W2 merged |
| W7  | 22, 23, 24, 25, 26, 27 | sequential | **opus** | W3–W6 merged |
| W8  | 28 | sequential | sonnet | W7 merged |

Total: **28 tasks** across **8 waves**. Branch naming: `wave9p9/task-N-<short-name>`. Each wave-group merges independently. Within a wave, all tasks create disjoint files (verified in the File Structure map).

---

## File Structure

**Created:**
- `prisma/migrations/<ts>_support_canned_and_first_response/migration.sql` — schema migration (T1)
- `lib/admin/support.ts` — data layer (T2)
- `app/admin/support/actions.ts` — server actions (T3)
- `components/admin/support/SupportTicketsListTable.tsx` (T4)
- `components/admin/support/SupportTicketsListCardMobile.tsx` (T5)
- `components/admin/support/SupportBulkSheet.tsx` (T6)
- `components/admin/support/detail/TicketHeader.tsx` (T7)
- `components/admin/support/detail/TicketMessageThread.tsx` (T8)
- `components/admin/support/detail/TicketCustomerContext.tsx` (T9)
- `components/admin/support/detail/TicketReturnRefundPanel.tsx` + `...PanelClient.tsx` (T10)
- `components/admin/support/detail/TicketActivityTimeline.tsx` (T11)
- `components/admin/support/inspectors/AssignAgentInspector.tsx` (T12)
- `components/admin/support/inspectors/StatusChangeInspector.tsx` (T13)
- `components/admin/support/inspectors/ReturnDecisionInspector.tsx` (T14)
- `components/admin/support/inspectors/RefundInspector.tsx` (T15)
- `components/admin/support/inspectors/CannedResponseManagerInspector.tsx` (T16)
- `components/admin/support/inspectors/CannedResponsePicker.tsx` (T17)
- `app/api/admin/support/chat/[sessionId]/stream/route.ts` + `lib/admin/support-chat-stream.ts` hook helper + `components/admin/support/chat/useSupportChatStream.ts` (T18)
- `components/admin/support/chat/AdminChatQueueV2.tsx` (T19)
- `components/admin/support/chat/AdminChatPanelV2.tsx` (T20)
- `components/admin/support/chat/AgentAvailabilityToggle.tsx` (T21)
- `components/admin/support/SupportTicketsListClient.tsx` (T22)
- `components/admin/support/detail/TicketReplyComposer.tsx` (T23)
- `components/admin/dashboard/AdminSupportTicketsV2.tsx` + `SupportTabPills.tsx` + `SupportRangePills.tsx` (T24)
- `components/admin/dashboard/AdminTicketDetailV2.tsx` (T25)
- `components/admin/dashboard/AdminSupportV2.tsx` (dashboard home) (T26)
- `components/admin/_v1/AdminSupportV1*.tsx` (relocations) + `app/admin/support-v1/**` re-exposers + 3 dispatchers (T27)
- `docs/superpowers/plans/2026-06-19-admin-rebuild-phase9-qa.md` (T28)

**Modified:**
- `prisma/schema.prisma` (T1)
- `app/admin/support/page.tsx`, `app/admin/support/tickets/page.tsx`, `app/admin/support/tickets/[id]/page.tsx` → dispatchers (T27)
- `components/admin/customers/detail/CustomerSupportTicketsPanel.tsx` → cross-link fix (T27)

---

## Shared Contracts (source of truth for all tasks)

> Every type, signature, and prop interface below is the canonical shape. Tasks reference these by name. If you implement a task, copy the relevant definitions verbatim. `lib/admin/support.ts` (T2) exports all the data types + loaders; `app/admin/support/actions.ts` (T3) exports all actions.

### Common (defined locally in `lib/admin/support.ts`)

```ts
export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'
export const TIME_RANGES: TimeRange[] = ['today', '7d', '30d', '90d', 'year']
export interface RangeBounds { start: Date; end: Date; previousStart: Date; previousEnd: Date }
export function getRangeBounds(range: TimeRange, ref?: Date): RangeBounds
export interface TrendData { direction: 'up' | 'down' | 'flat'; text: string }
export function buildTrend(current: number, previous: number): TrendData
export interface PaginatedResult<T> { items: T[]; total: number; page: number; pageSize: number }

export const SUPPORT_TABS = ['inbox', 'mine', 'open', 'escalated', 'resolved'] as const
export type SupportTab = (typeof SUPPORT_TABS)[number]
export function isSupportTab(v: unknown): v is SupportTab
export function isTimeRange(v: unknown): v is TimeRange

export const FIRST_RESPONSE_SLA_HOURS = 4
export const RESOLUTION_SLA_HOURS = 48
```

### Row + KPI shapes

```ts
import type { SupportTicketType, SupportTicketStatus, SupportPriority } from '@prisma/client'

export interface TicketRow {
  id: string
  ticketNumber: string
  subject: string
  type: SupportTicketType
  status: SupportTicketStatus
  priority: SupportPriority
  customerName: string
  customerEmail: string
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  firstRespondedAt: Date | null
  ageHours: number
  isOverdue: boolean
}

export interface SupportKpiData {
  openCount: number
  unassignedCount: number
  avgFirstResponseHours: number
  avgFirstResponseTrend: TrendData
  avgResolutionHours: number
  resolvedInRange: number
  resolvedInRangeTrend: TrendData
}

export interface SupportFilters {
  search?: string
  type?: SupportTicketType
  priority?: SupportPriority
  page?: number
  pageSize?: number
}
```

### Detail shapes

```ts
export interface TicketHeaderData {
  id: string
  ticketNumber: string
  subject: string
  type: SupportTicketType
  status: SupportTicketStatus
  priority: SupportPriority
  customerId: string | null
  customerName: string
  customerEmail: string
  orderId: string | null
  orderNumber: string | null
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  firstRespondedAt: Date | null
  resolvedAt: Date | null
  ageHours: number
  isOverdue: boolean
  returnRequested: boolean
  returnApproved: boolean | null
  refundAmount: number | null
}

export interface TicketMessageRow {
  id: string
  body: string
  isInternal: boolean
  senderType: string          // "customer" | "admin"
  senderName: string
  attachments: string[]       // parsed from the JSON string column
  createdAt: Date
}

export interface TicketCustomerContextData {
  customerId: string | null
  customerName: string
  customerEmail: string
  tierName: string | null
  totalSpent: number
  totalOrders: number
  orderId: string | null
  orderNumber: string | null
  orderTotal: number | null
  otherTicketsCount: number
}

export interface TicketReturnRefundData {
  ticketId: string
  returnRequested: boolean
  returnApproved: boolean | null
  returnLabel: string | null
  refundAmount: number | null
  refundReason: string | null
  refundEligible: boolean       // from checkRefundEligibility
  refundEligibilityReason: string | null
  returnId: string | null       // linked Return.id if any
  refundRecordId: string | null // linked RefundRecord.id if any
}

export interface CannedResponseRow {
  id: string
  title: string
  body: string
  category: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AgentRow {
  id: string                    // AdminUser.id
  name: string
  openTicketCount: number
}

export type TicketActivityKind = 'message' | 'internal' | 'status' | 'assignment' | 'return' | 'refund'
export interface TicketActivityEvent {
  id: string
  kind: TicketActivityKind
  label: string
  timestamp: Date
  actor: string | null
}

export interface ChatQueueRow {
  id: string                    // LiveChatSession.id
  sessionId: string
  customerName: string
  issueCategory: string | null
  issueSummary: string | null
  waitTime: number | null
  requestedAt: Date
}

export interface ChatMessageRow {
  id: string
  body: string
  senderType: string            // "customer" | "admin"
  senderName: string
  createdAt: Date
}

export interface ChatSessionData {
  id: string
  sessionId: string
  status: 'WAITING' | 'ACTIVE' | 'CLOSED'
  customerName: string
  customerEmail: string
  issueCategory: string | null
  issueSummary: string | null
  acceptedAt: Date | null
  messages: ChatMessageRow[]
}

export interface AgentAvailabilityData {
  isOnline: boolean
  maxChats: number
  activeChats: number
}
```

### Loader signatures (all in `lib/admin/support.ts`)

```ts
export async function loadSupportKpis(range: TimeRange, currentAdminId: string | null): Promise<SupportKpiData>
export async function loadSupportTab(tab: SupportTab, range: TimeRange, filters: SupportFilters, currentAdminId: string | null): Promise<PaginatedResult<TicketRow>>
export async function loadTicketHeader(id: string): Promise<TicketHeaderData | null>
export async function loadTicketMessages(ticketId: string): Promise<TicketMessageRow[]>
export async function loadTicketCustomerContext(ticketId: string): Promise<TicketCustomerContextData | null>
export async function loadTicketReturnRefund(ticketId: string): Promise<TicketReturnRefundData | null>
export async function loadCannedResponses(): Promise<CannedResponseRow[]>          // active only, for the picker
export async function loadAllCannedResponses(): Promise<CannedResponseRow[]>        // incl. inactive, for the manager
export async function loadAgentList(): Promise<AgentRow[]>
export async function loadTicketActivity(ticketId: string, limit?: number): Promise<TicketActivityEvent[]>
export async function loadChatQueue(): Promise<ChatQueueRow[]>
export async function loadChatSession(sessionId: string): Promise<ChatSessionData | null>
export async function loadAgentAvailability(currentAdminId: string | null): Promise<AgentAvailabilityData>
export async function resolveAdminUserId(sessionUserId: string | null): Promise<string | null>  // Customer.id -> AdminUser.id
```

### Action signatures (all in `app/admin/support/actions.ts`)

```ts
export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string }

export async function replyToTicket(ticketId: string, body: string, opts?: { isInternal?: boolean }): Promise<ActionResult>
export async function addInternalNote(ticketId: string, body: string): Promise<ActionResult>
export async function setTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<ActionResult>
export async function assignTicket(ticketId: string, adminUserId: string | null): Promise<ActionResult>
export async function escalateTicket(ticketId: string): Promise<ActionResult>
export async function resolveTicket(ticketId: string, resolution: string): Promise<ActionResult>
export async function closeTicket(ticketId: string): Promise<ActionResult>
export async function bulkAssign(ticketIds: string[], adminUserId: string): Promise<ActionResult>
export async function bulkSetStatus(ticketIds: string[], status: SupportTicketStatus): Promise<ActionResult>
export async function bulkCloseTickets(ticketIds: string[]): Promise<ActionResult>          // SUPER_ADMIN
export async function approveReturn(ticketId: string, opts?: { generateLabel?: boolean }): Promise<ActionResult>
export async function denyReturn(ticketId: string, reason: string): Promise<ActionResult>
export async function issueRefund(ticketId: string, input: { amount: number; type: 'FULL' | 'PARTIAL' | 'SHIPPING_ONLY'; reason: string }): Promise<ActionResult>  // SUPER_ADMIN
export async function createCannedResponse(input: { title: string; body: string; category?: string }): Promise<ActionResult<{ id: string }>>
export async function updateCannedResponse(id: string, patch: { title?: string; body?: string; category?: string; isActive?: boolean }): Promise<ActionResult>
export async function deleteCannedResponse(id: string): Promise<ActionResult>               // soft: isActive=false
export async function acceptChatSession(sessionId: string): Promise<ActionResult>
export async function closeChatSession(sessionId: string): Promise<ActionResult>
export async function sendChatMessage(sessionId: string, body: string): Promise<ActionResult>
export async function setAgentAvailability(input: { isOnline: boolean; maxChats?: number }): Promise<ActionResult>
```

### SSE contract (T18)

- Endpoint: `GET /api/admin/support/chat/[sessionId]/stream?cursor=<iso>` → `text/event-stream`.
- Each event: `id: <message.createdAt ISO>\nevent: message\ndata: <JSON ChatMessageRow>\n\n`. Periodic `: keepalive\n\n` comments. Stream self-closes after ~50s; client reconnects with `?cursor=<last event id>`.
- Client hook `useSupportChatStream(sessionId: string, initialCursor: string | null)` returns `{ messages: ChatMessageRow[]; connected: boolean }`; uses `EventSource`, parses `data` JSON, dedupes by `id`, reconnects on `error`/close with the latest cursor; falls back to polling `/api/chat/live/[sessionId]` if `EventSource` is undefined.

### Component prop interfaces (consumed by T22–T26 composition + tests)

```ts
// List (T4-T6, T22)
interface SupportTicketsListTableProps { rows: TicketRow[]; selectedIds: Set<string>; onToggleSelection: (id: string) => void; onToggleAll: () => void; allSelected: boolean }
interface SupportTicketsListCardMobileProps { row: TicketRow; selectedIds: Set<string>; onToggleSelection: (id: string) => void }
interface SupportBulkSheetProps { selectedIds: string[]; agents: AgentRow[]; isSuperAdmin: boolean; onClear: () => void }
interface SupportTicketsListClientProps { rows: TicketRow[]; agents: AgentRow[]; isSuperAdmin: boolean }

// Detail widgets (T7-T11, T23)
interface TicketHeaderProps { header: TicketHeaderData; agents: AgentRow[]; isSuperAdmin: boolean }
interface TicketMessageThreadProps { messages: TicketMessageRow[] }
interface TicketCustomerContextProps { context: TicketCustomerContextData }
interface TicketReturnRefundPanelProps { ticketId: string }            // server wrapper; client child gets data + isSuperAdmin
interface TicketActivityTimelineProps { ticketId: string }            // server wrapper; loads internally
interface TicketReplyComposerProps { ticketId: string; cannedResponses: CannedResponseRow[] }

// Inspectors (T12-T17)
interface AssignAgentInspectorProps { open: boolean; ticketId: string; agents: AgentRow[]; currentAssigneeId: string | null; onClose: () => void }
interface StatusChangeInspectorProps { open: boolean; ticketId: string; currentStatus: SupportTicketStatus; onClose: () => void }
interface ReturnDecisionInspectorProps { open: boolean; ticketId: string; data: TicketReturnRefundData; onClose: () => void }
interface RefundInspectorProps { open: boolean; ticketId: string; data: TicketReturnRefundData; isSuperAdmin: boolean; onClose: () => void }
interface CannedResponseManagerInspectorProps { open: boolean; responses: CannedResponseRow[]; onClose: () => void }
interface CannedResponsePickerProps { responses: CannedResponseRow[]; onPick: (body: string) => void }

// Chat (T19-T21)
interface AdminChatQueueV2Props { queue: ChatQueueRow[] }
interface AdminChatPanelV2Props { session: ChatSessionData }
interface AgentAvailabilityToggleProps { availability: AgentAvailabilityData }

// Roots (T24-T26)
interface AdminSupportTicketsV2Props { searchParams: { tab?: string; range?: string; q?: string; page?: string }; currentAdminId: string | null; isSuperAdmin: boolean }
interface AdminTicketDetailV2Props { ticketId: string; isSuperAdmin: boolean }
interface AdminSupportV2Props { currentAdminId: string | null }
```

---
## Wave 1 — Schema migration (sequential, MUST MERGE FIRST)

### Task 1: `CannedResponse` model + `SupportTicket.firstRespondedAt` migration

**Wave:** 1 | **Branch:** `wave9p9/task-1-support-schema` | **Model:** sonnet

**Schema realities for this task:**
- The `SupportTicket` model maps to table **`"support_tickets"`** (`@@map("support_tickets")`, confirmed at `prisma/schema.prisma` line 972).
- `SupportTicket` currently has no `firstRespondedAt` column. We add ONE nullable column + ONE index. No FK changes, no constraint changes, no data backfill — the nullable column defaults to `NULL` on existing rows.
- `CannedResponse` does **not** exist yet — this migration creates the `"canned_responses"` table from scratch. `createdById` is a plain `String` (no FK relation in this phase; it stores the `Customer.id` of the authoring admin, matching how `RefundRecord.createdById`/`SupportMessage.senderId` store the session user id elsewhere).
- **Hand-authored SQL migration** — do NOT run `prisma migrate dev`. Phase 4/7/8 W1 set this pattern: Neon's shadow DB rejects the auto-generated approach with P3006. Instead write the SQL file by hand, apply with `npx prisma db push --skip-generate` (runs the real `CREATE TABLE`/`ALTER TABLE` on the connected DB) and seal it with `npx prisma migrate resolve --applied <timestamp>_support_canned_and_first_response`.
- Migration timestamp format: `YYYYMMDDHHMMSS`. Use the timestamp at the moment of authoring; do NOT reuse a prior migration's timestamp.
- **Worktree note:** worktrees have no `node_modules`. Before running any `npx`/`tsc`/`vitest`, symlink it from the repo root: `ln -s <repo-root>/node_modules node_modules`.
- **This repo uses npm, NOT pnpm.** All commands below use `npx`.

**Files:**
- Edit: `prisma/schema.prisma` (add `CannedResponse` model + `SupportTicket.firstRespondedAt DateTime?` + `@@index([firstRespondedAt])`)
- Create: `prisma/migrations/<timestamp>_support_canned_and_first_response/migration.sql`
- Test: `tests/unit/lib/admin/support-schema.test.ts`

#### Steps

- [ ] **Step 1: Write the failing smoke test**

```ts
// tests/unit/lib/admin/support-schema.test.ts
//
// Smoke test that the new CannedResponse model + SupportTicket.firstRespondedAt
// column are wired through the Prisma client.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const cannedFindMany = vi.fn()
const cannedCreate = vi.fn()
const cannedUpdate = vi.fn()
const cannedFindUnique = vi.fn()
const ticketCount = vi.fn()
const ticketFindMany = vi.fn()
const ticketUpdate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cannedResponse: {
      findMany: cannedFindMany,
      create: cannedCreate,
      update: cannedUpdate,
      findUnique: cannedFindUnique,
    },
    supportTicket: {
      count: ticketCount,
      findMany: ticketFindMany,
      update: ticketUpdate,
    },
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('CannedResponse model', () => {
  it('Prisma accepts cannedResponse CRUD ops', async () => {
    cannedFindMany.mockResolvedValue([])
    cannedCreate.mockResolvedValue({ id: 'cr1' })
    cannedUpdate.mockResolvedValue({ id: 'cr1' })
    cannedFindUnique.mockResolvedValue({ id: 'cr1', isActive: true })

    const { prisma } = await import('@/lib/prisma')

    await prisma.cannedResponse.findMany({
      where: { isActive: true, category: 'returns' },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    await prisma.cannedResponse.create({
      data: { title: 'T', body: 'B', category: 'returns', createdById: 'admin1' },
    })
    await prisma.cannedResponse.update({
      where: { id: 'cr1' },
      data: { isActive: false },
    })
    await prisma.cannedResponse.findUnique({ where: { id: 'cr1' } })

    expect(cannedCreate.mock.calls[0][0].data.createdById).toBe('admin1')
    expect(cannedUpdate.mock.calls[0][0].data.isActive).toBe(false)
  })
})

describe('SupportTicket.firstRespondedAt column', () => {
  it('Prisma accepts firstRespondedAt in where + select + data', async () => {
    ticketCount.mockResolvedValue(0)
    ticketFindMany.mockResolvedValue([])
    ticketUpdate.mockResolvedValue({ id: 't1', firstRespondedAt: new Date() })

    const { prisma } = await import('@/lib/prisma')

    await prisma.supportTicket.count({ where: { firstRespondedAt: null } })
    await prisma.supportTicket.findMany({
      select: { id: true, firstRespondedAt: true },
    })
    await prisma.supportTicket.update({
      where: { id: 't1', firstRespondedAt: null },
      data: { firstRespondedAt: new Date() },
    })

    expect(ticketCount).toHaveBeenCalledWith({ where: { firstRespondedAt: null } })
    expect(ticketUpdate.mock.calls[0][0].where.firstRespondedAt).toBeNull()
    expect(ticketUpdate.mock.calls[0][0].data.firstRespondedAt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/lib/admin/support-schema.test.ts
```

Expected: FAIL — TypeScript errors "Property 'cannedResponse' does not exist on type 'PrismaClient'" and "'firstRespondedAt' does not exist in type 'SupportTicketWhereInput'" (the Prisma client has not yet been regenerated against the new schema).

- [ ] **Step 3: Edit `prisma/schema.prisma`**

In the `model SupportTicket { ... }` block (around line 935), add the `firstRespondedAt` field immediately below the existing `resolution String?` line (keeping the 2-space indent / aligned-column style):

```prisma
  firstRespondedAt DateTime?
```

Then, immediately above the existing `@@index([createdAt])` line inside the same model, add the index:

```prisma
  @@index([firstRespondedAt])
```

Next, add the new `CannedResponse` model. Insert it directly **after** the closing `}` of the `model AdminAvailability { ... }` block (which ends at line ~1052, right before `model AiConversation {`):

```prisma
model CannedResponse {
  id          String   @id @default(cuid())
  title       String
  body        String
  category    String?
  isActive    Boolean  @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isActive])
  @@index([category])
  @@map("canned_responses")
}
```

Save. Verify the only diffs are: the one new `SupportTicket` field, the one new `SupportTicket` index, and the new `CannedResponse` model.

- [ ] **Step 4: Author the migration SQL by hand**

```bash
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TS}_support_canned_and_first_response
cat > prisma/migrations/${TS}_support_canned_and_first_response/migration.sql <<'SQL'
-- Phase 9: Support rebuild — additive schema changes.

-- 1. New CannedResponse model (table "canned_responses").
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "canned_responses_isActive_idx" ON "canned_responses"("isActive");
CREATE INDEX "canned_responses_category_idx" ON "canned_responses"("category");

-- 2. SupportTicket.firstRespondedAt — set when the first PUBLIC admin message
--    is created for a ticket. Drives avg-first-response KPI + SLA/overdue badges.
ALTER TABLE "support_tickets" ADD COLUMN "firstRespondedAt" TIMESTAMP(3);
CREATE INDEX "support_tickets_firstRespondedAt_idx" ON "support_tickets"("firstRespondedAt");
SQL
```

(Use the exact `${TS}` string when you commit; do not hard-code a literal timestamp if you author later.)

- [ ] **Step 5: Apply the migration to the connected DB**

```bash
npx prisma db push --skip-generate
npx prisma migrate resolve --applied "${TS}_support_canned_and_first_response"
npx prisma generate
```

Verify:

```bash
npx prisma migrate status
```

Expected: the new migration appears as `applied`. The `prisma generate` step adds `cannedResponse` to the client and `firstRespondedAt` to the `SupportTicket` type.

- [ ] **Step 6: Run the smoke test to verify it passes**

```bash
npx vitest run tests/unit/lib/admin/support-schema.test.ts
```

Expected: PASS — all Prisma client calls type-check and the mock assertions succeed.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 8: Commit + push + PR (do NOT merge — the controller merges)**

```bash
git add prisma/schema.prisma prisma/migrations tests/unit/lib/admin/support-schema.test.ts
git commit -m "feat(admin-v2): add CannedResponse model + SupportTicket.firstRespondedAt (Phase 9 W1)"
git push -u origin HEAD:wave9p9/task-1-support-schema
gh pr create --title "feat(admin-v2): Phase 9 W1 support schema migration" --body "Adds CannedResponse model (canned_responses) + SupportTicket.firstRespondedAt DateTime? + index. Hand-authored SQL migration applied via prisma db push + migrate resolve. 1 smoke test passing."
```

**Wait for the controller to merge before launching Tasks 2 + 3.**

---

## Wave 2 — Data layer + server actions (2 parallel, after W1 merged)

### Task 2: `lib/admin/support.ts` data layer

**Wave:** 2 | **Parallel-safe with:** Task 3 | **Branch:** `wave9p9/task-2-data-layer` | **Model:** sonnet

**Schema realities for this task:**
- `TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'` — define LOCALLY in `lib/admin/support.ts`; do NOT import from sibling phase files (Phase 8 precedent).
- **Admin identity linkage (CONFIRMED):** there is **no `AdminUser.customerId` field**. The session yields a `Customer.id` (`requireAdmin()` returns `session.userId` = `Customer.id`). `AdminUser` links to `Customer` by **email** (`AdminUser.email @unique` ↔ `Customer.email @unique`; confirmed at `prisma/schema.prisma` lines 14, 169, and the lookup pattern in `app/api/admin/gift-cards/[id]/route.ts` line 28 `prisma.adminUser.findUnique({ where: { email } })`). So `resolveAdminUserId(sessionUserId)` loads `Customer` by id → reads its `email` → finds `AdminUser` by that email → returns `AdminUser.id`. `SupportTicket.assignedToId` and `LiveChatSession.adminId` both reference `AdminUser.id`.
- `SupportTicket` fields used: `id, ticketNumber, type, status, priority, subject, customerId?, customerEmail, customerName, orderId?, orderNumber?, refundAmount?, refundReason?, returnRequested (Bool), returnApproved (Bool?), returnLabel?, assignedToId?, assignedAt?, resolvedAt?, resolvedBy?, resolution?, firstRespondedAt? (new), createdAt, updatedAt`. Relations: `messages: SupportMessage[]`, `assignedTo: AdminUser?`, `customer: Customer?`, `order: Order?`, `liveChatSession?`.
- `SupportMessage` fields: `id, ticketId, message, isInternal (Bool), senderType (String "customer"|"admin"), senderId?, senderName, attachments? (String — JSON column), createdAt`. NOTE the column is `message` (not `body`); map it to `TicketMessageRow.body`. `attachments` is a JSON string — parse defensively to `string[]`.
- `LiveChatSession` fields: `id, sessionId (@unique), ticketId, customerId?, adminId?, status (ChatSessionStatus WAITING|ACTIVE|CLOSED), requestedAt, acceptedAt?, closedAt?, customerName, customerEmail, waitTime?, duration?, issueCategory?, issueSummary?`. Relations: `messages: LiveChatMessage[]`, `admin?`, `customer?`.
- `LiveChatMessage` fields: `id, sessionId, message, senderType, senderId?, senderName, isRead, readAt?, createdAt`. Again the column is `message`, map to `ChatMessageRow.body`.
- `AdminAvailability` fields: `id, adminId (@unique), isOnline, status, maxChats (default 3), activeChats (default 0), lastSeenAt?`.
- `AdminUser` fields: `id, email (@unique), name, role (AdminRole), isActive`. Relation `assignedTickets: SupportTicket[]`.
- `Customer` fields used for context: `id, name, email, totalSpent, totalOrders, loyaltyTier { name }`.
- `Order` fields used for context: `id, orderNumber, total`.
- `Return` link: `Return.supportTicketId @unique`. `RefundRecord` has no `supportTicketId`; we locate refund records via the order (`RefundRecord.orderId`) for the inspector.
- SLA constants (hard-coded, Phase 9.5 makes configurable): `FIRST_RESPONSE_SLA_HOURS = 4`, `RESOLUTION_SLA_HOURS = 48`.
- `loadTicketActivity` derives events from message/field timestamps — there is no per-ticket audit table covering status transitions (the generic `AdminAuditLog` is not reliably populated for tickets), so the timeline is approximate (spec §5/§11 flagged this as acceptable for v1).
- `PaginatedResult` shape is `{ items, total, page, pageSize }`.

**Files:**
- Create: `lib/admin/support.ts`
- Test: `tests/unit/lib/admin/support.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/admin/support.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ticketCount = vi.fn()
const ticketFindMany = vi.fn()
const ticketFindUnique = vi.fn()
const ticketAggregate = vi.fn()
const messageFindMany = vi.fn()
const customerFindUnique = vi.fn()
const orderFindUnique = vi.fn()
const cannedFindMany = vi.fn()
const adminUserFindMany = vi.fn()
const adminUserFindUnique = vi.fn()
const returnFindUnique = vi.fn()
const refundFindFirst = vi.fn()
const chatSessionFindMany = vi.fn()
const chatSessionFindUnique = vi.fn()
const chatMessageFindMany = vi.fn()
const availabilityFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: {
      count: ticketCount,
      findMany: ticketFindMany,
      findUnique: ticketFindUnique,
      aggregate: ticketAggregate,
    },
    supportMessage: { findMany: messageFindMany },
    customer: { findUnique: customerFindUnique },
    order: { findUnique: orderFindUnique },
    cannedResponse: { findMany: cannedFindMany },
    adminUser: { findMany: adminUserFindMany, findUnique: adminUserFindUnique },
    return: { findUnique: returnFindUnique },
    refundRecord: { findFirst: refundFindFirst },
    liveChatSession: { findMany: chatSessionFindMany, findUnique: chatSessionFindUnique },
    liveChatMessage: { findMany: chatMessageFindMany },
    adminAvailability: { findUnique: availabilityFindUnique },
  },
}))

// checkRefundEligibility is mocked so loadTicketReturnRefund stays a unit test.
const checkRefundEligibility = vi.fn()
vi.mock('@/lib/support/refund-helpers', () => ({ checkRefundEligibility }))

beforeEach(() => vi.clearAllMocks())

describe('getRangeBounds (support)', () => {
  it('maps 30d to a 30-day window with a previous shift', async () => {
    const { getRangeBounds } = await import('@/lib/admin/support')
    const ref = new Date('2026-06-19T12:00:00Z')
    const b = getRangeBounds('30d', ref)
    const day = 24 * 60 * 60 * 1000
    expect(b.end.getTime()).toBe(ref.getTime())
    expect(b.start.getTime()).toBe(ref.getTime() - 30 * day)
    expect(b.previousEnd.getTime()).toBe(b.start.getTime())
    expect(b.previousStart.getTime()).toBe(b.start.getTime() - 30 * day)
  })

  it('today snaps start to UTC midnight', async () => {
    const { getRangeBounds } = await import('@/lib/admin/support')
    const ref = new Date('2026-06-19T15:30:00Z')
    const b = getRangeBounds('today', ref)
    expect(b.start.toISOString()).toBe('2026-06-19T00:00:00.000Z')
  })
})

describe('buildTrend (support)', () => {
  it('flags new when previous is zero and current positive', async () => {
    const { buildTrend } = await import('@/lib/admin/support')
    expect(buildTrend(5, 0)).toEqual({ direction: 'flat', text: '↑ new' })
  })
  it('computes up percentage', async () => {
    const { buildTrend } = await import('@/lib/admin/support')
    const t = buildTrend(150, 100)
    expect(t.direction).toBe('up')
    expect(t.text).toContain('50.0%')
  })
})

describe('guards', () => {
  it('isSupportTab + isTimeRange', async () => {
    const { isSupportTab, isTimeRange } = await import('@/lib/admin/support')
    expect(isSupportTab('inbox')).toBe(true)
    expect(isSupportTab('nope')).toBe(false)
    expect(isTimeRange('30d')).toBe(true)
    expect(isTimeRange('decade')).toBe(false)
  })
})

describe('resolveAdminUserId', () => {
  it('returns null for a null session id', async () => {
    const { resolveAdminUserId } = await import('@/lib/admin/support')
    expect(await resolveAdminUserId(null)).toBeNull()
  })
  it('maps Customer.id -> email -> AdminUser.id', async () => {
    customerFindUnique.mockResolvedValue({ email: 'agent@hof.com' })
    adminUserFindUnique.mockResolvedValue({ id: 'au1' })
    const { resolveAdminUserId } = await import('@/lib/admin/support')
    const id = await resolveAdminUserId('cust1')
    expect(customerFindUnique).toHaveBeenCalledWith({
      where: { id: 'cust1' },
      select: { email: true },
    })
    expect(adminUserFindUnique).toHaveBeenCalledWith({
      where: { email: 'agent@hof.com' },
      select: { id: true },
    })
    expect(id).toBe('au1')
  })
  it('returns null when no AdminUser matches the email', async () => {
    customerFindUnique.mockResolvedValue({ email: 'nobody@hof.com' })
    adminUserFindUnique.mockResolvedValue(null)
    const { resolveAdminUserId } = await import('@/lib/admin/support')
    expect(await resolveAdminUserId('cust1')).toBeNull()
  })
})

describe('loadSupportKpis', () => {
  it('aggregates counts + first-response/resolution averages + trends', async () => {
    // Order of Promise.all in impl:
    // openCount, unassignedCount, resolvedInRange, resolvedInRangePrev,
    // frRows (range), resolvedRows (range)
    ticketCount
      .mockResolvedValueOnce(12) // openCount
      .mockResolvedValueOnce(4) // unassignedCount
      .mockResolvedValueOnce(20) // resolvedInRange
      .mockResolvedValueOnce(10) // resolvedInRangePrev
    ticketFindMany
      // first-response rows: firstRespondedAt 2h after createdAt
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-06-10T00:00:00Z'), firstRespondedAt: new Date('2026-06-10T02:00:00Z') },
        { createdAt: new Date('2026-06-11T00:00:00Z'), firstRespondedAt: new Date('2026-06-11T06:00:00Z') },
      ])
      // resolution rows: resolvedAt 24h after createdAt
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-06-10T00:00:00Z'), resolvedAt: new Date('2026-06-11T00:00:00Z') },
      ])

    const { loadSupportKpis } = await import('@/lib/admin/support')
    const kpi = await loadSupportKpis('30d', 'au1')
    expect(kpi.openCount).toBe(12)
    expect(kpi.unassignedCount).toBe(4)
    expect(kpi.resolvedInRange).toBe(20)
    expect(kpi.resolvedInRangeTrend.direction).toBe('up')
    expect(kpi.avgFirstResponseHours).toBeCloseTo(4, 5) // (2 + 6) / 2
    expect(kpi.avgResolutionHours).toBeCloseTo(24, 5)
  })
})

describe('loadSupportTab where-clauses', () => {
  beforeEach(() => {
    ticketFindMany.mockResolvedValue([])
    ticketCount.mockResolvedValue(0)
  })

  it('inbox => status OPEN + assignedToId null', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('inbox', '30d', {}, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.status).toBe('OPEN')
    expect(where.assignedToId).toBeNull()
  })

  it('mine => assignedToId = currentAdminId + status NOT IN resolved/closed', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('mine', '30d', {}, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.assignedToId).toBe('au1')
    expect(where.status).toEqual({ notIn: ['RESOLVED', 'CLOSED'] })
  })

  it('mine with null admin => matches nothing (assignedToId __never__)', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    const res = await loadSupportTab('mine', '30d', {}, null)
    expect(res.items).toEqual([])
    expect(res.total).toBe(0)
    expect(ticketFindMany).not.toHaveBeenCalled()
  })

  it('open => status IN active set', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('open', '30d', {}, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.status).toEqual({
      in: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED'],
    })
  })

  it('escalated => status ESCALATED', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('escalated', '30d', {}, 'au1')
    expect(ticketFindMany.mock.calls[0][0].where.status).toBe('ESCALATED')
  })

  it('resolved => status IN RESOLVED/CLOSED + resolvedAt in range', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('resolved', '30d', {}, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.status).toEqual({ in: ['RESOLVED', 'CLOSED'] })
    expect(where.resolvedAt.gte).toBeInstanceOf(Date)
    expect(where.resolvedAt.lte).toBeInstanceOf(Date)
  })

  it('applies search + type + priority filters', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('open', '30d', { search: 'abc', type: 'REFUND', priority: 'HIGH' }, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.type).toBe('REFUND')
    expect(where.priority).toBe('HIGH')
    expect(where.OR).toEqual([
      { subject: { contains: 'abc', mode: 'insensitive' } },
      { ticketNumber: { contains: 'abc', mode: 'insensitive' } },
      { customerEmail: { contains: 'abc', mode: 'insensitive' } },
    ])
  })

  it('maps rows + computes isOverdue (no first response, aged past SLA, active)', async () => {
    const old = new Date(Date.now() - 10 * 60 * 60 * 1000) // 10h ago
    ticketFindMany.mockResolvedValue([
      {
        id: 't1',
        ticketNumber: 'TKT-2026-000001',
        subject: 'Help',
        type: 'GENERAL',
        status: 'OPEN',
        priority: 'MEDIUM',
        customerName: 'Jane',
        customerEmail: 'jane@x.com',
        assignedToId: null,
        assignedTo: null,
        createdAt: old,
        firstRespondedAt: null,
      },
    ])
    ticketCount.mockResolvedValue(1)
    const { loadSupportTab } = await import('@/lib/admin/support')
    const res = await loadSupportTab('inbox', '30d', {}, 'au1')
    expect(res.items[0].isOverdue).toBe(true)
    expect(res.items[0].ageHours).toBeGreaterThanOrEqual(10)
    expect(res.items[0].assigneeName).toBeNull()
  })

  it('not overdue once a first response exists', async () => {
    const old = new Date(Date.now() - 10 * 60 * 60 * 1000)
    ticketFindMany.mockResolvedValue([
      {
        id: 't2',
        ticketNumber: 'TKT-2026-000002',
        subject: 'Hi',
        type: 'GENERAL',
        status: 'OPEN',
        priority: 'LOW',
        customerName: 'Bob',
        customerEmail: 'bob@x.com',
        assignedToId: 'au1',
        assignedTo: { name: 'Agent A' },
        createdAt: old,
        firstRespondedAt: new Date(old.getTime() + 60 * 60 * 1000),
      },
    ])
    ticketCount.mockResolvedValue(1)
    const { loadSupportTab } = await import('@/lib/admin/support')
    const res = await loadSupportTab('inbox', '30d', {}, 'au1')
    expect(res.items[0].isOverdue).toBe(false)
    expect(res.items[0].assigneeName).toBe('Agent A')
  })
})

describe('loadTicketHeader', () => {
  it('returns null when missing', async () => {
    ticketFindUnique.mockResolvedValue(null)
    const { loadTicketHeader } = await import('@/lib/admin/support')
    expect(await loadTicketHeader('nope')).toBeNull()
  })
  it('maps core fields + overdue + refundAmount', async () => {
    const created = new Date(Date.now() - 6 * 60 * 60 * 1000)
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      ticketNumber: 'TKT-2026-000001',
      subject: 'S',
      type: 'REFUND',
      status: 'OPEN',
      priority: 'HIGH',
      customerId: 'c1',
      customerName: 'Jane',
      customerEmail: 'jane@x.com',
      orderId: 'o1',
      orderNumber: 'HOF-1001',
      assignedToId: null,
      assignedTo: null,
      createdAt: created,
      firstRespondedAt: null,
      resolvedAt: null,
      returnRequested: true,
      returnApproved: null,
      refundAmount: 42.5,
    })
    const { loadTicketHeader } = await import('@/lib/admin/support')
    const h = await loadTicketHeader('t1')
    expect(h?.isOverdue).toBe(true)
    expect(h?.refundAmount).toBe(42.5)
    expect(h?.orderNumber).toBe('HOF-1001')
    expect(h?.returnRequested).toBe(true)
  })
})

describe('loadTicketMessages', () => {
  it('maps message->body + parses attachments JSON', async () => {
    messageFindMany.mockResolvedValue([
      {
        id: 'm1',
        message: 'hello',
        isInternal: false,
        senderType: 'customer',
        senderName: 'Jane',
        attachments: '["https://a.png","https://b.png"]',
        createdAt: new Date(),
      },
      {
        id: 'm2',
        message: 'note',
        isInternal: true,
        senderType: 'admin',
        senderName: 'Agent',
        attachments: null,
        createdAt: new Date(),
      },
    ])
    const { loadTicketMessages } = await import('@/lib/admin/support')
    const rows = await loadTicketMessages('t1')
    expect(messageFindMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' })
    expect(rows[0].body).toBe('hello')
    expect(rows[0].attachments).toEqual(['https://a.png', 'https://b.png'])
    expect(rows[1].attachments).toEqual([])
  })
})

describe('loadTicketCustomerContext', () => {
  it('returns null when ticket missing', async () => {
    ticketFindUnique.mockResolvedValue(null)
    const { loadTicketCustomerContext } = await import('@/lib/admin/support')
    expect(await loadTicketCustomerContext('x')).toBeNull()
  })
  it('assembles customer snapshot + order + other ticket count', async () => {
    ticketFindUnique.mockResolvedValue({
      customerId: 'c1',
      customerName: 'Jane',
      customerEmail: 'jane@x.com',
      orderId: 'o1',
      orderNumber: 'HOF-1001',
      customer: {
        totalSpent: 300,
        totalOrders: 4,
        loyaltyTier: { name: 'Gold' },
      },
      order: { total: 80 },
    })
    ticketCount.mockResolvedValue(2) // other tickets
    const { loadTicketCustomerContext } = await import('@/lib/admin/support')
    const ctx = await loadTicketCustomerContext('t1')
    expect(ctx?.tierName).toBe('Gold')
    expect(ctx?.totalSpent).toBe(300)
    expect(ctx?.orderTotal).toBe(80)
    expect(ctx?.otherTicketsCount).toBe(2)
    // other-ticket count excludes this ticket + scoped to customer
    const where = ticketCount.mock.calls[0][0].where
    expect(where.customerId).toBe('c1')
    expect(where.id).toEqual({ not: 't1' })
  })
})

describe('loadTicketReturnRefund', () => {
  it('returns null when ticket missing', async () => {
    ticketFindUnique.mockResolvedValue(null)
    const { loadTicketReturnRefund } = await import('@/lib/admin/support')
    expect(await loadTicketReturnRefund('x')).toBeNull()
  })
  it('assembles return/refund + eligibility from helper', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      orderId: 'o1',
      returnRequested: true,
      returnApproved: null,
      returnLabel: null,
      refundAmount: null,
      refundReason: null,
    })
    returnFindUnique.mockResolvedValue({ id: 'r1' })
    refundFindFirst.mockResolvedValue({ id: 'rr1' })
    checkRefundEligibility.mockResolvedValue({ eligible: true, reason: undefined })
    const { loadTicketReturnRefund } = await import('@/lib/admin/support')
    const d = await loadTicketReturnRefund('t1')
    expect(checkRefundEligibility).toHaveBeenCalledWith('o1')
    expect(d?.refundEligible).toBe(true)
    expect(d?.returnId).toBe('r1')
    expect(d?.refundRecordId).toBe('rr1')
  })
  it('eligibility false when no order linked (no helper call)', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      orderId: null,
      returnRequested: false,
      returnApproved: null,
      returnLabel: null,
      refundAmount: null,
      refundReason: null,
    })
    returnFindUnique.mockResolvedValue(null)
    const { loadTicketReturnRefund } = await import('@/lib/admin/support')
    const d = await loadTicketReturnRefund('t1')
    expect(checkRefundEligibility).not.toHaveBeenCalled()
    expect(d?.refundEligible).toBe(false)
    expect(d?.returnId).toBeNull()
    expect(d?.refundRecordId).toBeNull()
  })
})

describe('canned responses loaders', () => {
  it('loadCannedResponses filters active only', async () => {
    cannedFindMany.mockResolvedValue([])
    const { loadCannedResponses } = await import('@/lib/admin/support')
    await loadCannedResponses()
    expect(cannedFindMany.mock.calls[0][0].where).toEqual({ isActive: true })
  })
  it('loadAllCannedResponses has no active filter', async () => {
    cannedFindMany.mockResolvedValue([])
    const { loadAllCannedResponses } = await import('@/lib/admin/support')
    await loadAllCannedResponses()
    expect(cannedFindMany.mock.calls[0][0].where).toBeUndefined()
  })
})

describe('loadAgentList', () => {
  it('returns active admins with open-ticket counts', async () => {
    adminUserFindMany.mockResolvedValue([
      { id: 'au1', name: 'Agent A', _count: { assignedTickets: 3 } },
      { id: 'au2', name: 'Agent B', _count: { assignedTickets: 0 } },
    ])
    const { loadAgentList } = await import('@/lib/admin/support')
    const agents = await loadAgentList()
    expect(adminUserFindMany.mock.calls[0][0].where).toEqual({ isActive: true })
    expect(agents[0]).toEqual({ id: 'au1', name: 'Agent A', openTicketCount: 3 })
  })
})

describe('loadTicketActivity', () => {
  it('merges messages + status/assignment/return/refund events sorted desc', async () => {
    const t0 = new Date('2026-06-19T00:00:00Z')
    const t1 = new Date('2026-06-19T01:00:00Z')
    const t2 = new Date('2026-06-19T02:00:00Z')
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      createdAt: t0,
      assignedAt: t1,
      assignedTo: { name: 'Agent A' },
      resolvedAt: t2,
      resolvedBy: 'Agent A',
      returnRequested: true,
      returnApproved: true,
      refundAmount: 10,
    })
    messageFindMany.mockResolvedValue([
      { id: 'm1', isInternal: false, senderType: 'customer', senderName: 'Jane', createdAt: t0 },
      { id: 'm2', isInternal: true, senderType: 'admin', senderName: 'Agent A', createdAt: t1 },
    ])
    const { loadTicketActivity } = await import('@/lib/admin/support')
    const events = await loadTicketActivity('t1', 50)
    // newest first
    expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(events[events.length - 1].timestamp.getTime())
    const kinds = events.map((e) => e.kind)
    expect(kinds).toContain('message')
    expect(kinds).toContain('internal')
    expect(kinds).toContain('assignment')
    expect(kinds).toContain('return')
    expect(kinds).toContain('refund')
  })
})

describe('live chat loaders', () => {
  it('loadChatQueue returns WAITING sessions', async () => {
    chatSessionFindMany.mockResolvedValue([
      {
        id: 's1',
        sessionId: 'sess-1',
        customerName: 'Jane',
        issueCategory: 'returns',
        issueSummary: 'wrong size',
        waitTime: 30,
        requestedAt: new Date(),
      },
    ])
    const { loadChatQueue } = await import('@/lib/admin/support')
    const q = await loadChatQueue()
    expect(chatSessionFindMany.mock.calls[0][0].where).toEqual({ status: 'WAITING' })
    expect(q[0].sessionId).toBe('sess-1')
  })

  it('loadChatSession maps session + messages', async () => {
    chatSessionFindUnique.mockResolvedValue({
      id: 's1',
      sessionId: 'sess-1',
      status: 'ACTIVE',
      customerName: 'Jane',
      customerEmail: 'jane@x.com',
      issueCategory: 'returns',
      issueSummary: 'wrong size',
      acceptedAt: new Date(),
      messages: [
        { id: 'cm1', message: 'hi', senderType: 'customer', senderName: 'Jane', createdAt: new Date() },
      ],
    })
    const { loadChatSession } = await import('@/lib/admin/support')
    const s = await loadChatSession('sess-1')
    expect(chatSessionFindUnique.mock.calls[0][0].where).toEqual({ sessionId: 'sess-1' })
    expect(s?.messages[0].body).toBe('hi')
  })

  it('loadChatSession returns null when missing', async () => {
    chatSessionFindUnique.mockResolvedValue(null)
    const { loadChatSession } = await import('@/lib/admin/support')
    expect(await loadChatSession('x')).toBeNull()
  })

  it('loadAgentAvailability returns defaults for null admin', async () => {
    const { loadAgentAvailability } = await import('@/lib/admin/support')
    const a = await loadAgentAvailability(null)
    expect(a).toEqual({ isOnline: false, maxChats: 3, activeChats: 0 })
    expect(availabilityFindUnique).not.toHaveBeenCalled()
  })

  it('loadAgentAvailability reads the row when present', async () => {
    availabilityFindUnique.mockResolvedValue({ isOnline: true, maxChats: 5, activeChats: 2 })
    const { loadAgentAvailability } = await import('@/lib/admin/support')
    const a = await loadAgentAvailability('au1')
    expect(availabilityFindUnique.mock.calls[0][0].where).toEqual({ adminId: 'au1' })
    expect(a).toEqual({ isOnline: true, maxChats: 5, activeChats: 2 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/lib/admin/support.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/admin/support'`.

- [ ] **Step 3: Implement `lib/admin/support.ts`**

```ts
// lib/admin/support.ts
//
// Single source of truth for Phase 9 Support admin data shapes + Prisma queries.
// Mirrors lib/admin/customers.ts: TimeRange + getRangeBounds + buildTrend +
// PaginatedResult + KPI loader + tab loader + detail/chat loaders.
//
// Schema adaptations (verified against prisma/schema.prisma):
//   - SupportMessage.message / LiveChatMessage.message are the body columns
//     (mapped to TicketMessageRow.body / ChatMessageRow.body).
//   - SupportMessage.attachments is a JSON string column — parsed defensively.
//   - SupportTicket.firstRespondedAt (new this phase) drives SLA/overdue + KPI.
//   - AdminUser links to a session Customer by EMAIL (no AdminUser.customerId).
//     resolveAdminUserId: Customer.id -> Customer.email -> AdminUser.id.
//   - Return.supportTicketId @unique links a Return to a ticket; RefundRecord
//     has no ticket FK, so we locate refund records via the ticket's orderId.
//   - TimeRange is Phase-9-local — do NOT import from sibling phase files.

import { prisma } from '@/lib/prisma'
import { checkRefundEligibility } from '@/lib/support/refund-helpers'
import type {
  SupportTicketType,
  SupportTicketStatus,
  SupportPriority,
} from '@prisma/client'

// ============================================================
// TimeRange + range bounds
// ============================================================

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'
export const TIME_RANGES: TimeRange[] = ['today', '7d', '30d', '90d', 'year']

export interface RangeBounds {
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}

export function getRangeBounds(range: TimeRange, ref: Date = new Date()): RangeBounds {
  const end = new Date(ref)
  const start = new Date(ref)
  const day = 24 * 60 * 60 * 1000
  let durationMs: number

  switch (range) {
    case 'today':
      start.setUTCHours(0, 0, 0, 0)
      durationMs = end.getTime() - start.getTime()
      break
    case '7d':
      durationMs = 7 * day
      start.setTime(end.getTime() - durationMs)
      break
    case '30d':
      durationMs = 30 * day
      start.setTime(end.getTime() - durationMs)
      break
    case '90d':
      durationMs = 90 * day
      start.setTime(end.getTime() - durationMs)
      break
    case 'year':
      durationMs = 365 * day
      start.setTime(end.getTime() - durationMs)
      break
  }

  return {
    start,
    end,
    previousStart: new Date(start.getTime() - durationMs),
    previousEnd: new Date(end.getTime() - durationMs),
  }
}

// ============================================================
// Trend helper
// ============================================================

export interface TrendData {
  direction: 'up' | 'down' | 'flat'
  text: string
}

export function buildTrend(current: number, previous: number): TrendData {
  if (previous === 0) {
    return { direction: 'flat', text: current > 0 ? '↑ new' : '— No prior data' }
  }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return { direction: 'flat', text: '— 0%' }
  return {
    direction: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%`,
  }
}

// ============================================================
// Pagination
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

// ============================================================
// SLA constants (Phase 9.5 makes these configurable)
// ============================================================

export const FIRST_RESPONSE_SLA_HOURS = 4
export const RESOLUTION_SLA_HOURS = 48

// Statuses still considered "active" (open work) — used for overdue + tabs.
const ACTIVE_STATUSES: SupportTicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'ESCALATED',
]
const CLOSED_STATUSES: SupportTicketStatus[] = ['RESOLVED', 'CLOSED']

// ============================================================
// Tabs + filters
// ============================================================

export const SUPPORT_TABS = ['inbox', 'mine', 'open', 'escalated', 'resolved'] as const
export type SupportTab = (typeof SUPPORT_TABS)[number]

export function isSupportTab(v: unknown): v is SupportTab {
  return typeof v === 'string' && (SUPPORT_TABS as readonly string[]).includes(v)
}

export function isTimeRange(v: unknown): v is TimeRange {
  return typeof v === 'string' && (TIME_RANGES as readonly string[]).includes(v)
}

export interface SupportFilters {
  search?: string
  type?: SupportTicketType
  priority?: SupportPriority
  page?: number
  pageSize?: number
}

// ============================================================
// Row + KPI shapes
// ============================================================

export interface TicketRow {
  id: string
  ticketNumber: string
  subject: string
  type: SupportTicketType
  status: SupportTicketStatus
  priority: SupportPriority
  customerName: string
  customerEmail: string
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  firstRespondedAt: Date | null
  ageHours: number
  isOverdue: boolean
}

export interface SupportKpiData {
  openCount: number
  unassignedCount: number
  avgFirstResponseHours: number
  avgFirstResponseTrend: TrendData
  avgResolutionHours: number
  resolvedInRange: number
  resolvedInRangeTrend: TrendData
}

// ============================================================
// Detail shapes
// ============================================================

export interface TicketHeaderData {
  id: string
  ticketNumber: string
  subject: string
  type: SupportTicketType
  status: SupportTicketStatus
  priority: SupportPriority
  customerId: string | null
  customerName: string
  customerEmail: string
  orderId: string | null
  orderNumber: string | null
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  firstRespondedAt: Date | null
  resolvedAt: Date | null
  ageHours: number
  isOverdue: boolean
  returnRequested: boolean
  returnApproved: boolean | null
  refundAmount: number | null
}

export interface TicketMessageRow {
  id: string
  body: string
  isInternal: boolean
  senderType: string
  senderName: string
  attachments: string[]
  createdAt: Date
}

export interface TicketCustomerContextData {
  customerId: string | null
  customerName: string
  customerEmail: string
  tierName: string | null
  totalSpent: number
  totalOrders: number
  orderId: string | null
  orderNumber: string | null
  orderTotal: number | null
  otherTicketsCount: number
}

export interface TicketReturnRefundData {
  ticketId: string
  returnRequested: boolean
  returnApproved: boolean | null
  returnLabel: string | null
  refundAmount: number | null
  refundReason: string | null
  refundEligible: boolean
  refundEligibilityReason: string | null
  returnId: string | null
  refundRecordId: string | null
}

export interface CannedResponseRow {
  id: string
  title: string
  body: string
  category: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AgentRow {
  id: string
  name: string
  openTicketCount: number
}

export type TicketActivityKind =
  | 'message'
  | 'internal'
  | 'status'
  | 'assignment'
  | 'return'
  | 'refund'

export interface TicketActivityEvent {
  id: string
  kind: TicketActivityKind
  label: string
  timestamp: Date
  actor: string | null
}

export interface ChatQueueRow {
  id: string
  sessionId: string
  customerName: string
  issueCategory: string | null
  issueSummary: string | null
  waitTime: number | null
  requestedAt: Date
}

export interface ChatMessageRow {
  id: string
  body: string
  senderType: string
  senderName: string
  createdAt: Date
}

export interface ChatSessionData {
  id: string
  sessionId: string
  status: 'WAITING' | 'ACTIVE' | 'CLOSED'
  customerName: string
  customerEmail: string
  issueCategory: string | null
  issueSummary: string | null
  acceptedAt: Date | null
  messages: ChatMessageRow[]
}

export interface AgentAvailabilityData {
  isOnline: boolean
  maxChats: number
  activeChats: number
}

// ============================================================
// Internal helpers
// ============================================================

function hoursBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / (60 * 60 * 1000)
}

function computeOverdue(
  status: SupportTicketStatus,
  firstRespondedAt: Date | null,
  ageHours: number,
): boolean {
  if (!ACTIVE_STATUSES.includes(status)) return false
  if (firstRespondedAt) return false
  return ageHours > FIRST_RESPONSE_SLA_HOURS
}

function parseAttachments(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
    return []
  } catch {
    return []
  }
}

// ============================================================
// Admin identity resolution (Customer.id -> AdminUser.id by email)
// ============================================================

export async function resolveAdminUserId(sessionUserId: string | null): Promise<string | null> {
  if (!sessionUserId) return null
  const customer = await prisma.customer.findUnique({
    where: { id: sessionUserId },
    select: { email: true },
  })
  if (!customer?.email) return null
  const admin = await prisma.adminUser.findUnique({
    where: { email: customer.email },
    select: { id: true },
  })
  return admin?.id ?? null
}

// ============================================================
// KPI loader
// ============================================================

export async function loadSupportKpis(
  range: TimeRange,
  _currentAdminId: string | null,
): Promise<SupportKpiData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)

  const [
    openCount,
    unassignedCount,
    resolvedInRange,
    resolvedInRangePrev,
    firstResponseRows,
    resolutionRows,
  ] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.supportTicket.count({ where: { status: 'OPEN', assignedToId: null } }),
    prisma.supportTicket.count({
      where: { status: { in: CLOSED_STATUSES }, resolvedAt: { gte: start, lte: end } },
    }),
    prisma.supportTicket.count({
      where: {
        status: { in: CLOSED_STATUSES },
        resolvedAt: { gte: previousStart, lte: previousEnd },
      },
    }),
    prisma.supportTicket.findMany({
      where: { firstRespondedAt: { gte: start, lte: end } },
      select: { createdAt: true, firstRespondedAt: true },
    }),
    prisma.supportTicket.findMany({
      where: { status: { in: CLOSED_STATUSES }, resolvedAt: { gte: start, lte: end } },
      select: { createdAt: true, resolvedAt: true },
    }),
  ])

  // Average first-response hours (current range).
  let avgFirstResponseHours = 0
  if (firstResponseRows.length > 0) {
    const total = firstResponseRows.reduce(
      (sum, t) => sum + (t.firstRespondedAt ? hoursBetween(t.firstRespondedAt, t.createdAt) : 0),
      0,
    )
    avgFirstResponseHours = total / firstResponseRows.length
  }

  // Average first-response hours for the previous range (for the trend).
  const previousFirstResponseRows = await prisma.supportTicket.findMany({
    where: { firstRespondedAt: { gte: previousStart, lte: previousEnd } },
    select: { createdAt: true, firstRespondedAt: true },
  })
  let avgFirstResponseHoursPrev = 0
  if (previousFirstResponseRows.length > 0) {
    const total = previousFirstResponseRows.reduce(
      (sum, t) => sum + (t.firstRespondedAt ? hoursBetween(t.firstRespondedAt, t.createdAt) : 0),
      0,
    )
    avgFirstResponseHoursPrev = total / previousFirstResponseRows.length
  }

  // Average resolution hours (current range).
  let avgResolutionHours = 0
  if (resolutionRows.length > 0) {
    const total = resolutionRows.reduce(
      (sum, t) => sum + (t.resolvedAt ? hoursBetween(t.resolvedAt, t.createdAt) : 0),
      0,
    )
    avgResolutionHours = total / resolutionRows.length
  }

  return {
    openCount,
    unassignedCount,
    avgFirstResponseHours,
    // Lower is better, but buildTrend is direction-agnostic — UI colors by metric.
    avgFirstResponseTrend: buildTrend(avgFirstResponseHours, avgFirstResponseHoursPrev),
    avgResolutionHours,
    resolvedInRange,
    resolvedInRangeTrend: buildTrend(resolvedInRange, resolvedInRangePrev),
  }
}

// ============================================================
// Tab loader
// ============================================================

function buildTabWhere(
  tab: SupportTab,
  range: TimeRange,
  currentAdminId: string | null,
): Record<string, unknown> {
  switch (tab) {
    case 'inbox':
      return { status: 'OPEN', assignedToId: null }
    case 'mine':
      // currentAdminId guaranteed non-null by the caller's short-circuit.
      return { assignedToId: currentAdminId, status: { notIn: CLOSED_STATUSES } }
    case 'open':
      return { status: { in: ACTIVE_STATUSES } }
    case 'escalated':
      return { status: 'ESCALATED' }
    case 'resolved': {
      const { start, end } = getRangeBounds(range)
      return { status: { in: CLOSED_STATUSES }, resolvedAt: { gte: start, lte: end } }
    }
  }
}

export async function loadSupportTab(
  tab: SupportTab,
  range: TimeRange,
  filters: SupportFilters,
  currentAdminId: string | null,
): Promise<PaginatedResult<TicketRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  // "mine" with no resolved admin can never match — short-circuit.
  if (tab === 'mine' && !currentAdminId) {
    return { items: [], total: 0, page, pageSize }
  }

  const where: Record<string, unknown> = { ...buildTabWhere(tab, range, currentAdminId) }
  if (filters.type) where.type = filters.type
  if (filters.priority) where.priority = filters.priority
  if (filters.search) {
    where.OR = [
      { subject: { contains: filters.search, mode: 'insensitive' as const } },
      { ticketNumber: { contains: filters.search, mode: 'insensitive' as const } },
      { customerEmail: { contains: filters.search, mode: 'insensitive' as const } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        type: true,
        status: true,
        priority: true,
        customerName: true,
        customerEmail: true,
        assignedToId: true,
        assignedTo: { select: { name: true } },
        createdAt: true,
        firstRespondedAt: true,
      },
    }),
    prisma.supportTicket.count({ where }),
  ])

  const now = Date.now()
  return {
    items: rows.map((t): TicketRow => {
      const ageHours = (now - t.createdAt.getTime()) / (60 * 60 * 1000)
      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        type: t.type,
        status: t.status,
        priority: t.priority,
        customerName: t.customerName,
        customerEmail: t.customerEmail,
        assigneeId: t.assignedToId ?? null,
        assigneeName: t.assignedTo?.name ?? null,
        createdAt: t.createdAt,
        firstRespondedAt: t.firstRespondedAt ?? null,
        ageHours,
        isOverdue: computeOverdue(t.status, t.firstRespondedAt ?? null, ageHours),
      }
    }),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Detail loaders
// ============================================================

export async function loadTicketHeader(id: string): Promise<TicketHeaderData | null> {
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      type: true,
      status: true,
      priority: true,
      customerId: true,
      customerName: true,
      customerEmail: true,
      orderId: true,
      orderNumber: true,
      assignedToId: true,
      assignedTo: { select: { name: true } },
      createdAt: true,
      firstRespondedAt: true,
      resolvedAt: true,
      returnRequested: true,
      returnApproved: true,
      refundAmount: true,
    },
  })
  if (!t) return null
  const ageHours = (Date.now() - t.createdAt.getTime()) / (60 * 60 * 1000)
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    type: t.type,
    status: t.status,
    priority: t.priority,
    customerId: t.customerId ?? null,
    customerName: t.customerName,
    customerEmail: t.customerEmail,
    orderId: t.orderId ?? null,
    orderNumber: t.orderNumber ?? null,
    assigneeId: t.assignedToId ?? null,
    assigneeName: t.assignedTo?.name ?? null,
    createdAt: t.createdAt,
    firstRespondedAt: t.firstRespondedAt ?? null,
    resolvedAt: t.resolvedAt ?? null,
    ageHours,
    isOverdue: computeOverdue(t.status, t.firstRespondedAt ?? null, ageHours),
    returnRequested: t.returnRequested,
    returnApproved: t.returnApproved ?? null,
    refundAmount: t.refundAmount ?? null,
  }
}

export async function loadTicketMessages(ticketId: string): Promise<TicketMessageRow[]> {
  const rows = await prisma.supportMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      message: true,
      isInternal: true,
      senderType: true,
      senderName: true,
      attachments: true,
      createdAt: true,
    },
  })
  return rows.map((m) => ({
    id: m.id,
    body: m.message,
    isInternal: m.isInternal,
    senderType: m.senderType,
    senderName: m.senderName,
    attachments: parseAttachments(m.attachments),
    createdAt: m.createdAt,
  }))
}

export async function loadTicketCustomerContext(
  ticketId: string,
): Promise<TicketCustomerContextData | null> {
  const t = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      customerId: true,
      customerName: true,
      customerEmail: true,
      orderId: true,
      orderNumber: true,
      customer: {
        select: {
          totalSpent: true,
          totalOrders: true,
          loyaltyTier: { select: { name: true } },
        },
      },
      order: { select: { total: true } },
    },
  })
  if (!t) return null

  let otherTicketsCount = 0
  if (t.customerId) {
    otherTicketsCount = await prisma.supportTicket.count({
      where: { customerId: t.customerId, id: { not: ticketId } },
    })
  }

  return {
    customerId: t.customerId ?? null,
    customerName: t.customerName,
    customerEmail: t.customerEmail,
    tierName: t.customer?.loyaltyTier?.name ?? null,
    totalSpent: Number(t.customer?.totalSpent ?? 0),
    totalOrders: t.customer?.totalOrders ?? 0,
    orderId: t.orderId ?? null,
    orderNumber: t.orderNumber ?? null,
    orderTotal: t.order ? Number(t.order.total ?? 0) : null,
    otherTicketsCount,
  }
}

export async function loadTicketReturnRefund(
  ticketId: string,
): Promise<TicketReturnRefundData | null> {
  const t = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      orderId: true,
      returnRequested: true,
      returnApproved: true,
      returnLabel: true,
      refundAmount: true,
      refundReason: true,
    },
  })
  if (!t) return null

  const linkedReturn = await prisma.return.findUnique({
    where: { supportTicketId: ticketId },
    select: { id: true },
  })

  let refundRecordId: string | null = null
  if (t.orderId) {
    const rr = await prisma.refundRecord.findFirst({
      where: { orderId: t.orderId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    refundRecordId = rr?.id ?? null
  }

  let refundEligible = false
  let refundEligibilityReason: string | null = null
  if (t.orderId) {
    const eligibility = await checkRefundEligibility(t.orderId)
    refundEligible = eligibility.eligible
    refundEligibilityReason = eligibility.reason ?? null
  } else {
    refundEligibilityReason = 'No order linked to this ticket'
  }

  return {
    ticketId: t.id,
    returnRequested: t.returnRequested,
    returnApproved: t.returnApproved ?? null,
    returnLabel: t.returnLabel ?? null,
    refundAmount: t.refundAmount ?? null,
    refundReason: t.refundReason ?? null,
    refundEligible,
    refundEligibilityReason,
    returnId: linkedReturn?.id ?? null,
    refundRecordId,
  }
}

export async function loadCannedResponses(): Promise<CannedResponseRow[]> {
  const rows = await prisma.cannedResponse.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function loadAllCannedResponses(): Promise<CannedResponseRow[]> {
  const rows = await prisma.cannedResponse.findMany({
    orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function loadAgentList(): Promise<AgentRow[]> {
  const rows = await prisma.adminUser.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          assignedTickets: {
            where: { status: { in: ACTIVE_STATUSES } },
          },
        },
      },
    },
  })
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    openTicketCount: a._count.assignedTickets,
  }))
}

export async function loadTicketActivity(
  ticketId: string,
  limit = 50,
): Promise<TicketActivityEvent[]> {
  const [ticket, messages] = await Promise.all([
    prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        createdAt: true,
        assignedAt: true,
        assignedTo: { select: { name: true } },
        resolvedAt: true,
        resolvedBy: true,
        returnRequested: true,
        returnApproved: true,
        refundAmount: true,
      },
    }),
    prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        isInternal: true,
        senderType: true,
        senderName: true,
        createdAt: true,
      },
    }),
  ])

  if (!ticket) return []

  const events: TicketActivityEvent[] = []

  for (const m of messages) {
    events.push({
      id: `msg-${m.id}`,
      kind: m.isInternal ? 'internal' : 'message',
      label: m.isInternal
        ? `Internal note by ${m.senderName}`
        : `Reply from ${m.senderName} (${m.senderType})`,
      timestamp: m.createdAt,
      actor: m.senderName,
    })
  }

  if (ticket.assignedAt) {
    events.push({
      id: `assign-${ticket.id}`,
      kind: 'assignment',
      label: ticket.assignedTo?.name
        ? `Assigned to ${ticket.assignedTo.name}`
        : 'Assigned',
      timestamp: ticket.assignedAt,
      actor: ticket.assignedTo?.name ?? null,
    })
  }

  if (ticket.returnRequested) {
    events.push({
      id: `return-${ticket.id}`,
      kind: 'return',
      label:
        ticket.returnApproved === true
          ? 'Return approved'
          : ticket.returnApproved === false
            ? 'Return denied'
            : 'Return requested',
      timestamp: ticket.assignedAt ?? ticket.createdAt,
      actor: null,
    })
  }

  if (ticket.refundAmount != null) {
    events.push({
      id: `refund-${ticket.id}`,
      kind: 'refund',
      label: `Refund of $${Number(ticket.refundAmount).toFixed(2)}`,
      timestamp: ticket.resolvedAt ?? ticket.createdAt,
      actor: null,
    })
  }

  if (ticket.resolvedAt) {
    events.push({
      id: `status-${ticket.id}`,
      kind: 'status',
      label: ticket.resolvedBy ? `Resolved by ${ticket.resolvedBy}` : 'Resolved',
      timestamp: ticket.resolvedAt,
      actor: ticket.resolvedBy ?? null,
    })
  }

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

// ============================================================
// Live chat loaders
// ============================================================

export async function loadChatQueue(): Promise<ChatQueueRow[]> {
  const rows = await prisma.liveChatSession.findMany({
    where: { status: 'WAITING' },
    orderBy: { requestedAt: 'asc' },
    select: {
      id: true,
      sessionId: true,
      customerName: true,
      issueCategory: true,
      issueSummary: true,
      waitTime: true,
      requestedAt: true,
    },
  })
  return rows.map((s) => ({
    id: s.id,
    sessionId: s.sessionId,
    customerName: s.customerName,
    issueCategory: s.issueCategory ?? null,
    issueSummary: s.issueSummary ?? null,
    waitTime: s.waitTime ?? null,
    requestedAt: s.requestedAt,
  }))
}

export async function loadChatSession(sessionId: string): Promise<ChatSessionData | null> {
  const s = await prisma.liveChatSession.findUnique({
    where: { sessionId },
    select: {
      id: true,
      sessionId: true,
      status: true,
      customerName: true,
      customerEmail: true,
      issueCategory: true,
      issueSummary: true,
      acceptedAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          message: true,
          senderType: true,
          senderName: true,
          createdAt: true,
        },
      },
    },
  })
  if (!s) return null
  return {
    id: s.id,
    sessionId: s.sessionId,
    status: s.status,
    customerName: s.customerName,
    customerEmail: s.customerEmail,
    issueCategory: s.issueCategory ?? null,
    issueSummary: s.issueSummary ?? null,
    acceptedAt: s.acceptedAt ?? null,
    messages: s.messages.map((m) => ({
      id: m.id,
      body: m.message,
      senderType: m.senderType,
      senderName: m.senderName,
      createdAt: m.createdAt,
    })),
  }
}

export async function loadAgentAvailability(
  currentAdminId: string | null,
): Promise<AgentAvailabilityData> {
  if (!currentAdminId) {
    return { isOnline: false, maxChats: 3, activeChats: 0 }
  }
  const row = await prisma.adminAvailability.findUnique({
    where: { adminId: currentAdminId },
    select: { isOnline: true, maxChats: true, activeChats: true },
  })
  if (!row) {
    return { isOnline: false, maxChats: 3, activeChats: 0 }
  }
  return {
    isOnline: row.isOnline,
    maxChats: row.maxChats,
    activeChats: row.activeChats,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/lib/admin/support.test.ts
```

Expected: PASS — all loader/guard/range/trend assertions succeed.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR (do NOT merge — the controller merges)**

```bash
git add lib/admin/support.ts tests/unit/lib/admin/support.test.ts
git commit -m "feat(admin-v2): add lib/admin/support data layer (Phase 9 W2)"
git push -u origin HEAD:wave9p9/task-2-data-layer
gh pr create --title "feat(admin-v2): Phase 9 W2 support data layer" --body "Adds lib/admin/support.ts: range/trend helpers, SLA constants, KPI + 5-tab loaders, ticket detail loaders, canned + agent loaders, activity timeline, live-chat loaders, and resolveAdminUserId (Customer.id -> email -> AdminUser.id). Full unit suite passing."
```

**Parallel-safe with Task 3. Wait for the controller to merge before Wave 3+.**

---

### Task 3: `app/admin/support/actions.ts` server actions

**Wave:** 2 | **Parallel-safe with:** Task 2 | **Branch:** `wave9p9/task-3-server-actions` | **Model:** sonnet

**Schema realities for this task:**
- `requireAdmin()` (no-arg) returns the session `userId` (= `Customer.id`) as a `string`. `requireAdminRole('SUPER_ADMIN')` returns the same and throws if `Customer.adminRole !== 'SUPER_ADMIN'`. Both from `@/lib/auth/admin`. `AdminRole` enum includes `SUPER_ADMIN` (confirmed line 1529).
- **SUPER_ADMIN-gated actions:** `issueRefund`, `bulkCloseTickets`. Every other mutation accepts plain ADMIN.
- The current agent's `AdminUser.id` (for `assignedToId`, `resolvedBy`, `LiveChatSession.adminId`, `AdminAvailability.adminId`) is resolved via `resolveAdminUserId(sessionUserId)` from `@/lib/admin/support` — the Customer→email→AdminUser mapping (no `AdminUser.customerId` field exists).
- `SupportMessage` insert columns: `ticketId, message (the body), isInternal, senderType ('admin'), senderId? (the AdminUser.id), senderName, attachments?`. There is **no `body` column** — write to `message`.
- `firstRespondedAt` is set ONLY on the FIRST **public** (non-internal) admin message. Guard: `update where { id, firstRespondedAt: null }` after confirming the new message is public + admin (atomic set-once; safe under concurrency).
- `SupportTicket.status` enum: `OPEN | IN_PROGRESS | WAITING_CUSTOMER | ESCALATED | RESOLVED | CLOSED`. `resolveTicket` sets `status='RESOLVED', resolvedAt, resolvedBy, resolution`. `closeTicket` sets `status='CLOSED'`. `escalateTicket` sets `status='ESCALATED'`. `assignTicket` sets `assignedToId` + `assignedAt` (null clears both).
- Reopen-on-reply: a **public** reply to a `RESOLVED`/`CLOSED` ticket flips it back to `IN_PROGRESS` (mirrors the existing customer-facing reopen behavior in `lib/support/refund-helpers.ts` precedent of re-touching status on activity).
- **Return/refund helpers** (`@/lib/support/refund-helpers`): the real exports are `checkRefundEligibility(orderId)`, `generateReturnLabel(orderId)` (wraps EasyPost `createReturnLabel`), and `initiateRefund({ ticketId, orderId, amount, reason })`. There is **no `processRefund` or `createReturnLabel` export from refund-helpers** — `approveReturn` calls `generateReturnLabel`; `issueRefund` calls `initiateRefund`. `RefundRecord` rows are written by `issueRefund` itself (the helper does not write RefundRecord), with `createdById = sessionUserId` (a `Customer.id`, matching `RefundRecord.createdById`'s "RefundCreatedBy" Customer relation) and `orderId` from the ticket.
- **Refund idempotency:** before processing, check for an existing `RefundRecord` whose `reason` carries the per-call idempotency key (`reason` embeds `[idem:<key>]`); skip if already present. `key = idem-${ticketId}-${amount}-${type}` per call so an accidental double-submit of the same refund is a no-op.
- `CannedResponse` insert columns: `title, body, category?, createdById (= sessionUserId)`. `deleteCannedResponse` is **soft** (`isActive=false`).
- Live chat: `acceptChatSession` sets `status='ACTIVE', adminId, acceptedAt` + increments `AdminAvailability.activeChats`. `closeChatSession` sets `status='CLOSED', closedAt, duration` + decrements `activeChats` (floored at 0). `sendChatMessage` writes a `LiveChatMessage` from admin (`senderType='admin'`). `setAgentAvailability` upserts `AdminAvailability` keyed by `adminId`.
- All mutations `revalidatePath('/admin/support')` + `revalidatePath('/admin/support/tickets')`; ticket-scoped ops also `revalidatePath('/admin/support/tickets/${ticketId}')`. `ActionResult = { ok: true; data? } | { ok: false; error: string }`.

**Files:**
- Create: `app/admin/support/actions.ts`
- Test: `tests/unit/app/admin/support/actions.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/admin/support/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ticketFindUnique = vi.fn()
const ticketUpdate = vi.fn()
const ticketUpdateMany = vi.fn()
const messageCreate = vi.fn()
const messageCount = vi.fn()
const cannedCreate = vi.fn()
const cannedUpdate = vi.fn()
const customerFindUnique = vi.fn()
const adminUserFindUnique = vi.fn()
const chatSessionFindUnique = vi.fn()
const chatSessionUpdate = vi.fn()
const chatMessageCreate = vi.fn()
const availabilityUpsert = vi.fn()
const availabilityUpdate = vi.fn()
const availabilityFindUnique = vi.fn()
const refundFindFirst = vi.fn()
const refundCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: {
      findUnique: ticketFindUnique,
      update: ticketUpdate,
      updateMany: ticketUpdateMany,
    },
    supportMessage: { create: messageCreate, count: messageCount },
    cannedResponse: { create: cannedCreate, update: cannedUpdate },
    customer: { findUnique: customerFindUnique },
    adminUser: { findUnique: adminUserFindUnique },
    liveChatSession: { findUnique: chatSessionFindUnique, update: chatSessionUpdate },
    liveChatMessage: { create: chatMessageCreate },
    adminAvailability: {
      upsert: availabilityUpsert,
      update: availabilityUpdate,
      findUnique: availabilityFindUnique,
    },
    refundRecord: { findFirst: refundFindFirst, create: refundCreate },
  },
}))

const requireAdmin = vi.fn()
const requireAdminRole = vi.fn()
vi.mock('@/lib/auth/admin', () => ({ requireAdmin, requireAdminRole }))

const checkRefundEligibility = vi.fn()
const generateReturnLabel = vi.fn()
const initiateRefund = vi.fn()
vi.mock('@/lib/support/refund-helpers', () => ({
  checkRefundEligibility,
  generateReturnLabel,
  initiateRefund,
}))

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath }))

beforeEach(() => {
  vi.clearAllMocks()
  requireAdmin.mockResolvedValue('cust-admin-1')
  requireAdminRole.mockResolvedValue('cust-admin-1')
  // Default identity resolution: Customer.id -> email -> AdminUser.id
  customerFindUnique.mockResolvedValue({ email: 'agent@hof.com', name: 'Agent A' })
  adminUserFindUnique.mockResolvedValue({ id: 'au1' })
})

describe('replyToTicket', () => {
  it('sets firstRespondedAt on the first public admin message', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      status: 'OPEN',
      firstRespondedAt: null,
    })
    messageCreate.mockResolvedValue({ id: 'm1' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { replyToTicket } = await import('@/app/admin/support/actions')
    const res = await replyToTicket('t1', 'hello there')
    expect(res.ok).toBe(true)
    expect(messageCreate.mock.calls[0][0].data.message).toBe('hello there')
    expect(messageCreate.mock.calls[0][0].data.isInternal).toBe(false)
    expect(messageCreate.mock.calls[0][0].data.senderType).toBe('admin')
    // first-response set-once guard
    const updateCall = ticketUpdate.mock.calls.find(
      (c) => c[0].where && c[0].where.firstRespondedAt === null,
    )
    expect(updateCall).toBeTruthy()
    expect(updateCall![0].data.firstRespondedAt).toBeInstanceOf(Date)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/support/tickets/t1')
  })

  it('does NOT set firstRespondedAt when already responded', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      status: 'IN_PROGRESS',
      firstRespondedAt: new Date(),
    })
    messageCreate.mockResolvedValue({ id: 'm2' })
    const { replyToTicket } = await import('@/app/admin/support/actions')
    await replyToTicket('t1', 'follow up')
    const frCall = ticketUpdate.mock.calls.find(
      (c) => c[0].data && 'firstRespondedAt' in c[0].data,
    )
    expect(frCall).toBeFalsy()
  })

  it('does NOT set firstRespondedAt for an internal reply', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', status: 'OPEN', firstRespondedAt: null })
    messageCreate.mockResolvedValue({ id: 'm3' })
    const { replyToTicket } = await import('@/app/admin/support/actions')
    await replyToTicket('t1', 'note', { isInternal: true })
    expect(messageCreate.mock.calls[0][0].data.isInternal).toBe(true)
    const frCall = ticketUpdate.mock.calls.find(
      (c) => c[0].data && 'firstRespondedAt' in c[0].data,
    )
    expect(frCall).toBeFalsy()
  })

  it('reopens a RESOLVED ticket on a public reply', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      status: 'RESOLVED',
      firstRespondedAt: new Date(),
    })
    messageCreate.mockResolvedValue({ id: 'm4' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { replyToTicket } = await import('@/app/admin/support/actions')
    await replyToTicket('t1', 'one more thing')
    const reopen = ticketUpdate.mock.calls.find(
      (c) => c[0].data && c[0].data.status === 'IN_PROGRESS',
    )
    expect(reopen).toBeTruthy()
  })

  it('rejects empty body', async () => {
    const { replyToTicket } = await import('@/app/admin/support/actions')
    const res = await replyToTicket('t1', '   ')
    expect(res.ok).toBe(false)
    expect(messageCreate).not.toHaveBeenCalled()
  })

  it('returns error when ticket not found', async () => {
    ticketFindUnique.mockResolvedValue(null)
    const { replyToTicket } = await import('@/app/admin/support/actions')
    const res = await replyToTicket('nope', 'hi')
    expect(res.ok).toBe(false)
  })
})

describe('addInternalNote', () => {
  it('creates an internal admin message and never sets firstRespondedAt', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', status: 'OPEN', firstRespondedAt: null })
    messageCreate.mockResolvedValue({ id: 'm5' })
    const { addInternalNote } = await import('@/app/admin/support/actions')
    const res = await addInternalNote('t1', 'private')
    expect(res.ok).toBe(true)
    expect(messageCreate.mock.calls[0][0].data.isInternal).toBe(true)
    const frCall = ticketUpdate.mock.calls.find(
      (c) => c[0].data && 'firstRespondedAt' in c[0].data,
    )
    expect(frCall).toBeFalsy()
  })
})

describe('setTicketStatus / escalate / resolve / close', () => {
  it('setTicketStatus updates status', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { setTicketStatus } = await import('@/app/admin/support/actions')
    const res = await setTicketStatus('t1', 'WAITING_CUSTOMER')
    expect(res.ok).toBe(true)
    expect(ticketUpdate.mock.calls[0][0].data.status).toBe('WAITING_CUSTOMER')
  })

  it('escalateTicket sets ESCALATED', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { escalateTicket } = await import('@/app/admin/support/actions')
    await escalateTicket('t1')
    expect(ticketUpdate.mock.calls[0][0].data.status).toBe('ESCALATED')
  })

  it('resolveTicket sets RESOLVED + resolvedAt + resolvedBy + resolution', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { resolveTicket } = await import('@/app/admin/support/actions')
    await resolveTicket('t1', 'Fixed it')
    const data = ticketUpdate.mock.calls[0][0].data
    expect(data.status).toBe('RESOLVED')
    expect(data.resolvedAt).toBeInstanceOf(Date)
    expect(data.resolution).toBe('Fixed it')
    expect(data.resolvedBy).toBeTruthy()
  })

  it('closeTicket sets CLOSED', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { closeTicket } = await import('@/app/admin/support/actions')
    await closeTicket('t1')
    expect(ticketUpdate.mock.calls[0][0].data.status).toBe('CLOSED')
  })
})

describe('assignTicket', () => {
  it('sets assignedToId + assignedAt', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { assignTicket } = await import('@/app/admin/support/actions')
    await assignTicket('t1', 'au2')
    const data = ticketUpdate.mock.calls[0][0].data
    expect(data.assignedToId).toBe('au2')
    expect(data.assignedAt).toBeInstanceOf(Date)
  })
  it('clears assignment with null', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { assignTicket } = await import('@/app/admin/support/actions')
    await assignTicket('t1', null)
    const data = ticketUpdate.mock.calls[0][0].data
    expect(data.assignedToId).toBeNull()
    expect(data.assignedAt).toBeNull()
  })
})

describe('bulk actions', () => {
  it('bulkAssign updates many with one batch', async () => {
    ticketUpdateMany.mockResolvedValue({ count: 2 })
    const { bulkAssign } = await import('@/app/admin/support/actions')
    const res = await bulkAssign(['t1', 't2'], 'au2')
    expect(res.ok).toBe(true)
    expect(ticketUpdateMany.mock.calls[0][0].where.id.in).toEqual(['t1', 't2'])
    expect(ticketUpdateMany.mock.calls[0][0].data.assignedToId).toBe('au2')
  })

  it('bulkSetStatus updates many', async () => {
    ticketUpdateMany.mockResolvedValue({ count: 2 })
    const { bulkSetStatus } = await import('@/app/admin/support/actions')
    await bulkSetStatus(['t1', 't2'], 'CLOSED')
    expect(ticketUpdateMany.mock.calls[0][0].data.status).toBe('CLOSED')
  })

  it('bulkCloseTickets requires SUPER_ADMIN', async () => {
    requireAdminRole.mockRejectedValueOnce(new Error('Unauthorized — requires role SUPER_ADMIN'))
    const { bulkCloseTickets } = await import('@/app/admin/support/actions')
    const res = await bulkCloseTickets(['t1'])
    expect(res.ok).toBe(false)
    expect(ticketUpdateMany).not.toHaveBeenCalled()
  })

  it('bulkCloseTickets closes when SUPER_ADMIN', async () => {
    ticketUpdateMany.mockResolvedValue({ count: 1 })
    const { bulkCloseTickets } = await import('@/app/admin/support/actions')
    const res = await bulkCloseTickets(['t1'])
    expect(requireAdminRole).toHaveBeenCalledWith('SUPER_ADMIN')
    expect(res.ok).toBe(true)
    expect(ticketUpdateMany.mock.calls[0][0].data.status).toBe('CLOSED')
  })
})

describe('approveReturn / denyReturn', () => {
  it('approveReturn without label only flips returnApproved', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { approveReturn } = await import('@/app/admin/support/actions')
    const res = await approveReturn('t1')
    expect(res.ok).toBe(true)
    expect(generateReturnLabel).not.toHaveBeenCalled()
    expect(ticketUpdate.mock.calls[0][0].data.returnApproved).toBe(true)
  })

  it('approveReturn with generateLabel calls generateReturnLabel + stores label', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    generateReturnLabel.mockResolvedValue({ labelUrl: 'https://label/abc' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { approveReturn } = await import('@/app/admin/support/actions')
    const res = await approveReturn('t1', { generateLabel: true })
    expect(res.ok).toBe(true)
    expect(generateReturnLabel).toHaveBeenCalledWith('o1')
    expect(ticketUpdate.mock.calls[0][0].data.returnLabel).toBe('https://label/abc')
  })

  it('approveReturn errors when no order linked', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: null })
    const { approveReturn } = await import('@/app/admin/support/actions')
    const res = await approveReturn('t1', { generateLabel: true })
    expect(res.ok).toBe(false)
    expect(generateReturnLabel).not.toHaveBeenCalled()
  })

  it('denyReturn sets returnApproved=false + reason', async () => {
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { denyReturn } = await import('@/app/admin/support/actions')
    const res = await denyReturn('t1', 'Out of window')
    expect(res.ok).toBe(true)
    expect(ticketUpdate.mock.calls[0][0].data.returnApproved).toBe(false)
  })
})

describe('issueRefund', () => {
  it('requires SUPER_ADMIN', async () => {
    requireAdminRole.mockRejectedValueOnce(new Error('Unauthorized — requires role SUPER_ADMIN'))
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 10, type: 'FULL', reason: 'damaged' })
    expect(res.ok).toBe(false)
    expect(initiateRefund).not.toHaveBeenCalled()
  })

  it('processes a refund + writes a RefundRecord with idempotency tag', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    refundFindFirst.mockResolvedValue(null) // no existing idempotent record
    initiateRefund.mockResolvedValue({ success: true, message: 'ok', refundId: 're_123' })
    refundCreate.mockResolvedValue({ id: 'rr1' })
    ticketUpdate.mockResolvedValue({ id: 't1' })
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 25, type: 'PARTIAL', reason: 'partial damage' })
    expect(requireAdminRole).toHaveBeenCalledWith('SUPER_ADMIN')
    expect(initiateRefund).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 't1', orderId: 'o1', amount: 25 }),
    )
    expect(refundCreate.mock.calls[0][0].data.reason).toContain('[idem:')
    expect(refundCreate.mock.calls[0][0].data.createdById).toBe('cust-admin-1')
    expect(res.ok).toBe(true)
  })

  it('is idempotent: skips when a matching RefundRecord already exists', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    refundFindFirst.mockResolvedValue({ id: 'rr-existing' })
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 25, type: 'PARTIAL', reason: 'partial damage' })
    expect(res.ok).toBe(true)
    expect(initiateRefund).not.toHaveBeenCalled()
    expect(refundCreate).not.toHaveBeenCalled()
  })

  it('errors when ticket has no order', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: null })
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 10, type: 'FULL', reason: 'x' })
    expect(res.ok).toBe(false)
    expect(initiateRefund).not.toHaveBeenCalled()
  })

  it('propagates a failed Stripe refund as an error', async () => {
    ticketFindUnique.mockResolvedValue({ id: 't1', orderId: 'o1' })
    refundFindFirst.mockResolvedValue(null)
    initiateRefund.mockResolvedValue({ success: false, message: 'card declined' })
    const { issueRefund } = await import('@/app/admin/support/actions')
    const res = await issueRefund('t1', { amount: 10, type: 'FULL', reason: 'x' })
    expect(res.ok).toBe(false)
    expect(refundCreate).not.toHaveBeenCalled()
  })
})

describe('canned response CRUD', () => {
  it('createCannedResponse stores createdById', async () => {
    cannedCreate.mockResolvedValue({ id: 'cr1' })
    const { createCannedResponse } = await import('@/app/admin/support/actions')
    const res = await createCannedResponse({ title: 'T', body: 'B', category: 'returns' })
    expect(res.ok).toBe(true)
    expect(cannedCreate.mock.calls[0][0].data.createdById).toBe('cust-admin-1')
    if (res.ok) expect(res.data?.id).toBe('cr1')
  })

  it('createCannedResponse rejects empty title/body', async () => {
    const { createCannedResponse } = await import('@/app/admin/support/actions')
    const res = await createCannedResponse({ title: '', body: '' })
    expect(res.ok).toBe(false)
    expect(cannedCreate).not.toHaveBeenCalled()
  })

  it('updateCannedResponse patches provided fields', async () => {
    cannedUpdate.mockResolvedValue({ id: 'cr1' })
    const { updateCannedResponse } = await import('@/app/admin/support/actions')
    await updateCannedResponse('cr1', { title: 'New', isActive: true })
    const data = cannedUpdate.mock.calls[0][0].data
    expect(data.title).toBe('New')
    expect(data.isActive).toBe(true)
    expect('body' in data).toBe(false)
  })

  it('deleteCannedResponse is a soft delete (isActive=false)', async () => {
    cannedUpdate.mockResolvedValue({ id: 'cr1' })
    const { deleteCannedResponse } = await import('@/app/admin/support/actions')
    const res = await deleteCannedResponse('cr1')
    expect(res.ok).toBe(true)
    expect(cannedUpdate.mock.calls[0][0].data).toEqual({ isActive: false })
  })
})

describe('live chat actions', () => {
  it('acceptChatSession activates + increments availability', async () => {
    chatSessionFindUnique.mockResolvedValue({ id: 's1', sessionId: 'sess-1', status: 'WAITING' })
    chatSessionUpdate.mockResolvedValue({ id: 's1' })
    availabilityUpdate.mockResolvedValue({ adminId: 'au1' })
    const { acceptChatSession } = await import('@/app/admin/support/actions')
    const res = await acceptChatSession('sess-1')
    expect(res.ok).toBe(true)
    const data = chatSessionUpdate.mock.calls[0][0].data
    expect(data.status).toBe('ACTIVE')
    expect(data.adminId).toBe('au1')
    expect(data.acceptedAt).toBeInstanceOf(Date)
    expect(availabilityUpdate.mock.calls[0][0].data.activeChats.increment).toBe(1)
  })

  it('closeChatSession closes + decrements availability', async () => {
    chatSessionFindUnique.mockResolvedValue({
      id: 's1',
      sessionId: 'sess-1',
      status: 'ACTIVE',
      adminId: 'au1',
      acceptedAt: new Date(Date.now() - 60_000),
    })
    chatSessionUpdate.mockResolvedValue({ id: 's1' })
    availabilityFindUnique.mockResolvedValue({ adminId: 'au1', activeChats: 2 })
    availabilityUpdate.mockResolvedValue({ adminId: 'au1' })
    const { closeChatSession } = await import('@/app/admin/support/actions')
    const res = await closeChatSession('sess-1')
    expect(res.ok).toBe(true)
    expect(chatSessionUpdate.mock.calls[0][0].data.status).toBe('CLOSED')
    expect(chatSessionUpdate.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date)
    expect(availabilityUpdate.mock.calls[0][0].data.activeChats).toBe(1)
  })

  it('sendChatMessage writes an admin LiveChatMessage', async () => {
    chatSessionFindUnique.mockResolvedValue({ id: 's1', sessionId: 'sess-1', status: 'ACTIVE' })
    chatMessageCreate.mockResolvedValue({ id: 'cm1' })
    const { sendChatMessage } = await import('@/app/admin/support/actions')
    const res = await sendChatMessage('sess-1', 'how can I help?')
    expect(res.ok).toBe(true)
    const data = chatMessageCreate.mock.calls[0][0].data
    expect(data.message).toBe('how can I help?')
    expect(data.senderType).toBe('admin')
    expect(data.sessionId).toBe('s1')
  })

  it('sendChatMessage rejects empty body', async () => {
    const { sendChatMessage } = await import('@/app/admin/support/actions')
    const res = await sendChatMessage('sess-1', '  ')
    expect(res.ok).toBe(false)
    expect(chatMessageCreate).not.toHaveBeenCalled()
  })

  it('setAgentAvailability upserts the availability row', async () => {
    availabilityUpsert.mockResolvedValue({ adminId: 'au1' })
    const { setAgentAvailability } = await import('@/app/admin/support/actions')
    const res = await setAgentAvailability({ isOnline: true, maxChats: 5 })
    expect(res.ok).toBe(true)
    const call = availabilityUpsert.mock.calls[0][0]
    expect(call.where).toEqual({ adminId: 'au1' })
    expect(call.create.isOnline).toBe(true)
    expect(call.create.maxChats).toBe(5)
    expect(call.update.isOnline).toBe(true)
  })

  it('setAgentAvailability errors when admin identity unresolved', async () => {
    customerFindUnique.mockResolvedValue({ email: 'ghost@hof.com', name: 'Ghost' })
    adminUserFindUnique.mockResolvedValue(null)
    const { setAgentAvailability } = await import('@/app/admin/support/actions')
    const res = await setAgentAvailability({ isOnline: true })
    expect(res.ok).toBe(false)
    expect(availabilityUpsert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/app/admin/support/actions.test.ts
```

Expected: FAIL — `Cannot find module '@/app/admin/support/actions'`.

- [ ] **Step 3: Implement `app/admin/support/actions.ts`**

```ts
// app/admin/support/actions.ts
'use server'

/**
 * Phase 9 — Admin Support Server Actions.
 *
 * Auth gates:
 *   - requireAdmin() (no-arg) for all reads + most writes.
 *   - requireAdminRole('SUPER_ADMIN') for: issueRefund, bulkCloseTickets.
 *
 * Admin identity:
 *   The session yields a Customer.id. Ticket assignment / chat adminId /
 *   availability are keyed by AdminUser.id, resolved via resolveAdminUserId
 *   (Customer.id -> Customer.email -> AdminUser.id). There is no
 *   AdminUser.customerId field.
 *
 * firstRespondedAt:
 *   Set ONLY on the first PUBLIC (non-internal) admin message, via an atomic
 *   `update where { id, firstRespondedAt: null }` set-once guard.
 *
 * Refund idempotency:
 *   issueRefund embeds an idempotency key in the RefundRecord.reason
 *   (`[idem:<key>]`). A matching existing record short-circuits to a no-op.
 *   The refund-helpers exports are checkRefundEligibility / generateReturnLabel
 *   / initiateRefund (there is no processRefund/createReturnLabel there).
 */

import { revalidatePath } from 'next/cache'
import type { SupportTicketStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import {
  checkRefundEligibility,
  generateReturnLabel,
  initiateRefund,
} from '@/lib/support/refund-helpers'

// ============================================================
// Return shape
// ============================================================

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const SUPPORT_PATH = '/admin/support'
const TICKETS_PATH = '/admin/support/tickets'

function revalidateSupport(ticketId?: string) {
  revalidatePath(SUPPORT_PATH)
  revalidatePath(TICKETS_PATH)
  if (ticketId) revalidatePath(`${TICKETS_PATH}/${ticketId}`)
}

const CLOSED_STATUSES: SupportTicketStatus[] = ['RESOLVED', 'CLOSED']

// Local copy of the identity resolution (parallel-safe with Task 2's
// lib/admin/support.ts, which executes on a separate branch). Refactor to a
// shared import deferred to Phase 9.5.
async function resolveAgent(): Promise<{ adminUserId: string | null; name: string }> {
  const sessionUserId = await requireAdmin()
  const customer = await prisma.customer.findUnique({
    where: { id: sessionUserId },
    select: { email: true, name: true },
  })
  const name = customer?.name?.trim() || customer?.email || 'Admin'
  if (!customer?.email) return { adminUserId: null, name }
  const admin = await prisma.adminUser.findUnique({
    where: { email: customer.email },
    select: { id: true },
  })
  return { adminUserId: admin?.id ?? null, name }
}

// ============================================================
// Input shapes
// ============================================================

export interface RefundInput {
  amount: number
  type: 'FULL' | 'PARTIAL' | 'SHIPPING_ONLY'
  reason: string
}

export interface CreateCannedInput {
  title: string
  body: string
  category?: string
}

export interface UpdateCannedPatch {
  title?: string
  body?: string
  category?: string
  isActive?: boolean
}

// ============================================================
// TICKET REPLIES + NOTES
// ============================================================

export async function replyToTicket(
  ticketId: string,
  body: string,
  opts?: { isInternal?: boolean },
): Promise<ActionResult> {
  const { name } = await resolveAgent()
  const sessionUserId = await requireAdmin()
  const trimmed = body?.trim() ?? ''
  if (trimmed.length === 0) {
    return { ok: false, error: 'Reply body is required' }
  }
  const isInternal = opts?.isInternal ?? false

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, firstRespondedAt: true },
  })
  if (!ticket) return { ok: false, error: 'Ticket not found' }

  try {
    await prisma.supportMessage.create({
      data: {
        ticketId,
        message: trimmed,
        isInternal,
        senderType: 'admin',
        senderId: sessionUserId,
        senderName: name,
      },
    })

    // Set firstRespondedAt only on the first PUBLIC admin message (atomic guard).
    if (!isInternal && ticket.firstRespondedAt === null) {
      await prisma.supportTicket.update({
        where: { id: ticketId, firstRespondedAt: null },
        data: { firstRespondedAt: new Date() },
      })
    }

    // Reopen a closed/resolved ticket on a public reply.
    if (!isInternal && CLOSED_STATUSES.includes(ticket.status)) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS' },
      })
    }

    revalidateSupport(ticketId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to reply' }
  }
}

export async function addInternalNote(ticketId: string, body: string): Promise<ActionResult> {
  return replyToTicket(ticketId, body, { isInternal: true })
}

// ============================================================
// TICKET STATUS / ASSIGNMENT
// ============================================================

export async function setTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status } })
    revalidateSupport(ticketId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to set status' }
  }
}

export async function assignTicket(
  ticketId: string,
  adminUserId: string | null,
): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedToId: adminUserId,
        assignedAt: adminUserId ? new Date() : null,
      },
    })
    revalidateSupport(ticketId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to assign ticket' }
  }
}

export async function escalateTicket(ticketId: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'ESCALATED' },
    })
    revalidateSupport(ticketId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to escalate' }
  }
}

export async function resolveTicket(ticketId: string, resolution: string): Promise<ActionResult> {
  const { name } = await resolveAgent()
  const trimmed = resolution?.trim() ?? ''
  if (trimmed.length === 0) {
    return { ok: false, error: 'A resolution summary is required' }
  }
  try {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: name,
        resolution: trimmed,
      },
    })
    revalidateSupport(ticketId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to resolve' }
  }
}

export async function closeTicket(ticketId: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED' },
    })
    revalidateSupport(ticketId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to close' }
  }
}

// ============================================================
// BULK ACTIONS
// ============================================================

export async function bulkAssign(
  ticketIds: string[],
  adminUserId: string,
): Promise<ActionResult> {
  await requireAdmin()
  if (ticketIds.length === 0) return { ok: false, error: 'No tickets selected' }
  try {
    await prisma.supportTicket.updateMany({
      where: { id: { in: ticketIds } },
      data: { assignedToId: adminUserId, assignedAt: new Date() },
    })
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to bulk assign' }
  }
}

export async function bulkSetStatus(
  ticketIds: string[],
  status: SupportTicketStatus,
): Promise<ActionResult> {
  await requireAdmin()
  if (ticketIds.length === 0) return { ok: false, error: 'No tickets selected' }
  try {
    await prisma.supportTicket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status },
    })
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to bulk set status' }
  }
}

export async function bulkCloseTickets(ticketIds: string[]): Promise<ActionResult> {
  try {
    await requireAdminRole('SUPER_ADMIN')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unauthorized' }
  }
  if (ticketIds.length === 0) return { ok: false, error: 'No tickets selected' }
  try {
    await prisma.supportTicket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status: 'CLOSED' },
    })
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to bulk close' }
  }
}

// ============================================================
// RETURN / REFUND
// ============================================================

export async function approveReturn(
  ticketId: string,
  opts?: { generateLabel?: boolean },
): Promise<ActionResult> {
  await requireAdmin()
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, orderId: true },
  })
  if (!ticket) return { ok: false, error: 'Ticket not found' }

  const data: Record<string, unknown> = { returnApproved: true, status: 'WAITING_CUSTOMER' }

  if (opts?.generateLabel) {
    if (!ticket.orderId) {
      return { ok: false, error: 'Cannot generate a return label without a linked order' }
    }
    try {
      const label = await generateReturnLabel(ticket.orderId)
      data.returnLabel = label.labelUrl
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to generate return label',
      }
    }
  }

  try {
    await prisma.supportTicket.update({ where: { id: ticketId }, data })
    revalidateSupport(ticketId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to approve return' }
  }
}

export async function denyReturn(ticketId: string, reason: string): Promise<ActionResult> {
  await requireAdmin()
  const trimmed = reason?.trim() ?? ''
  if (trimmed.length === 0) return { ok: false, error: 'A denial reason is required' }
  try {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { returnApproved: false, refundReason: trimmed },
    })
    revalidateSupport(ticketId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to deny return' }
  }
}

export async function issueRefund(ticketId: string, input: RefundInput): Promise<ActionResult> {
  let sessionUserId: string
  try {
    sessionUserId = await requireAdminRole('SUPER_ADMIN')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'Refund amount must be a positive number' }
  }
  if (!input.reason?.trim()) {
    return { ok: false, error: 'A refund reason is required' }
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, orderId: true },
  })
  if (!ticket) return { ok: false, error: 'Ticket not found' }
  if (!ticket.orderId) {
    return { ok: false, error: 'Cannot refund a ticket with no linked order' }
  }

  // Idempotency: a matching tagged RefundRecord makes this a no-op.
  const idemKey = `idem-${ticketId}-${input.amount}-${input.type}`
  const existing = await prisma.refundRecord.findFirst({
    where: { orderId: ticket.orderId, reason: { contains: `[idem:${idemKey}]` } },
    select: { id: true },
  })
  if (existing) {
    revalidateSupport(ticketId)
    return { ok: true, data: { refundRecordId: existing.id, idempotent: true } }
  }

  let stripeResult: { success: boolean; message: string; refundId?: string }
  try {
    stripeResult = await initiateRefund({
      ticketId,
      orderId: ticket.orderId,
      amount: input.amount,
      reason: input.reason.trim(),
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Refund processing failed' }
  }
  if (!stripeResult.success) {
    return { ok: false, error: stripeResult.message || 'Refund failed' }
  }

  try {
    const record = await prisma.refundRecord.create({
      data: {
        orderId: ticket.orderId,
        amount: input.amount,
        type: input.type,
        reason: `${input.reason.trim()} [idem:${idemKey}]`,
        stripeRefundId: stripeResult.refundId ?? null,
        createdById: sessionUserId,
      },
    })
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { refundAmount: input.amount, refundReason: input.reason.trim() },
    })
    revalidateSupport(ticketId)
    return { ok: true, data: { refundRecordId: record.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to record refund' }
  }
}

// ============================================================
// CANNED RESPONSES
// ============================================================

export async function createCannedResponse(
  input: CreateCannedInput,
): Promise<ActionResult<{ id: string }>> {
  const sessionUserId = await requireAdmin()
  const title = input.title?.trim() ?? ''
  const body = input.body?.trim() ?? ''
  if (title.length === 0 || body.length === 0) {
    return { ok: false, error: 'Title and body are required' }
  }
  try {
    const cr = await prisma.cannedResponse.create({
      data: {
        title,
        body,
        category: input.category?.trim() || null,
        createdById: sessionUserId,
      },
    })
    revalidateSupport()
    return { ok: true, data: { id: cr.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create response' }
  }
}

export async function updateCannedResponse(
  id: string,
  patch: UpdateCannedPatch,
): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  if (patch.title !== undefined) data.title = patch.title.trim()
  if (patch.body !== undefined) data.body = patch.body.trim()
  if (patch.category !== undefined) data.category = patch.category.trim() || null
  if (patch.isActive !== undefined) data.isActive = patch.isActive
  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'Nothing to update' }
  }
  try {
    await prisma.cannedResponse.update({ where: { id }, data })
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update response' }
  }
}

export async function deleteCannedResponse(id: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.cannedResponse.update({ where: { id }, data: { isActive: false } })
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete response' }
  }
}

// ============================================================
// LIVE CHAT
// ============================================================

export async function acceptChatSession(sessionId: string): Promise<ActionResult> {
  const { adminUserId } = await resolveAgent()
  if (!adminUserId) {
    return { ok: false, error: 'Could not resolve your admin identity' }
  }
  const session = await prisma.liveChatSession.findUnique({
    where: { sessionId },
    select: { id: true, status: true },
  })
  if (!session) return { ok: false, error: 'Chat session not found' }
  if (session.status !== 'WAITING') {
    return { ok: false, error: 'Chat session is no longer waiting' }
  }
  try {
    await prisma.liveChatSession.update({
      where: { sessionId },
      data: { status: 'ACTIVE', adminId: adminUserId, acceptedAt: new Date() },
    })
    await prisma.adminAvailability.update({
      where: { adminId: adminUserId },
      data: { activeChats: { increment: 1 } },
    })
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to accept chat' }
  }
}

export async function closeChatSession(sessionId: string): Promise<ActionResult> {
  await requireAdmin()
  const session = await prisma.liveChatSession.findUnique({
    where: { sessionId },
    select: { id: true, adminId: true, acceptedAt: true, status: true },
  })
  if (!session) return { ok: false, error: 'Chat session not found' }

  const duration = session.acceptedAt
    ? Math.max(0, Math.round((Date.now() - session.acceptedAt.getTime()) / 1000))
    : null

  try {
    await prisma.liveChatSession.update({
      where: { sessionId },
      data: { status: 'CLOSED', closedAt: new Date(), duration },
    })
    if (session.adminId) {
      const avail = await prisma.adminAvailability.findUnique({
        where: { adminId: session.adminId },
        select: { activeChats: true },
      })
      if (avail) {
        await prisma.adminAvailability.update({
          where: { adminId: session.adminId },
          data: { activeChats: Math.max(0, avail.activeChats - 1) },
        })
      }
    }
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to close chat' }
  }
}

export async function sendChatMessage(sessionId: string, body: string): Promise<ActionResult> {
  const { name } = await resolveAgent()
  const sessionUserId = await requireAdmin()
  const trimmed = body?.trim() ?? ''
  if (trimmed.length === 0) return { ok: false, error: 'Message body is required' }

  const session = await prisma.liveChatSession.findUnique({
    where: { sessionId },
    select: { id: true, status: true },
  })
  if (!session) return { ok: false, error: 'Chat session not found' }

  try {
    await prisma.liveChatMessage.create({
      data: {
        sessionId: session.id,
        message: trimmed,
        senderType: 'admin',
        senderId: sessionUserId,
        senderName: name,
      },
    })
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to send message' }
  }
}

export async function setAgentAvailability(input: {
  isOnline: boolean
  maxChats?: number
}): Promise<ActionResult> {
  const { adminUserId } = await resolveAgent()
  if (!adminUserId) {
    return { ok: false, error: 'Could not resolve your admin identity' }
  }
  const maxChats = input.maxChats ?? 3
  try {
    await prisma.adminAvailability.upsert({
      where: { adminId: adminUserId },
      create: {
        adminId: adminUserId,
        isOnline: input.isOnline,
        status: input.isOnline ? 'online' : 'offline',
        maxChats,
        activeChats: 0,
        lastSeenAt: new Date(),
      },
      update: {
        isOnline: input.isOnline,
        status: input.isOnline ? 'online' : 'offline',
        maxChats,
        lastSeenAt: new Date(),
      },
    })
    revalidateSupport()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update availability' }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/app/admin/support/actions.test.ts
```

Expected: PASS — auth gates, `firstRespondedAt` set-once, reopen-on-reply, bulk SUPER_ADMIN gate, return-label path, refund idempotency, canned soft-delete, and all live-chat assertions succeed.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR (do NOT merge — the controller merges)**

```bash
git add app/admin/support/actions.ts tests/unit/app/admin/support/actions.test.ts
git commit -m "feat(admin-v2): add app/admin/support server actions (Phase 9 W2)"
git push -u origin HEAD:wave9p9/task-3-server-actions
gh pr create --title "feat(admin-v2): Phase 9 W2 support server actions" --body "Adds app/admin/support/actions.ts: reply/note (firstRespondedAt set-once + reopen), status/assign/escalate/resolve/close, bulk (bulkCloseTickets SUPER_ADMIN), return approve/deny (generateReturnLabel), issueRefund (SUPER_ADMIN + initiateRefund + idempotent RefundRecord), canned CRUD (soft delete), and live-chat accept/close/send + availability upsert. Full unit suite passing."
```

**Parallel-safe with Task 2. Wait for the controller to merge before Wave 3+.**

---
## Wave 3 — List components (3 parallel, after W2 merged)

> **Worktree setup (every task):** worktrees have no `node_modules`. From the worktree root, symlink the repo's first: `ln -s <repo-root>/node_modules node_modules`. This repo uses **npm, NOT pnpm** — run single tests with `npx vitest run <path>` and typecheck with `npx tsc --noEmit`. Never run pnpm.

These three components are purely controlled: selection state (`Set<string>`) is owned by the parent `SupportTicketsListClient` (T22), not by the table/card. They consume the verbatim prop interfaces from the **Shared Contracts** section (`SupportTicketsListTableProps`, `SupportTicketsListCardMobileProps`, `SupportBulkSheetProps`) and the `TicketRow` / `AgentRow` row shapes. All three create disjoint files and are parallel-safe.

---

### Task 4: `SupportTicketsListTable.tsx` — desktop sticky-header table

**Wave:** 3 | **Parallel-safe with:** Tasks 5, 6 | **Branch:** `wave9p9/task-4-tickets-list-table` | **Model:** sonnet

**Schema realities for this task:**
- Desktop only (`hidden md:block`). Mobile uses `SupportTicketsListCardMobile` (Task 5).
- Columns: checkbox · ticket# · subject · customer · type · status pill · priority pill · age/SLA badge · assignee.
- Each row is a `<Link href={\`/admin/support/tickets/${row.id}\`}>` wrapped around the subject/ticket cell (no inspector intermediate). The checkbox `stopPropagation`s so toggling selection never navigates.
- Status pill + priority pill use color maps keyed off the Prisma enums (`SupportTicketStatus`, `SupportPriority`). Always-dark direct colors, no `dark:` modifiers.
- Age/SLA: render `ageHours` (e.g. `12h` / `3d`) plus an `Overdue` badge when `row.isOverdue` is true.
- Selected ids state is OWNED by the parent — props are `rows`, `selectedIds: Set<string>`, `onToggleSelection`, `onToggleAll`, `allSelected` (the `SupportTicketsListTableProps` contract, verbatim).
- Sort-by-column deferred; server already orders by priority/age in `loadSupportTab`.
- Use `import type` from `@/lib/admin/support` for `TicketRow` (no Prisma value-import in the client bundle).

**Files:**
- Create: `components/admin/support/SupportTicketsListTable.tsx`
- Test: `tests/unit/components/admin/support/SupportTicketsListTable.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/support/SupportTicketsListTable.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { SupportTicketsListTable } from '@/components/admin/support/SupportTicketsListTable'
import type { TicketRow } from '@/lib/admin/support'

const baseRow: TicketRow = {
  id: 't1',
  ticketNumber: 'TKT-2026-000123',
  subject: 'Where is my order?',
  type: 'ORDER_ISSUE',
  status: 'OPEN',
  priority: 'HIGH',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@e.com',
  assigneeId: null,
  assigneeName: null,
  createdAt: new Date('2026-06-18T08:00:00Z'),
  firstRespondedAt: null,
  ageHours: 12,
  isOverdue: false,
}

beforeEach(() => vi.clearAllMocks())

describe('SupportTicketsListTable', () => {
  it('renders ticket number, subject, customer, status and priority for each row', () => {
    render(
      <SupportTicketsListTable
        rows={[baseRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getByText('TKT-2026-000123')).toBeTruthy()
    expect(screen.getByText('Where is my order?')).toBeTruthy()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText(/open/i)).toBeTruthy()
    expect(screen.getByText(/high/i)).toBeTruthy()
  })

  it('row links to the ticket detail page', () => {
    render(
      <SupportTicketsListTable
        rows={[baseRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    const link = screen.getByRole('link', { name: /TKT-2026-000123/i })
    expect(link.getAttribute('href')).toBe('/admin/support/tickets/t1')
  })

  it('checkbox click toggles selection without navigating', () => {
    const onToggle = vi.fn()
    render(
      <SupportTicketsListTable
        rows={[baseRow]}
        selectedIds={new Set()}
        onToggleSelection={onToggle}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /select ticket TKT-2026-000123/i }))
    expect(onToggle).toHaveBeenCalledWith('t1')
  })

  it('header checkbox toggles all', () => {
    const onToggleAll = vi.fn()
    render(
      <SupportTicketsListTable
        rows={[baseRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={onToggleAll}
        allSelected={false}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /select all tickets/i }))
    expect(onToggleAll).toHaveBeenCalled()
  })

  it('shows an Overdue badge only when row.isOverdue is true', () => {
    const { rerender } = render(
      <SupportTicketsListTable
        rows={[baseRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.queryByText(/overdue/i)).toBeNull()

    rerender(
      <SupportTicketsListTable
        rows={[{ ...baseRow, isOverdue: true }]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getByText(/overdue/i)).toBeTruthy()
  })

  it('shows assignee name or an em-dash when unassigned', () => {
    const { rerender } = render(
      <SupportTicketsListTable
        rows={[baseRow]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)

    rerender(
      <SupportTicketsListTable
        rows={[{ ...baseRow, assigneeId: 'a1', assigneeName: 'Grace' }]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getByText('Grace')).toBeTruthy()
  })

  it('empty state when rows is empty', () => {
    render(
      <SupportTicketsListTable
        rows={[]}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
        onToggleAll={() => {}}
        allSelected={false}
      />,
    )
    expect(screen.getByText(/no tickets/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npx vitest run tests/unit/components/admin/support/SupportTicketsListTable.test.tsx` — expect "Failed to resolve import '@/components/admin/support/SupportTicketsListTable'" (module not found).

- [ ] **Step 3: Write `components/admin/support/SupportTicketsListTable.tsx`**

```tsx
'use client'

/**
 * SupportTicketsListTable — desktop ticket list for the admin Support page.
 *
 * Renders a sticky-header table of TicketRow items with:
 *   - Checkbox bulk-select (header select-all + per-row)
 *   - Ticket number + subject (each row links to the ticket detail page)
 *   - Customer name + email sub-line
 *   - Type label
 *   - Status pill (color-coded)
 *   - Priority pill (color-coded)
 *   - Age + SLA "Overdue" badge (when row.isOverdue)
 *   - Assignee name (or em-dash when unassigned)
 *   - Loading skeletons + empty state
 *
 * Phase 9 Task 4 — desktop only (hidden md:block).
 * Mobile card list is a separate component (Task 5).
 *
 * Selection state is OWNED by parent — this component is purely controlled.
 */

import Link from 'next/link'
import type { TicketRow } from '@/lib/admin/support'
import type { SupportTicketStatus, SupportPriority, SupportTicketType } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupportTicketsListTableProps {
  /** Rows to render. */
  rows: TicketRow[]
  /** Currently selected ticket ids. */
  selectedIds: Set<string>
  /** Toggle a single row's selection. Called with ticketId. */
  onToggleSelection: (id: string) => void
  /** Toggle select-all. */
  onToggleAll: () => void
  /** Whether all visible rows are currently selected. */
  allSelected: boolean
  /** Show loading skeleton rows instead of data. */
  loading?: boolean
  /** Number of skeleton rows while loading. Default: 8. */
  skeletonRows?: number
}

// ─── Color maps + helpers ───────────────────────────────────────────────────────

const STATUS_PILL: Record<SupportTicketStatus, { bg: string; fg: string }> = {
  OPEN: { bg: 'rgba(59,130,246,0.15)', fg: '#93C5FD' }, // blue
  IN_PROGRESS: { bg: 'rgba(168,85,247,0.15)', fg: '#D8B4FE' }, // purple
  WAITING_CUSTOMER: { bg: 'rgba(245,158,11,0.15)', fg: '#FCD34D' }, // amber
  ESCALATED: { bg: 'rgba(239,68,68,0.15)', fg: '#FCA5A5' }, // red
  RESOLVED: { bg: 'rgba(34,197,94,0.15)', fg: '#86EFAC' }, // green
  CLOSED: { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.45)' }, // neutral
}

const PRIORITY_PILL: Record<SupportPriority, { bg: string; fg: string }> = {
  LOW: { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.55)' },
  MEDIUM: { bg: 'rgba(59,130,246,0.15)', fg: '#93C5FD' },
  HIGH: { bg: 'rgba(245,158,11,0.15)', fg: '#FCD34D' },
  URGENT: { bg: 'rgba(239,68,68,0.18)', fg: '#FCA5A5' },
}

const TYPE_LABEL: Record<SupportTicketType, string> = {
  REFUND: 'Refund',
  RETURN: 'Return',
  EXCHANGE: 'Exchange',
  ORDER_ISSUE: 'Order Issue',
  PRODUCT_QUESTION: 'Product Q',
  SHIPPING_ISSUE: 'Shipping',
  PAYMENT_ISSUE: 'Payment',
  GENERAL: 'General',
}

function formatStatus(s: SupportTicketStatus): string {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatAge(hours: number): string {
  if (hours < 1) return '<1h'
  if (hours < 48) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-3 py-3 w-10">
        <div className="w-4 h-4 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1.5">
          <div className="h-3 w-32 bg-white/5 animate-pulse rounded" />
          <div className="h-2.5 w-44 bg-white/5 animate-pulse rounded" />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-white/5 animate-pulse rounded" />
          <div className="h-2.5 w-28 bg-white/5 animate-pulse rounded" />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-16 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-5 w-16 bg-white/5 animate-pulse rounded-full" />
      </td>
      <td className="px-3 py-3">
        <div className="h-5 w-14 bg-white/5 animate-pulse rounded-full" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-12 bg-white/5 animate-pulse rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Desktop-only support tickets table.
 * Hidden on mobile via `hidden md:block` — pair with SupportTicketsListCardMobile for small viewports.
 */
export function SupportTicketsListTable({
  rows,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  allSelected,
  loading = false,
  skeletonRows = 8,
}: SupportTicketsListTableProps) {
  // Empty state (not loading, no rows)
  if (!loading && rows.length === 0) {
    return (
      <div className="hidden md:flex items-center justify-center py-16 border border-white/8 rounded-lg bg-neutral-900/40">
        <p className="text-sm text-white/35">No tickets match the current filter.</p>
      </div>
    )
  }

  return (
    <div className="hidden md:block bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          {/* ── Header ────────────────────────────────────────────────────── */}
          <thead className="bg-white/[0.02] sticky top-0 z-10">
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2.5 w-10 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Select all tickets"
                  className="w-4 h-4 cursor-pointer accent-red-500"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Ticket
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Customer
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Type
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Priority
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Age
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40">
                Assignee
              </th>
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-white/[0.04]">
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => <SkeletonRow key={i} />)
              : rows.map((row) => {
                  const isSelected = selectedIds.has(row.id)
                  const status = STATUS_PILL[row.status]
                  const priority = PRIORITY_PILL[row.priority]
                  return (
                    <tr
                      key={row.id}
                      data-testid="support-table-row"
                      className={[
                        'transition-colors group',
                        isSelected
                          ? 'bg-red-500/[0.04] shadow-[inset_2px_0_0_theme(colors.red.500)]'
                          : 'hover:bg-white/[0.02]',
                      ].join(' ')}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelection(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ticket ${row.ticketNumber}`}
                          className="w-4 h-4 cursor-pointer accent-red-500"
                        />
                      </td>

                      {/* Ticket number + subject (link to detail) */}
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/support/tickets/${row.id}`}
                          aria-label={`Open ticket ${row.ticketNumber}`}
                          className="block text-left"
                        >
                          <div className="font-mono text-[10px] text-white/45 leading-tight">
                            {row.ticketNumber}
                          </div>
                          <div className="font-medium text-[11px] text-white mt-0.5 max-w-[260px] truncate">
                            {row.subject}
                          </div>
                        </Link>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-3">
                        <div className="text-[11px] text-white/80 leading-tight">
                          {row.customerName}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5 max-w-[180px] truncate">
                          {row.customerEmail}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-3 py-3 text-[11px] text-white/60 whitespace-nowrap">
                        {TYPE_LABEL[row.type]}
                      </td>

                      {/* Status pill */}
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: status.bg, color: status.fg }}
                        >
                          {formatStatus(row.status)}
                        </span>
                      </td>

                      {/* Priority pill */}
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: priority.bg, color: priority.fg }}
                        >
                          {row.priority.charAt(0) + row.priority.slice(1).toLowerCase()}
                        </span>
                      </td>

                      {/* Age + SLA overdue badge */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-white/60 tabular-nums">
                            {formatAge(row.ageHours)}
                          </span>
                          {row.isOverdue && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-red-500/15 text-red-300">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Assignee */}
                      <td className="px-3 py-3 text-[11px] text-white/70 whitespace-nowrap">
                        {row.assigneeName ?? <span className="text-white/25">—</span>}
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
npx vitest run tests/unit/components/admin/support/SupportTicketsListTable.test.tsx
npx tsc --noEmit
git add components/admin/support/SupportTicketsListTable.tsx tests/unit/components/admin/support/SupportTicketsListTable.test.tsx
git commit -m "feat(admin-v2): add SupportTicketsListTable (desktop sticky-header table)"
git push -u origin wave9p9/task-4-tickets-list-table
gh pr create --title "feat(admin-v2): Phase 9 W3 SupportTicketsListTable" --body "Desktop sticky-header table (hidden < md). Columns: checkbox · ticket# · subject · customer · type · status pill · priority pill · age/SLA badge · assignee. Each row links to /admin/support/tickets/[id]. Overdue badge when row.isOverdue. Selection owned by parent. 7 tests passing."
```

(Do not merge — leave the PR open for the W3 group merge.)

---

### Task 5: `SupportTicketsListCardMobile.tsx` — mobile card with long-press multi-select

**Wave:** 3 | **Parallel-safe with:** Tasks 4, 6 | **Branch:** `wave9p9/task-5-tickets-list-card-mobile` | **Model:** sonnet

**Schema realities for this task:**
- Visible only on mobile (`md:hidden`).
- Long-press (~500ms) toggles multi-select mode (mirrors Phase 8's `CustomersListCardMobile`). Once any row is selected, tap = toggle; otherwise tap = navigate to `/admin/support/tickets/${id}` via `useRouter().push`.
- A touchmove that drifts >5px cancels the pending long-press timer (avoids accidental selection during a scroll).
- Props are the verbatim `SupportTicketsListCardMobileProps` contract: `row`, `selectedIds: Set<string>`, `onToggleSelection`. No swipe action (no per-ticket quick action in v1 — unlike Phase 8 customers, the bulk sheet handles ticket actions).
- Shows: subject, ticket number, customer name, status pill, priority pill, age + an `Overdue` badge when `row.isOverdue`.
- Use `import type` from `@/lib/admin/support` for `TicketRow`.

**Files:**
- Create: `components/admin/support/SupportTicketsListCardMobile.tsx`
- Test: `tests/unit/components/admin/support/SupportTicketsListCardMobile.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/support/SupportTicketsListCardMobile.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { SupportTicketsListCardMobile } from '@/components/admin/support/SupportTicketsListCardMobile'
import type { TicketRow } from '@/lib/admin/support'

const row: TicketRow = {
  id: 't1',
  ticketNumber: 'TKT-2026-000123',
  subject: 'Where is my order?',
  type: 'ORDER_ISSUE',
  status: 'OPEN',
  priority: 'HIGH',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@e.com',
  assigneeId: null,
  assigneeName: null,
  createdAt: new Date('2026-06-18T08:00:00Z'),
  firstRespondedAt: null,
  ageHours: 12,
  isOverdue: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

describe('SupportTicketsListCardMobile', () => {
  it('renders subject, ticket number and customer name', () => {
    render(
      <SupportTicketsListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
      />,
    )
    expect(screen.getByText('Where is my order?')).toBeTruthy()
    expect(screen.getByText('TKT-2026-000123')).toBeTruthy()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
  })

  it('tap navigates when nothing is selected', () => {
    render(
      <SupportTicketsListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open ticket TKT-2026-000123/i }))
    expect(pushMock).toHaveBeenCalledWith('/admin/support/tickets/t1')
  })

  it('tap toggles selection when other rows are selected', () => {
    const onToggle = vi.fn()
    render(
      <SupportTicketsListCardMobile
        row={row}
        selectedIds={new Set(['otherId'])}
        onToggleSelection={onToggle}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /open ticket TKT-2026-000123/i }))
    expect(onToggle).toHaveBeenCalledWith('t1')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('long press enters multi-select on this card', () => {
    const onToggle = vi.fn()
    render(
      <SupportTicketsListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={onToggle}
      />,
    )
    const btn = screen.getByRole('button', { name: /open ticket TKT-2026-000123/i })
    fireEvent.touchStart(btn, { touches: [{ clientX: 0, clientY: 0 }] })
    act(() => {
      vi.advanceTimersByTime(550)
    })
    fireEvent.touchEnd(btn)
    expect(onToggle).toHaveBeenCalledWith('t1')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('long press does not fire when cancelled by a touch move', () => {
    const onToggle = vi.fn()
    render(
      <SupportTicketsListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={onToggle}
      />,
    )
    const btn = screen.getByRole('button', { name: /open ticket TKT-2026-000123/i })
    fireEvent.touchStart(btn, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(btn, { touches: [{ clientX: 40, clientY: 0 }] })
    act(() => {
      vi.advanceTimersByTime(550)
    })
    fireEvent.touchEnd(btn)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('shows an Overdue badge only when row.isOverdue is true', () => {
    const { rerender } = render(
      <SupportTicketsListCardMobile
        row={row}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
      />,
    )
    expect(screen.queryByText(/overdue/i)).toBeNull()

    rerender(
      <SupportTicketsListCardMobile
        row={{ ...row, isOverdue: true }}
        selectedIds={new Set()}
        onToggleSelection={() => {}}
      />,
    )
    expect(screen.getByText(/overdue/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npx vitest run tests/unit/components/admin/support/SupportTicketsListCardMobile.test.tsx` — expect "Failed to resolve import '@/components/admin/support/SupportTicketsListCardMobile'" (module not found).

- [ ] **Step 3: Write `components/admin/support/SupportTicketsListCardMobile.tsx`**

```tsx
'use client'

/**
 * SupportTicketsListCardMobile — mobile ticket card for the admin Support page.
 *
 * Visible only < md (md:hidden). Long-press (~500ms) toggles multi-select like
 * Phase 8's CustomersListCardMobile; tap navigates to the ticket detail page
 * when no rows are selected, otherwise tap toggles this card's selection.
 *
 * Selection state is OWNED by parent — purely controlled.
 * Phase 9 Task 5.
 */

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { TicketRow } from '@/lib/admin/support'
import type { SupportTicketStatus, SupportPriority } from '@prisma/client'

// ── constants ───────────────────────────────────────────────────────────────

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 5

// ── types ───────────────────────────────────────────────────────────────────

export interface SupportTicketsListCardMobileProps {
  row: TicketRow
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
}

// ── color maps + helpers ─────────────────────────────────────────────────────

const STATUS_PILL: Record<SupportTicketStatus, { bg: string; fg: string }> = {
  OPEN: { bg: 'rgba(59,130,246,0.15)', fg: '#93C5FD' },
  IN_PROGRESS: { bg: 'rgba(168,85,247,0.15)', fg: '#D8B4FE' },
  WAITING_CUSTOMER: { bg: 'rgba(245,158,11,0.15)', fg: '#FCD34D' },
  ESCALATED: { bg: 'rgba(239,68,68,0.15)', fg: '#FCA5A5' },
  RESOLVED: { bg: 'rgba(34,197,94,0.15)', fg: '#86EFAC' },
  CLOSED: { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.45)' },
}

const PRIORITY_PILL: Record<SupportPriority, { bg: string; fg: string }> = {
  LOW: { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.55)' },
  MEDIUM: { bg: 'rgba(59,130,246,0.15)', fg: '#93C5FD' },
  HIGH: { bg: 'rgba(245,158,11,0.15)', fg: '#FCD34D' },
  URGENT: { bg: 'rgba(239,68,68,0.18)', fg: '#FCA5A5' },
}

function formatStatus(s: SupportTicketStatus): string {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatAge(hours: number): string {
  if (hours < 1) return '<1h'
  if (hours < 48) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

// ── component ───────────────────────────────────────────────────────────────

export function SupportTicketsListCardMobile({
  row,
  selectedIds,
  onToggleSelection,
}: SupportTicketsListCardMobileProps) {
  const router = useRouter()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const touchStartX = useRef<number | null>(null)

  const inMultiSelect = selectedIds.size > 0
  const isSelected = selectedIds.has(row.id)
  const status = STATUS_PILL[row.status]
  const priority = PRIORITY_PILL[row.priority]

  const handleTap = () => {
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    if (inMultiSelect) onToggleSelection(row.id)
    else router.push(`/admin/support/tickets/${row.id}`)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    longPressed.current = false
    touchStartX.current = e.touches[0]?.clientX ?? null
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true
      onToggleSelection(row.id)
    }, LONG_PRESS_MS)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = (e.touches[0]?.clientX ?? 0) - touchStartX.current
    if (Math.abs(dx) > MOVE_CANCEL_PX && longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStartX.current = null
  }

  return (
    <div className="md:hidden relative overflow-hidden rounded-md border border-white/8 bg-neutral-900/60">
      <button
        type="button"
        aria-label={`Open ticket ${row.ticketNumber}`}
        aria-pressed={isSelected}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`block w-full text-left p-3 ${isSelected ? 'bg-white/[0.06]' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{row.subject}</div>
            <div className="text-[10px] font-mono text-white/40 mt-0.5">{row.ticketNumber}</div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: status.bg, color: status.fg }}
            >
              {formatStatus(row.status)}
            </span>
            {row.isOverdue && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide bg-red-500/15 text-red-300">
                Overdue
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-white/60">
          <span className="truncate">{row.customerName}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: priority.bg, color: priority.fg }}
            >
              {row.priority.charAt(0) + row.priority.slice(1).toLowerCase()}
            </span>
            <span className="tabular-nums text-white/45">{formatAge(row.ageHours)}</span>
          </div>
        </div>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
npx vitest run tests/unit/components/admin/support/SupportTicketsListCardMobile.test.tsx
npx tsc --noEmit
git add components/admin/support/SupportTicketsListCardMobile.tsx tests/unit/components/admin/support/SupportTicketsListCardMobile.test.tsx
git commit -m "feat(admin-v2): add SupportTicketsListCardMobile (long-press multi-select)"
git push -u origin wave9p9/task-5-tickets-list-card-mobile
gh pr create --title "feat(admin-v2): Phase 9 W3 SupportTicketsListCardMobile" --body "Mobile ticket card (md:hidden). Long-press 500ms enters multi-select like Phase 8; tap navigates to /admin/support/tickets/[id] when no selection, else toggles. Touch-move >5px cancels the long-press. Status/priority pills + Overdue badge. 6 tests passing."
```

(Do not merge — leave the PR open for the W3 group merge.)

---

### Task 6: `SupportBulkSheet.tsx` — bottom action sheet

**Wave:** 3 | **Parallel-safe with:** Tasks 4, 5 | **Branch:** `wave9p9/task-6-support-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- Visible when `selectedIds.length > 0` (driven through `BottomActionSheet`'s `open` prop).
- Props are the verbatim `SupportBulkSheetProps` contract: `selectedIds: string[]`, `agents: AgentRow[]`, `isSuperAdmin: boolean`, `onClear: () => void`.
- 3 actions:
  - **Assign** — opens an inline agent picker (`<select>` over `agents`); on confirm calls `bulkAssign(selectedIds, agentId)`.
  - **Set Status** — opens an inline status picker (`<select>` over the active `SupportTicketStatus` values); on confirm calls `bulkSetStatus(selectedIds, status)`.
  - **Close** — calls `bulkCloseTickets(selectedIds)`. **Gated by `isSuperAdmin`**: when `false`, the action is `disabled` with a tooltip ("Closing tickets in bulk requires SUPER_ADMIN"). The action's server-side `requireAdminRole('SUPER_ADMIN')` gate is the real enforcement; the disabled+tooltip is the UX hint.
- All three actions: on `{ ok: true }` show a success toast (`@/lib/toast`) and call `onClear()`; on `{ ok: false }` show `toast.error(r.error)`. Mutations run inside `useTransition`.
- Value-import the W2 server actions from `@/app/admin/support/actions` (server functions are callable from a `'use client'` file via Next.js Server Actions — this is NOT a Prisma value-import).
- Use `import type` from `@/lib/admin/support` for `AgentRow`, and `import type { SupportTicketStatus } from '@prisma/client'` (type-only).

**Files:**
- Create: `components/admin/support/SupportBulkSheet.tsx`
- Test: `tests/unit/components/admin/support/SupportBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/support/SupportBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Server action mocks ────────────────────────────────────────────────────

const bulkAssign = vi.fn()
const bulkSetStatus = vi.fn()
const bulkCloseTickets = vi.fn()

vi.mock('@/app/admin/support/actions', () => ({
  bulkAssign: (...a: unknown[]) => bulkAssign(...a),
  bulkSetStatus: (...a: unknown[]) => bulkSetStatus(...a),
  bulkCloseTickets: (...a: unknown[]) => bulkCloseTickets(...a),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({
    open,
    actions,
    onCancel,
  }: {
    open: boolean
    count: number
    actions: { label: string; onClick: () => void; disabled?: boolean; title?: string }[]
    onCancel: () => void
  }) =>
    open ? (
      <div data-testid="bottom-sheet">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} disabled={a.disabled} title={a.title}>
            {a.label}
          </button>
        ))}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}))

import { SupportBulkSheet } from '@/components/admin/support/SupportBulkSheet'
import type { AgentRow } from '@/lib/admin/support'

const agents: AgentRow[] = [
  { id: 'a1', name: 'Grace', openTicketCount: 2 },
  { id: 'a2', name: 'Alan', openTicketCount: 5 },
]

beforeEach(() => vi.clearAllMocks())

describe('SupportBulkSheet', () => {
  it('renders nothing when selectedIds is empty', () => {
    render(
      <SupportBulkSheet selectedIds={[]} agents={agents} isSuperAdmin onClear={() => {}} />,
    )
    expect(screen.queryByTestId('bottom-sheet')).toBeNull()
  })

  it('renders sheet with Assign / Set Status / Close when selectedIds has entries', () => {
    render(
      <SupportBulkSheet selectedIds={['t1', 't2']} agents={agents} isSuperAdmin onClear={() => {}} />,
    )
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^assign$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /set status/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^close$/i })).toBeTruthy()
  })

  it('Close button is disabled with tooltip when not SUPER_ADMIN', () => {
    render(
      <SupportBulkSheet selectedIds={['t1']} agents={agents} isSuperAdmin={false} onClear={() => {}} />,
    )
    const btn = screen.getByRole('button', { name: /^close$/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('title')).toMatch(/super[_ ]?admin/i)
  })

  it('Close button is enabled for SUPER_ADMIN', () => {
    render(
      <SupportBulkSheet selectedIds={['t1']} agents={agents} isSuperAdmin onClear={() => {}} />,
    )
    const btn = screen.getByRole('button', { name: /^close$/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('Assign opens an agent picker and calls bulkAssign then onClear on success', async () => {
    bulkAssign.mockResolvedValue({ ok: true })
    const onClear = vi.fn()
    render(
      <SupportBulkSheet selectedIds={['t1', 't2']} agents={agents} isSuperAdmin onClear={onClear} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^assign$/i }))

    const select = screen.getByLabelText(/assign to agent/i)
    fireEvent.change(select, { target: { value: 'a2' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm assign/i }))

    await waitFor(() => expect(bulkAssign).toHaveBeenCalledWith(['t1', 't2'], 'a2'))
    await waitFor(() => expect(onClear).toHaveBeenCalled())
  })

  it('Set Status opens a status picker and calls bulkSetStatus then onClear on success', async () => {
    bulkSetStatus.mockResolvedValue({ ok: true })
    const onClear = vi.fn()
    render(
      <SupportBulkSheet selectedIds={['t1']} agents={agents} isSuperAdmin onClear={onClear} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /set status/i }))

    const select = screen.getByLabelText(/set status to/i)
    fireEvent.change(select, { target: { value: 'RESOLVED' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm status/i }))

    await waitFor(() => expect(bulkSetStatus).toHaveBeenCalledWith(['t1'], 'RESOLVED'))
    await waitFor(() => expect(onClear).toHaveBeenCalled())
  })

  it('Close calls bulkCloseTickets then onClear on success', async () => {
    bulkCloseTickets.mockResolvedValue({ ok: true })
    const onClear = vi.fn()
    render(
      <SupportBulkSheet selectedIds={['t1', 't2']} agents={agents} isSuperAdmin onClear={onClear} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))

    await waitFor(() => expect(bulkCloseTickets).toHaveBeenCalledWith(['t1', 't2']))
    await waitFor(() => expect(onClear).toHaveBeenCalled())
  })

  it('shows an error toast when a bulk action fails', async () => {
    const { toast } = await import('@/lib/toast')
    bulkCloseTickets.mockResolvedValue({ ok: false, error: 'Not permitted' })
    render(
      <SupportBulkSheet selectedIds={['t1']} agents={agents} isSuperAdmin onClear={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not permitted'))
  })

  it('Cancel button calls onClear', () => {
    const onClear = vi.fn()
    render(
      <SupportBulkSheet selectedIds={['t1']} agents={agents} isSuperAdmin onClear={onClear} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npx vitest run tests/unit/components/admin/support/SupportBulkSheet.test.tsx` — expect "Failed to resolve import '@/components/admin/support/SupportBulkSheet'" (module not found).

- [ ] **Step 3: Write `components/admin/support/SupportBulkSheet.tsx`**

```tsx
'use client'

/**
 * SupportBulkSheet
 *
 * Bottom-anchored action sheet listing 3 bulk actions for a selection of
 * tickets. Wires directly to server actions in app/admin/support/actions.ts.
 *
 * Actions:
 *  1. Assign      → inline agent <select>, then bulkAssign(selectedIds, agentId)
 *  2. Set Status  → inline status <select>, then bulkSetStatus(selectedIds, status)
 *  3. Close       → bulkCloseTickets(selectedIds); disabled + tooltip unless isSuperAdmin
 *
 * On success: toast.success + onClear(). On failure: toast.error(error).
 * Phase 9 Task 6 (Wave 3).
 */

import { useState, useTransition } from 'react'
import { UserPlus, Tag, XCircle } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import { bulkAssign, bulkSetStatus, bulkCloseTickets } from '@/app/admin/support/actions'
import type { AgentRow } from '@/lib/admin/support'
import type { SupportTicketStatus } from '@prisma/client'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SupportBulkSheetProps {
  /** IDs of currently selected tickets. Sheet is visible when length > 0. */
  selectedIds: string[]
  /** Assignable agents (id + name + open load) for the Assign picker. */
  agents: AgentRow[]
  /** Whether the current user is SUPER_ADMIN (gates bulk Close). */
  isSuperAdmin: boolean
  /** Called after a successful action (or cancel) so the parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SUPER_ADMIN_CLOSE_HINT = 'Closing tickets in bulk requires SUPER_ADMIN'

// Active statuses offered in the bulk Set-Status picker (CLOSED is its own dedicated action).
const STATUS_OPTIONS: { value: SupportTicketStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_CUSTOMER', label: 'Waiting on Customer' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'RESOLVED', label: 'Resolved' },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export function SupportBulkSheet({
  selectedIds,
  agents,
  isSuperAdmin,
  onClear,
}: SupportBulkSheetProps) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [agentId, setAgentId] = useState<string>('')
  const [status, setStatus] = useState<SupportTicketStatus>('IN_PROGRESS')
  const [isPending, startTransition] = useTransition()

  // ── 1. Assign ──────────────────────────────────────────────────────────────

  function handleAssign() {
    setStatusOpen(false)
    setAssignOpen((v) => !v)
  }

  function confirmAssign() {
    if (!agentId) {
      toast.error('Select an agent')
      return
    }
    startTransition(async () => {
      try {
        const r = await bulkAssign(selectedIds, agentId)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`Assigned ${selectedIds.length} tickets`)
        setAssignOpen(false)
        onClear()
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 2. Set Status ────────────────────────────────────────────────────────────

  function handleSetStatus() {
    setAssignOpen(false)
    setStatusOpen((v) => !v)
  }

  function confirmStatus() {
    startTransition(async () => {
      try {
        const r = await bulkSetStatus(selectedIds, status)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`Updated ${selectedIds.length} tickets`)
        setStatusOpen(false)
        onClear()
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 3. Close ───────────────────────────────────────────────────────────────

  function handleClose() {
    startTransition(async () => {
      try {
        const r = await bulkCloseTickets(selectedIds)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`Closed ${selectedIds.length} tickets`)
        onClear()
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <BottomActionSheet
        open={selectedIds.length > 0}
        count={selectedIds.length}
        onCancel={onClear}
        actions={[
          {
            label: 'Assign',
            icon: <UserPlus size={14} weight="bold" />,
            onClick: handleAssign,
            disabled: isPending,
          },
          {
            label: 'Set Status',
            icon: <Tag size={14} weight="bold" />,
            onClick: handleSetStatus,
            disabled: isPending,
          },
          {
            label: 'Close',
            icon: <XCircle size={14} weight="bold" />,
            onClick: handleClose,
            disabled: !isSuperAdmin || isPending,
            variant: 'destructive',
            title: isSuperAdmin ? undefined : SUPER_ADMIN_CLOSE_HINT,
          },
        ]}
      />

      {/* Inline Assign picker */}
      {assignOpen && selectedIds.length > 0 && (
        <div className="fixed bottom-[60px] inset-x-0 z-40 border-t border-white/8 bg-neutral-950/95 backdrop-blur px-4 py-3 flex items-center gap-2 flex-wrap">
          <label htmlFor="bulk-assign-agent" className="text-xs text-white/55">
            Assign to agent
          </label>
          <select
            id="bulk-assign-agent"
            aria-label="Assign to agent"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="flex-1 min-w-[160px] text-xs px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.openTicketCount} open)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={confirmAssign}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Confirm assign
          </button>
        </div>
      )}

      {/* Inline Set-Status picker */}
      {statusOpen && selectedIds.length > 0 && (
        <div className="fixed bottom-[60px] inset-x-0 z-40 border-t border-white/8 bg-neutral-950/95 backdrop-blur px-4 py-3 flex items-center gap-2 flex-wrap">
          <label htmlFor="bulk-set-status" className="text-xs text-white/55">
            Set status to
          </label>
          <select
            id="bulk-set-status"
            aria-label="Set status to"
            value={status}
            onChange={(e) => setStatus(e.target.value as SupportTicketStatus)}
            className="flex-1 min-w-[160px] text-xs px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={confirmStatus}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Confirm status
          </button>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
npx vitest run tests/unit/components/admin/support/SupportBulkSheet.test.tsx
npx tsc --noEmit
git add components/admin/support/SupportBulkSheet.tsx tests/unit/components/admin/support/SupportBulkSheet.test.tsx
git commit -m "feat(admin-v2): add SupportBulkSheet (Assign / Set Status / Close)"
git push -u origin wave9p9/task-6-support-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 9 W3 SupportBulkSheet" --body "Bottom action sheet for ticket selections. 3 actions: Assign (inline agent select → bulkAssign), Set Status (inline status select → bulkSetStatus), Close (bulkCloseTickets; disabled+tooltip unless isSuperAdmin). Success toast + onClear on ok; error toast on failure. 10 tests passing."
```

(Do not merge — leave the PR open for the W3 group merge.)

---
## Wave 4 — Detail widgets (5 parallel, after W2 merged)

> **Depends on:** W2 (Tasks 2 + 3) merged — `lib/admin/support.ts` exports all data types + loaders, `app/admin/support/actions.ts` exports all actions. Tasks 7-11 are **parallel-safe** (disjoint files). All five branch off `main` after W2 lands, each opens its own PR, and the controller merges them (do NOT merge yourself).
>
> **Worktree setup (every task in this wave):** use a dedicated git worktree so the five tasks don't collide. After creating the worktree, the new checkout has **no `node_modules`** — symlink the repo root's:
> ```bash
> git worktree add ../hof-wave9p9-task-N wave9p9/task-N-<short-name>
> cd ../hof-wave9p9-task-N
> ln -s <repo-root>/node_modules node_modules
> ```
> (Or use `EnterWorktree`/`ExitWorktree` if available — it handles the symlink.) **This repo uses npm, NOT pnpm.** Single-file test: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`. NEVER run pnpm (it writes a spurious `pnpm-lock.yaml`).
>
> **Cross-cutting reminders for this wave:**
> - **No `dark:` modifiers.** Always-dark, direct colors: `bg-neutral-900/60`, `border-white/8`, `text-white/50`, `text-white/30`.
> - **`import type`** for any `lib/admin/support` data types inside `'use client'` files (no Prisma value-imports in client bundles).
> - **Inspector-free detail widgets (Phase 8 lesson).** Tasks 7 and 10 expose action callbacks via props; they must NOT statically import any W5 inspector (`AssignAgentInspector`, `StatusChangeInspector`, `ReturnDecisionInspector`, `RefundInspector`). The W7 composition wave owns inspector open-state and wires the callbacks. Vite's static import-analysis resolves a `'use client'` module's imports BEFORE `vi.mock` can intercept, so importing a not-yet-merged inspector here would make this wave's tests un-passable. Keep these widgets inspector-free.
> - **Server vs client correct:** Task 7 (`TicketHeader`) and Task 10's client child (`TicketReturnRefundPanelClient`) are `'use client'` (interactive: ⋯ menu / action buttons). Tasks 8 (`TicketMessageThread`), 9 (`TicketCustomerContext`), 10's server wrapper, and 11 (`TicketActivityTimeline`) are **server** components (presentational / data-loading; no interactivity).
> - Prop interfaces are VERBATIM from **Shared Contracts → Component prop interfaces**. Data types are VERBATIM from **Shared Contracts → Detail shapes**.

---

### Task 7: `components/admin/support/detail/TicketHeader.tsx` — ticket header with ⋯ action menu

**Wave:** 4 | **Parallel-safe with:** Tasks 8-11 | **Branch:** `wave9p9/task-7-ticket-header` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `TicketHeaderProps = { header: TicketHeaderData; agents: AgentRow[]; isSuperAdmin: boolean }` (VERBATIM from Shared Contracts). `TicketHeaderData` carries: `id, ticketNumber, subject, type, status, priority, customerId, customerName, customerEmail, orderId, orderNumber, assigneeId, assigneeName, createdAt, firstRespondedAt, resolvedAt, ageHours, isOverdue, returnRequested, returnApproved, refundAmount`.
- Renders: subject (`h1`) + ticket number; type / status / priority pills; customer link → `/admin/customers/${customerId}` (plain text if `customerId` is null); order link → `/admin/fulfillment/${orderId}` when `orderId` present; assignee name (or "Unassigned"); age (`ageHours`) with an **Overdue** SLA badge when `isOverdue`.
- A `'use client'` component for the **⋯ menu** (owns `menuOpen` state). Menu items: **Assign**, **Change status**, **Escalate**, **Resolve**.
- **INSPECTOR-FREE (Phase 8 lesson — REQUIRED):** This header MUST NOT import any W5 inspector. The menu items fire optional callback props — `onAssign?`, `onStatus?`, `onEscalate?`, `onResolve?` — that the **W7 composition** (`AdminTicketDetailV2`) supplies; the composition owns the inspector open-state and renders the inspectors itself. Adopt the verified approach: header exposes action callbacks via props, composition owns inspector state. Buttons render disabled-gracefully when a callback is absent (still clickable/no-op so the unit test can assert wiring). The `agents` + `isSuperAdmin` props are passed through for the composition's benefit and to keep the prop interface VERBATIM; the header itself only needs them to gate menu items (Escalate hidden once `status === 'ESCALATED'`; Resolve hidden once already `RESOLVED`/`CLOSED`).
- Use `import type` from `@/lib/admin/support` for `TicketHeaderData` + `AgentRow`.

**Files:**
- Create: `components/admin/support/detail/TicketHeader.tsx`
- Test: `tests/unit/components/admin/support/detail/TicketHeader.test.tsx`

#### Steps

- [ ] **Step 1: Set up the worktree (see wave header) and write the failing test**

```tsx
// tests/unit/components/admin/support/detail/TicketHeader.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { TicketHeader } from '@/components/admin/support/detail/TicketHeader'
import type { TicketHeaderData, AgentRow } from '@/lib/admin/support'

const agents: AgentRow[] = [
  { id: 'a1', name: 'Agent Smith', openTicketCount: 3 },
  { id: 'a2', name: 'Agent Jones', openTicketCount: 1 },
]

const baseHeader: TicketHeaderData = {
  id: 't1',
  ticketNumber: 'TKT-2026-000123',
  subject: 'Where is my order?',
  type: 'ORDER_ISSUE',
  status: 'OPEN',
  priority: 'HIGH',
  customerId: 'c1',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@e.com',
  orderId: 'o1',
  orderNumber: 'HOF-100',
  assigneeId: 'a1',
  assigneeName: 'Agent Smith',
  createdAt: new Date('2026-06-18T08:00:00Z'),
  firstRespondedAt: null,
  resolvedAt: null,
  ageHours: 9,
  isOverdue: true,
  returnRequested: false,
  returnApproved: null,
  refundAmount: null,
}

beforeEach(() => vi.clearAllMocks())

describe('TicketHeader', () => {
  it('renders subject + ticket number', () => {
    render(<TicketHeader header={baseHeader} agents={agents} isSuperAdmin={false} />)
    expect(screen.getByText('Where is my order?')).toBeTruthy()
    expect(screen.getByText(/TKT-2026-000123/)).toBeTruthy()
  })

  it('renders type / status / priority pills', () => {
    render(<TicketHeader header={baseHeader} agents={agents} isSuperAdmin={false} />)
    expect(screen.getByText(/order issue/i)).toBeTruthy()
    expect(screen.getByText(/open/i)).toBeTruthy()
    expect(screen.getByText(/high/i)).toBeTruthy()
  })

  it('links customer to /admin/customers and order to /admin/fulfillment', () => {
    render(<TicketHeader header={baseHeader} agents={agents} isSuperAdmin={false} />)
    const custLink = screen.getByRole('link', { name: /ada lovelace/i })
    expect(custLink.getAttribute('href')).toBe('/admin/customers/c1')
    const orderLink = screen.getByRole('link', { name: /HOF-100/i })
    expect(orderLink.getAttribute('href')).toBe('/admin/fulfillment/o1')
  })

  it('renders customer as plain text (no link) when customerId is null', () => {
    render(
      <TicketHeader
        header={{ ...baseHeader, customerId: null }}
        agents={agents}
        isSuperAdmin={false}
      />,
    )
    expect(screen.queryByRole('link', { name: /ada lovelace/i })).toBeNull()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
  })

  it('renders assignee name', () => {
    render(<TicketHeader header={baseHeader} agents={agents} isSuperAdmin={false} />)
    expect(screen.getByText(/Agent Smith/)).toBeTruthy()
  })

  it('renders Overdue SLA badge when isOverdue is true', () => {
    render(<TicketHeader header={baseHeader} agents={agents} isSuperAdmin={false} />)
    expect(screen.getByText(/overdue/i)).toBeTruthy()
  })

  it('does NOT render Overdue badge when isOverdue is false', () => {
    render(
      <TicketHeader
        header={{ ...baseHeader, isOverdue: false }}
        agents={agents}
        isSuperAdmin={false}
      />,
    )
    expect(screen.queryByText(/overdue/i)).toBeNull()
  })

  it('fires onAssign callback from the ⋯ menu', () => {
    const onAssign = vi.fn()
    render(
      <TicketHeader
        header={baseHeader}
        agents={agents}
        isSuperAdmin={false}
        onAssign={onAssign}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /assign/i }))
    expect(onAssign).toHaveBeenCalledTimes(1)
  })

  it('fires onStatus / onEscalate / onResolve callbacks', () => {
    const onStatus = vi.fn()
    const onEscalate = vi.fn()
    const onResolve = vi.fn()
    render(
      <TicketHeader
        header={baseHeader}
        agents={agents}
        isSuperAdmin={false}
        onStatus={onStatus}
        onEscalate={onEscalate}
        onResolve={onResolve}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /change status/i }))
    expect(onStatus).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /escalate/i }))
    expect(onEscalate).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /resolve/i }))
    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  it('hides Escalate when already ESCALATED and Resolve when RESOLVED', () => {
    render(
      <TicketHeader
        header={{ ...baseHeader, status: 'ESCALATED' }}
        agents={agents}
        isSuperAdmin={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(screen.queryByRole('menuitem', { name: /escalate/i })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /resolve/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketHeader.test.tsx
```
Expect: module not found (`TicketHeader` does not exist yet).

- [ ] **Step 3: Write `components/admin/support/detail/TicketHeader.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TicketHeaderData, AgentRow } from '@/lib/admin/support'

const TYPE_LABEL: Record<string, string> = {
  REFUND: 'Refund',
  RETURN: 'Return',
  EXCHANGE: 'Exchange',
  ORDER_ISSUE: 'Order Issue',
  PRODUCT_QUESTION: 'Product Question',
  SHIPPING_ISSUE: 'Shipping Issue',
  PAYMENT_ISSUE: 'Payment Issue',
  GENERAL: 'General',
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_CUSTOMER: 'Waiting Customer',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

const STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-sky-500/20 text-sky-300',
  IN_PROGRESS: 'bg-indigo-500/20 text-indigo-300',
  WAITING_CUSTOMER: 'bg-amber-500/20 text-amber-300',
  ESCALATED: 'bg-red-500/20 text-red-300',
  RESOLVED: 'bg-emerald-500/20 text-emerald-300',
  CLOSED: 'bg-white/10 text-white/50',
}

const PRIORITY_CLASS: Record<string, string> = {
  LOW: 'bg-white/10 text-white/50',
  MEDIUM: 'bg-sky-500/20 text-sky-300',
  HIGH: 'bg-amber-500/20 text-amber-300',
  URGENT: 'bg-red-500/20 text-red-300',
}

export interface TicketHeaderProps {
  header: TicketHeaderData
  agents: AgentRow[]
  isSuperAdmin: boolean
  onAssign?: () => void
  onStatus?: () => void
  onEscalate?: () => void
  onResolve?: () => void
}

export function TicketHeader({
  header,
  onAssign,
  onStatus,
  onEscalate,
  onResolve,
}: TicketHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const isClosed = header.status === 'RESOLVED' || header.status === 'CLOSED'
  const isEscalated = header.status === 'ESCALATED'

  const run = (cb?: () => void) => {
    setMenuOpen(false)
    cb?.()
  }

  return (
    <div className="bg-neutral-900/60 border border-white/8 rounded-md p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-white text-lg font-semibold truncate">{header.subject}</h1>
          {header.isOverdue && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-semibold">
              Overdue
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-white/40">{header.ticketNumber}</div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/60 font-semibold">
            {TYPE_LABEL[header.type] ?? header.type}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${STATUS_CLASS[header.status] ?? 'bg-white/10 text-white/50'}`}
          >
            {STATUS_LABEL[header.status] ?? header.status}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${PRIORITY_CLASS[header.priority] ?? 'bg-white/10 text-white/50'}`}
          >
            {header.priority}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-white/60">
          <div className="truncate">
            {header.customerId ? (
              <Link
                href={`/admin/customers/${header.customerId}`}
                className="text-white/80 hover:text-white underline-offset-2 hover:underline"
              >
                {header.customerName}
              </Link>
            ) : (
              <span className="text-white/80">{header.customerName}</span>
            )}
          </div>
          <div className="truncate">
            {header.orderId ? (
              <Link
                href={`/admin/fulfillment/${header.orderId}`}
                className="text-white/80 hover:text-white underline-offset-2 hover:underline"
              >
                {header.orderNumber ?? 'Order'}
              </Link>
            ) : (
              <span className="text-white/30">No order</span>
            )}
          </div>
          <div>
            Assignee:{' '}
            <span className="text-white/80">{header.assigneeName ?? 'Unassigned'}</span>
          </div>
          <div>
            <span className="text-white/80">{header.ageHours}h</span> old
          </div>
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="More actions"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 text-white/60"
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-44 bg-neutral-900 border border-white/8 rounded-md shadow-lg z-10"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onAssign)}
              className="block w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/[0.04]"
            >
              Assign
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onStatus)}
              className="block w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/[0.04]"
            >
              Change status
            </button>
            {!isEscalated && !isClosed && (
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onEscalate)}
                className="block w-full text-left px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/10"
              >
                Escalate
              </button>
            )}
            {!isClosed && (
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onResolve)}
                className="block w-full text-left px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/10"
              >
                Resolve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

> **REQUIRED — do NOT import any W5 inspector here.** The ⋯ menu only fires `onAssign`/`onStatus`/`onEscalate`/`onResolve`. W7's `AdminTicketDetailV2` owns inspector open-state and renders `AssignAgentInspector`, `StatusChangeInspector`, etc., passing these callbacks. Keeping the header inspector-free is what makes this task's test pass in isolation (Phase 8 Vite static-import lesson).

- [ ] **Step 4: Verify + tsc + commit + push + PR (do NOT merge — the controller merges)**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketHeader.test.tsx
npx tsc --noEmit
git add components/admin/support/detail/TicketHeader.tsx tests/unit/components/admin/support/detail/TicketHeader.test.tsx
git commit -m "feat(admin-v2): add TicketHeader detail widget (pills + links + ⋯ action menu, inspector-free)"
git push -u origin wave9p9/task-7-ticket-header
gh pr create --title "feat(admin-v2): Phase 9 W4 TicketHeader" --body "Ticket detail header. Subject + ticket# + type/status/priority pills + customer/order links + assignee + age/Overdue SLA badge + ⋯ menu (Assign/Change status/Escalate/Resolve) firing callback props. Inspector-free per Phase 8 lesson — W7 composition wires inspectors. 10 tests passing."
```

---

### Task 8: `components/admin/support/detail/TicketMessageThread.tsx` — message thread

**Wave:** 4 | **Parallel-safe with:** Tasks 7, 9, 10, 11 | **Branch:** `wave9p9/task-8-message-thread` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `TicketMessageThreadProps = { messages: TicketMessageRow[] }` (VERBATIM). `TicketMessageRow = { id, body, isInternal, senderType, senderName, attachments: string[], createdAt }`. `senderType` is `"customer" | "admin"`.
- **Presentational, no interactivity → SERVER component** (no `'use client'`). It is rendered synchronously with already-loaded messages (the W7 detail root / a sibling server wrapper passes `messages` in), so it does NOT call a loader itself.
- Visual distinction (three variants):
  - **customer** (`senderType === 'customer'`, not internal): left-aligned, neutral bubble.
  - **admin public reply** (`senderType === 'admin'`, `!isInternal`): right-aligned, accent bubble.
  - **internal note** (`isInternal === true`): full-width amber "Internal note" bubble regardless of sender.
- Attachments: when `attachments.length > 0`, list each as a row (filename = last path segment) under the message body.
- Empty state when `messages.length === 0`.
- Use `import type` from `@/lib/admin/support` for `TicketMessageRow`.

**Files:**
- Create: `components/admin/support/detail/TicketMessageThread.tsx`
- Test: `tests/unit/components/admin/support/detail/TicketMessageThread.test.tsx`

#### Steps

- [ ] **Step 1: Set up the worktree (see wave header) and write the failing test**

```tsx
// tests/unit/components/admin/support/detail/TicketMessageThread.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TicketMessageThread } from '@/components/admin/support/detail/TicketMessageThread'
import type { TicketMessageRow } from '@/lib/admin/support'

const messages: TicketMessageRow[] = [
  {
    id: 'm1',
    body: 'Hi, my order never arrived.',
    isInternal: false,
    senderType: 'customer',
    senderName: 'Ada Lovelace',
    attachments: [],
    createdAt: new Date('2026-06-18T08:00:00Z'),
  },
  {
    id: 'm2',
    body: 'Sorry to hear that — checking now.',
    isInternal: false,
    senderType: 'admin',
    senderName: 'Agent Smith',
    attachments: ['https://cdn.example.com/uploads/receipt.png'],
    createdAt: new Date('2026-06-18T09:00:00Z'),
  },
  {
    id: 'm3',
    body: 'Flagging for escalation — repeat issue.',
    isInternal: true,
    senderType: 'admin',
    senderName: 'Agent Smith',
    attachments: [],
    createdAt: new Date('2026-06-18T09:05:00Z'),
  },
]

describe('TicketMessageThread', () => {
  it('renders all message bodies', () => {
    render(<TicketMessageThread messages={messages} />)
    expect(screen.getByText(/order never arrived/i)).toBeTruthy()
    expect(screen.getByText(/checking now/i)).toBeTruthy()
    expect(screen.getByText(/repeat issue/i)).toBeTruthy()
  })

  it('labels the internal note distinctly', () => {
    render(<TicketMessageThread messages={messages} />)
    expect(screen.getByText(/internal note/i)).toBeTruthy()
  })

  it('renders sender names', () => {
    render(<TicketMessageThread messages={messages} />)
    expect(screen.getAllByText(/Agent Smith/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Ada Lovelace/)).toBeTruthy()
  })

  it('lists attachments with the filename', () => {
    render(<TicketMessageThread messages={messages} />)
    const link = screen.getByRole('link', { name: /receipt\.png/i })
    expect(link.getAttribute('href')).toBe('https://cdn.example.com/uploads/receipt.png')
  })

  it('marks customer vs admin messages with distinguishable test ids', () => {
    render(<TicketMessageThread messages={messages} />)
    expect(screen.getByTestId('msg-customer-m1')).toBeTruthy()
    expect(screen.getByTestId('msg-admin-m2')).toBeTruthy()
    expect(screen.getByTestId('msg-internal-m3')).toBeTruthy()
  })

  it('renders empty state when there are no messages', () => {
    render(<TicketMessageThread messages={[]} />)
    expect(screen.getByText(/no messages/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketMessageThread.test.tsx
```
Expect: module not found.

- [ ] **Step 3: Write `components/admin/support/detail/TicketMessageThread.tsx`**

```tsx
import type { TicketMessageRow } from '@/lib/admin/support'

const tFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

function fileName(url: string): string {
  const clean = url.split('?')[0] ?? url
  const seg = clean.split('/').filter(Boolean).pop()
  return seg || url
}

function Attachments({ attachments }: { attachments: string[] }) {
  if (attachments.length === 0) return null
  return (
    <ul className="mt-2 space-y-1">
      {attachments.map((url) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white underline-offset-2 hover:underline"
          >
            📎 {fileName(url)}
          </a>
        </li>
      ))}
    </ul>
  )
}

export interface TicketMessageThreadProps {
  messages: TicketMessageRow[]
}

export function TicketMessageThread({ messages }: TicketMessageThreadProps) {
  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Conversation</h2>
        <span className="text-xs text-white/40">{messages.length} messages</span>
      </header>

      {messages.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No messages yet.</div>
      ) : (
        <ol className="p-3 space-y-3">
          {messages.map((m) => {
            if (m.isInternal) {
              return (
                <li key={m.id} data-testid={`msg-internal-${m.id}`}>
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                        Internal note
                      </span>
                      <span className="text-[11px] text-white/40">
                        {m.senderName} · {tFmt.format(m.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-white/80 whitespace-pre-wrap">{m.body}</p>
                    <Attachments attachments={m.attachments} />
                  </div>
                </li>
              )
            }

            const isAdmin = m.senderType === 'admin'
            return (
              <li
                key={m.id}
                data-testid={`msg-${isAdmin ? 'admin' : 'customer'}-${m.id}`}
                className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-md px-3 py-2 ${
                    isAdmin
                      ? 'bg-sky-500/15 border border-sky-500/30'
                      : 'bg-white/5 border border-white/8'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-white/70">
                      {m.senderName}
                    </span>
                    <span className="text-[11px] text-white/40">{tFmt.format(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">{m.body}</p>
                  <Attachments attachments={m.attachments} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + push + PR (do NOT merge)**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketMessageThread.test.tsx
npx tsc --noEmit
git add components/admin/support/detail/TicketMessageThread.tsx tests/unit/components/admin/support/detail/TicketMessageThread.test.tsx
git commit -m "feat(admin-v2): add TicketMessageThread widget (customer/admin/internal variants + attachments)"
git push -u origin wave9p9/task-8-message-thread
gh pr create --title "feat(admin-v2): Phase 9 W4 TicketMessageThread" --body "Ticket conversation thread. Customer (left) vs admin reply (right) vs internal-note (amber, full-width) visually distinct; attachments listed with filename links; empty state. Presentational server component. 6 tests passing."
```

---

### Task 9: `components/admin/support/detail/TicketCustomerContext.tsx` — sidebar context

**Wave:** 4 | **Parallel-safe with:** Tasks 7, 8, 10, 11 | **Branch:** `wave9p9/task-9-customer-context` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `TicketCustomerContextProps = { context: TicketCustomerContextData }` (VERBATIM). `TicketCustomerContextData = { customerId, customerName, customerEmail, tierName, totalSpent, totalOrders, orderId, orderNumber, orderTotal, otherTicketsCount }`.
- **Presentational sidebar snapshot → SERVER component** (no `'use client'`). The W7 detail root passes already-loaded `context` (via `loadTicketCustomerContext`) — this widget does NOT load itself (matches the prop interface, which gives it `context`, not `ticketId`).
- Renders: customer name + email + tier; LTV (`totalSpent`) + `totalOrders`; linked order summary (`orderNumber`, `orderTotal`); `otherTicketsCount`.
- Links: customer → `/admin/customers/${customerId}` (plain text if `customerId` null); linked order → `/admin/fulfillment/${orderId}` (only when `orderId` present).
- Use `import type` from `@/lib/admin/support` for `TicketCustomerContextData`.

**Files:**
- Create: `components/admin/support/detail/TicketCustomerContext.tsx`
- Test: `tests/unit/components/admin/support/detail/TicketCustomerContext.test.tsx`

#### Steps

- [ ] **Step 1: Set up the worktree (see wave header) and write the failing test**

```tsx
// tests/unit/components/admin/support/detail/TicketCustomerContext.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { TicketCustomerContext } from '@/components/admin/support/detail/TicketCustomerContext'
import type { TicketCustomerContextData } from '@/lib/admin/support'

const base: TicketCustomerContextData = {
  customerId: 'c1',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@e.com',
  tierName: 'Silver',
  totalSpent: 450,
  totalOrders: 3,
  orderId: 'o1',
  orderNumber: 'HOF-100',
  orderTotal: 89.99,
  otherTicketsCount: 2,
}

describe('TicketCustomerContext', () => {
  it('renders customer name + email + tier', () => {
    render(<TicketCustomerContext context={base} />)
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText('ada@e.com')).toBeTruthy()
    expect(screen.getByText('Silver')).toBeTruthy()
  })

  it('renders LTV + total orders', () => {
    render(<TicketCustomerContext context={base} />)
    expect(screen.getByText(/\$450\.00/)).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('links customer to /admin/customers and order to /admin/fulfillment', () => {
    render(<TicketCustomerContext context={base} />)
    expect(
      screen.getByRole('link', { name: /ada lovelace/i }).getAttribute('href'),
    ).toBe('/admin/customers/c1')
    expect(
      screen.getByRole('link', { name: /HOF-100/i }).getAttribute('href'),
    ).toBe('/admin/fulfillment/o1')
  })

  it('renders otherTicketsCount', () => {
    render(<TicketCustomerContext context={base} />)
    expect(screen.getByText(/2 other tickets/i)).toBeTruthy()
  })

  it('renders no-order placeholder when orderId is null', () => {
    render(
      <TicketCustomerContext
        context={{ ...base, orderId: null, orderNumber: null, orderTotal: null }}
      />,
    )
    expect(screen.queryByRole('link', { name: /HOF-100/i })).toBeNull()
    expect(screen.getByText(/no linked order/i)).toBeTruthy()
  })

  it('renders customer as plain text when customerId is null', () => {
    render(<TicketCustomerContext context={{ ...base, customerId: null }} />)
    expect(screen.queryByRole('link', { name: /ada lovelace/i })).toBeNull()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketCustomerContext.test.tsx
```
Expect: module not found.

- [ ] **Step 3: Write `components/admin/support/detail/TicketCustomerContext.tsx`**

```tsx
import Link from 'next/link'
import type { TicketCustomerContextData } from '@/lib/admin/support'

const mFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const nFmt = new Intl.NumberFormat('en-US')

export interface TicketCustomerContextProps {
  context: TicketCustomerContextData
}

export function TicketCustomerContext({ context }: TicketCustomerContextProps) {
  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8">
        <h2 className="text-sm font-semibold text-white">Customer</h2>
      </header>

      <div className="p-3 space-y-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {context.customerId ? (
              <Link
                href={`/admin/customers/${context.customerId}`}
                className="text-sm text-white/90 hover:text-white underline-offset-2 hover:underline truncate"
              >
                {context.customerName}
              </Link>
            ) : (
              <span className="text-sm text-white/90 truncate">{context.customerName}</span>
            )}
            {context.tierName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/60 font-semibold">
                {context.tierName}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-white/50 truncate">{context.customerEmail}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-white/[0.03] px-2 py-1.5">
            <div className="text-white/40">Lifetime spend</div>
            <div className="text-white/80 font-semibold">{mFmt.format(context.totalSpent)}</div>
          </div>
          <div className="rounded bg-white/[0.03] px-2 py-1.5">
            <div className="text-white/40">Orders</div>
            <div className="text-white/80 font-semibold">{nFmt.format(context.totalOrders)}</div>
          </div>
        </div>

        <div className="border-t border-white/8 pt-2">
          <div className="text-white/40 text-xs">Linked order</div>
          {context.orderId ? (
            <Link
              href={`/admin/fulfillment/${context.orderId}`}
              className="mt-0.5 flex items-center justify-between gap-2 text-xs text-white/80 hover:text-white"
            >
              <span className="underline-offset-2 hover:underline">
                {context.orderNumber ?? 'Order'}
              </span>
              {context.orderTotal != null && (
                <span className="text-white/60">{mFmt.format(context.orderTotal)}</span>
              )}
            </Link>
          ) : (
            <div className="mt-0.5 text-xs text-white/30">No linked order</div>
          )}
        </div>

        <div className="border-t border-white/8 pt-2 text-xs text-white/50">
          {context.otherTicketsCount} other tickets from this customer
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + push + PR (do NOT merge)**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketCustomerContext.test.tsx
npx tsc --noEmit
git add components/admin/support/detail/TicketCustomerContext.tsx tests/unit/components/admin/support/detail/TicketCustomerContext.test.tsx
git commit -m "feat(admin-v2): add TicketCustomerContext sidebar (LTV/tier/orders + linked order + other tickets)"
git push -u origin wave9p9/task-9-customer-context
gh pr create --title "feat(admin-v2): Phase 9 W4 TicketCustomerContext" --body "Ticket detail sidebar customer snapshot. Name/email/tier + LTV + total orders + linked order summary + otherTicketsCount; links to /admin/customers and /admin/fulfillment. Presentational server component. 6 tests passing."
```

---

### Task 10: `components/admin/support/detail/TicketReturnRefundPanel.tsx` (+ `…PanelClient.tsx`) — return/refund panel

**Wave:** 4 | **Parallel-safe with:** Tasks 7, 8, 9, 11 | **Branch:** `wave9p9/task-10-return-refund-panel` | **Model:** sonnet

**Schema realities for this task:**
- Server wrapper consumes `TicketReturnRefundPanelProps = { ticketId: string }` (VERBATIM). It calls `loadTicketReturnRefund(ticketId)` and renders the client child. This mirrors the Phase 8 `CustomerAddressesPanel` → `CustomerAddressesPanelClient` server-wrapper / client-child pattern.
- `loadTicketReturnRefund` returns `TicketReturnRefundData | null` = `{ ticketId, returnRequested, returnApproved, returnLabel, refundAmount, refundReason, refundEligible, refundEligibilityReason, returnId, refundRecordId }`. When `null` (ticket missing), render a short "No return/refund info" panel.
- The client child (`TicketReturnRefundPanelClient`, `'use client'`) is a **read-only display** of return status (requested / approved / denied / label) and refund status (amount / reason / eligibility), plus two action buttons: **Decide return** and **Issue refund**.
- **INSPECTOR-FREE (Phase 8 lesson — REQUIRED):** the client child must NOT import `ReturnDecisionInspector` or `RefundInspector` (W5). It exposes the buttons through optional callback props `onDecideReturn?` / `onIssueRefund?`; the **W7 composition** owns inspector open-state and wires them. (The server wrapper does not yet know `isSuperAdmin` from a prop — it is not in `TicketReturnRefundPanelProps` — so the wrapper resolves it where the composition needs it; for this task the client child accepts an optional `isSuperAdmin` prop defaulting to `false`, used only to label/enable the "Issue refund" button. The composition passes the real value.)
- The server wrapper resolves `isSuperAdmin` via `requireAdminRole`-style check is NOT done here (no auth import in a Suspense data widget); instead it passes `isSuperAdmin={false}` by default and the W7 root re-renders/overrides through composition. Keep the wrapper minimal: load data, hand to client. (Per Contracts note: "server wrapper; client child gets data + isSuperAdmin".) The wrapper reads `isSuperAdmin` from an optional second prop the W7 root supplies; default `false`.
- Use `import type` for `TicketReturnRefundData` in the client file. The server wrapper value-imports `loadTicketReturnRefund` from `@/lib/admin/support` (server-only, fine).

> **Implementation note on `isSuperAdmin`:** to keep the VERBATIM prop interface `TicketReturnRefundPanelProps = { ticketId: string }` intact while still letting the composition supply `isSuperAdmin`, the server wrapper accepts an *optional* `isSuperAdmin?: boolean` alongside `ticketId` (additive, does not break the contract's required shape) and forwards it. The client child's props are `{ data, isSuperAdmin, onDecideReturn?, onIssueRefund? }`.

**Files:**
- Create: `components/admin/support/detail/TicketReturnRefundPanel.tsx` (server wrapper)
- Create: `components/admin/support/detail/TicketReturnRefundPanelClient.tsx` (client child)
- Test: `tests/unit/components/admin/support/detail/TicketReturnRefundPanel.test.tsx`

#### Steps

- [ ] **Step 1: Set up the worktree (see wave header) and write the failing test**

```tsx
// tests/unit/components/admin/support/detail/TicketReturnRefundPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/admin/support', () => ({
  loadTicketReturnRefund: vi.fn().mockResolvedValue({
    ticketId: 't1',
    returnRequested: true,
    returnApproved: null,
    returnLabel: null,
    refundAmount: null,
    refundReason: null,
    refundEligible: true,
    refundEligibilityReason: null,
    returnId: 'r1',
    refundRecordId: null,
  }),
}))

import { TicketReturnRefundPanel } from '@/components/admin/support/detail/TicketReturnRefundPanel'

beforeEach(() => vi.clearAllMocks())

describe('TicketReturnRefundPanel', () => {
  it('renders return status from the loader', async () => {
    const node = await TicketReturnRefundPanel({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/return requested/i)).toBeTruthy()
    expect(screen.getByText(/pending decision/i)).toBeTruthy()
  })

  it('renders refund eligibility', async () => {
    const node = await TicketReturnRefundPanel({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/eligible/i)).toBeTruthy()
  })

  it('renders the Decide return + Issue refund buttons', async () => {
    const node = await TicketReturnRefundPanel({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getByRole('button', { name: /decide return/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /issue refund/i })).toBeTruthy()
  })

  it('renders approved return with label state', async () => {
    const mod = await import('@/lib/admin/support')
    ;(mod.loadTicketReturnRefund as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ticketId: 't1',
      returnRequested: true,
      returnApproved: true,
      returnLabel: 'https://easypost.example/label.pdf',
      refundAmount: 89.99,
      refundReason: 'Defective',
      refundEligible: false,
      refundEligibilityReason: 'Already refunded',
      returnId: 'r1',
      refundRecordId: 'rr1',
    })
    const node = await TicketReturnRefundPanel({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/approved/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /label/i }).getAttribute('href')).toBe(
      'https://easypost.example/label.pdf',
    )
    expect(screen.getByText(/\$89\.99/)).toBeTruthy()
    expect(screen.getByText(/already refunded/i)).toBeTruthy()
  })

  it('renders empty panel when loader returns null', async () => {
    const mod = await import('@/lib/admin/support')
    ;(mod.loadTicketReturnRefund as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const node = await TicketReturnRefundPanel({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no return\/refund/i)).toBeTruthy()
  })
})
```

> The client child is exercised through the server wrapper's rendered output (it is not mocked) so the buttons + status text assertions cover both files. The `onDecideReturn`/`onIssueRefund` callbacks default to no-ops when the composition has not wired them, so clicking is safe; W7 supplies the real handlers.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketReturnRefundPanel.test.tsx
```
Expect: module not found.

- [ ] **Step 3a: Write `components/admin/support/detail/TicketReturnRefundPanelClient.tsx`**

```tsx
'use client'

import type { TicketReturnRefundData } from '@/lib/admin/support'

const mFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface TicketReturnRefundPanelClientProps {
  data: TicketReturnRefundData
  isSuperAdmin: boolean
  onDecideReturn?: () => void
  onIssueRefund?: () => void
}

function returnStatusLabel(data: TicketReturnRefundData): string {
  if (!data.returnRequested) return 'No return requested'
  if (data.returnApproved === true) return 'Approved'
  if (data.returnApproved === false) return 'Denied'
  return 'Pending decision'
}

export function TicketReturnRefundPanelClient({
  data,
  isSuperAdmin,
  onDecideReturn,
  onIssueRefund,
}: TicketReturnRefundPanelClientProps) {
  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8">
        <h2 className="text-sm font-semibold text-white">Return &amp; refund</h2>
      </header>

      <div className="p-3 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-white/40">
            {data.returnRequested ? 'Return requested' : 'Return'}
          </span>
          <span className="text-white/80 font-semibold">{returnStatusLabel(data)}</span>
        </div>

        {data.returnLabel && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Shipping label</span>
            <a
              href={data.returnLabel}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline"
            >
              View label
            </a>
          </div>
        )}

        <div className="border-t border-white/8 pt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Refund</span>
            <span className="text-white/80 font-semibold">
              {data.refundAmount != null ? mFmt.format(data.refundAmount) : '—'}
            </span>
          </div>
          {data.refundReason && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/40">Reason</span>
              <span className="text-white/70">{data.refundReason}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/40">Eligibility</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                data.refundEligible
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white/10 text-white/50'
              }`}
            >
              {data.refundEligible ? 'Eligible' : 'Not eligible'}
            </span>
          </div>
          {data.refundEligibilityReason && (
            <div className="text-white/40">{data.refundEligibilityReason}</div>
          )}
        </div>

        <div className="border-t border-white/8 pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDecideReturn?.()}
            disabled={!data.returnRequested}
            className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-30"
          >
            Decide return
          </button>
          <button
            type="button"
            onClick={() => onIssueRefund?.()}
            disabled={!isSuperAdmin || !data.refundEligible}
            title={isSuperAdmin ? undefined : 'SUPER_ADMIN only'}
            className="text-[11px] px-2 py-1 rounded bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-30"
          >
            Issue refund
          </button>
        </div>
      </div>
    </section>
  )
}
```

> **REQUIRED — do NOT import `ReturnDecisionInspector` or `RefundInspector` here.** Buttons only fire `onDecideReturn`/`onIssueRefund`. W7's `AdminTicketDetailV2` owns the inspector open-state and renders the inspectors, passing these callbacks. Keeping this client child inspector-free is what makes this task's test pass before W5 merges (Phase 8 Vite static-import lesson).

- [ ] **Step 3b: Write `components/admin/support/detail/TicketReturnRefundPanel.tsx` (server wrapper)**

```tsx
import { loadTicketReturnRefund } from '@/lib/admin/support'
import { TicketReturnRefundPanelClient } from './TicketReturnRefundPanelClient'

export interface TicketReturnRefundPanelProps {
  ticketId: string
  isSuperAdmin?: boolean
}

export async function TicketReturnRefundPanel({
  ticketId,
  isSuperAdmin = false,
}: TicketReturnRefundPanelProps) {
  const data = await loadTicketReturnRefund(ticketId)

  if (!data) {
    return (
      <section className="bg-neutral-900/60 border border-white/8 rounded-md">
        <header className="px-3 py-2 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white">Return &amp; refund</h2>
        </header>
        <div className="p-4 text-sm text-white/40">No return/refund info for this ticket.</div>
      </section>
    )
  }

  return <TicketReturnRefundPanelClient data={data} isSuperAdmin={isSuperAdmin} />
}
```

- [ ] **Step 4: Verify + tsc + commit + push + PR (do NOT merge)**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketReturnRefundPanel.test.tsx
npx tsc --noEmit
git add components/admin/support/detail/TicketReturnRefundPanel.tsx components/admin/support/detail/TicketReturnRefundPanelClient.tsx tests/unit/components/admin/support/detail/TicketReturnRefundPanel.test.tsx
git commit -m "feat(admin-v2): add TicketReturnRefundPanel server wrapper + client child (read-only status + Decide/Issue callbacks, inspector-free)"
git push -u origin wave9p9/task-10-return-refund-panel
gh pr create --title "feat(admin-v2): Phase 9 W4 TicketReturnRefundPanel" --body "Server wrapper loads loadTicketReturnRefund + renders client child (read-only return/refund status + eligibility). Decide-return / Issue-refund buttons fire callback props (inspector-free per Phase 8 lesson; W7 wires inspectors). Null loader → empty panel. 5 tests passing."
```

---

### Task 11: `components/admin/support/detail/TicketActivityTimeline.tsx` — activity timeline

**Wave:** 4 | **Parallel-safe with:** Tasks 7, 8, 9, 10 | **Branch:** `wave9p9/task-11-activity-timeline` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `TicketActivityTimelineProps = { ticketId: string }` (VERBATIM). **Server component** (no `'use client'`) that loads internally via `loadTicketActivity(ticketId)` — mirrors the Phase 8 `CustomerActivityTimeline` (server, calls its own loader, renders chronological events).
- `loadTicketActivity(ticketId, limit?)` returns `TicketActivityEvent[]` = `{ id, kind, label, timestamp, actor }` where `kind: TicketActivityKind = 'message' | 'internal' | 'status' | 'assignment' | 'return' | 'refund'`. Events are already chronological from the loader; render in order with a per-kind icon. `actor` may be null.
- Empty state when no events.
- Use `import type` is unnecessary here (server component value-imports the loader); but `TicketActivityEvent` / `TicketActivityKind` come from `@/lib/admin/support`.

**Files:**
- Create: `components/admin/support/detail/TicketActivityTimeline.tsx`
- Test: `tests/unit/components/admin/support/detail/TicketActivityTimeline.test.tsx`

#### Steps

- [ ] **Step 1: Set up the worktree (see wave header) and write the failing test**

```tsx
// tests/unit/components/admin/support/detail/TicketActivityTimeline.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/support', () => ({
  loadTicketActivity: vi.fn().mockResolvedValue([
    {
      id: 'e1',
      kind: 'assignment',
      label: 'Assigned to Agent Smith',
      timestamp: new Date('2026-06-18T08:05:00Z'),
      actor: 'Agent Jones',
    },
    {
      id: 'e2',
      kind: 'status',
      label: 'Status changed to ESCALATED',
      timestamp: new Date('2026-06-18T09:00:00Z'),
      actor: 'Agent Smith',
    },
    {
      id: 'e3',
      kind: 'refund',
      label: 'Refund issued ($89.99)',
      timestamp: new Date('2026-06-18T10:00:00Z'),
      actor: null,
    },
  ]),
}))

import { TicketActivityTimeline } from '@/components/admin/support/detail/TicketActivityTimeline'

beforeEach(() => vi.clearAllMocks())

describe('TicketActivityTimeline', () => {
  it('renders activity events with label + actor', async () => {
    const node = await TicketActivityTimeline({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/Assigned to Agent Smith/)).toBeTruthy()
    expect(screen.getByText(/Status changed to ESCALATED/)).toBeTruthy()
    expect(screen.getByText(/Refund issued/)).toBeTruthy()
  })

  it('renders the actor when present', async () => {
    const node = await TicketActivityTimeline({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getAllByText(/Agent Jones/).length).toBeGreaterThan(0)
  })

  it('renders a per-kind icon test id for each event', async () => {
    const node = await TicketActivityTimeline({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getByTestId('activity-kind-assignment')).toBeTruthy()
    expect(screen.getByTestId('activity-kind-status')).toBeTruthy()
    expect(screen.getByTestId('activity-kind-refund')).toBeTruthy()
  })

  it('renders empty state when no events', async () => {
    const mod = await import('@/lib/admin/support')
    ;(mod.loadTicketActivity as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])
    const node = await TicketActivityTimeline({ ticketId: 't1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no activity/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketActivityTimeline.test.tsx
```
Expect: module not found.

- [ ] **Step 3: Write `components/admin/support/detail/TicketActivityTimeline.tsx`**

```tsx
import type { TicketActivityKind } from '@/lib/admin/support'
import { loadTicketActivity } from '@/lib/admin/support'

const tFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

const ICON: Record<TicketActivityKind, string> = {
  message: '💬',
  internal: '📝',
  status: '🔄',
  assignment: '👤',
  return: '↩️',
  refund: '💸',
}

export interface TicketActivityTimelineProps {
  ticketId: string
}

export async function TicketActivityTimeline({ ticketId }: TicketActivityTimelineProps) {
  const events = await loadTicketActivity(ticketId, 50)

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Activity</h2>
        <span className="text-xs text-white/40">{events.length} events</span>
      </header>

      {events.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No activity yet.</div>
      ) : (
        <ol className="p-3 space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-xs">
              <span
                data-testid={`activity-kind-${e.kind}`}
                className="shrink-0 mt-0.5"
                aria-hidden="true"
              >
                {ICON[e.kind] ?? '•'}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-white/80">{e.label}</span>
                <span className="block text-white/40">
                  {tFmt.format(e.timestamp)}
                  {e.actor ? <span className="ml-1">· {e.actor}</span> : null}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + push + PR (do NOT merge)**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketActivityTimeline.test.tsx
npx tsc --noEmit
git add components/admin/support/detail/TicketActivityTimeline.tsx tests/unit/components/admin/support/detail/TicketActivityTimeline.test.tsx
git commit -m "feat(admin-v2): add TicketActivityTimeline (chronological events with per-kind icon)"
git push -u origin wave9p9/task-11-activity-timeline
gh pr create --title "feat(admin-v2): Phase 9 W4 TicketActivityTimeline" --body "Server component loads loadTicketActivity + renders chronological TicketActivityEvent[] with per-kind icon (message/internal/status/assignment/return/refund) + label + timestamp + actor; empty state. 4 tests passing."
```

---
## Wave 5 — Inspectors (6 parallel, after W2 merged)

All six inspectors are `'use client'` forms that call server actions value-imported from `@/app/admin/support/actions`. Data types are `import type` only (no Prisma in the client bundle). Always-dark styling — **no `dark:` modifiers**; direct colors (`bg-neutral-950`, `border-white/8`, `text-white/50`). These merge **before** the reply composer (T23) and detail composition (T25) that statically embed them (Phase 8 inspector-before-panel lesson, cross-cutting note #8).

> **Worktree note (every task):** worktrees have no `node_modules`. Symlink the repo root's once before running anything: `ln -s <repo-root>/node_modules node_modules`. Test commands are `npx vitest run <path>` and `npx tsc --noEmit` — **never pnpm** (it writes a spurious `pnpm-lock.yaml`).

> **Action-signature confirmation (every task):** the test mocks below assume the canonical signatures from the Shared Contracts section of the main plan (`assignTicket`, `setTicketStatus`, `escalateTicket`, `resolveTicket`, `approveReturn`, `denyReturn`, `issueRefund`, `createCannedResponse`, `updateCannedResponse`, `deleteCannedResponse`). The implementer **must** open `app/admin/support/actions.ts` (merged in W2) and confirm each real signature before wiring — if a merged action disagrees with prose, the merged file wins. The prop interfaces (`AssignAgentInspectorProps` etc.) are likewise canonical from Shared Contracts; copy them verbatim.

---

### Task 12: `AssignAgentInspector.tsx`

**Wave:** 5 | **Parallel-safe with:** Tasks 13, 14, 15, 16, 17 | **Branch:** `wave9p9/task-12-assign-agent-inspector` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props are `AssignAgentInspectorProps` (Shared Contracts, verbatim): `{ open: boolean; ticketId: string; agents: AgentRow[]; currentAssigneeId: string | null; onClose: () => void }`.
- `AgentRow = { id: string; name: string; openTicketCount: number }` — `id` is `AdminUser.id`.
- An agent `<select>` lists `agents`, with an "Unassigned" option (value `''` → `null`). Default selection is `currentAssigneeId`.
- Submit calls `assignTicket(ticketId, adminUserId | null)` — empty selection passes `null`.
- Right-slide inspector pattern (full-screen mobile, `sm:w-[480px]`); backdrop click closes; `useTransition`; on success toast + `onClose()`, on failure `toast.error(r.error)`.
- Renders nothing when `!open`.

**Files:**
- Create: `components/admin/support/inspectors/AssignAgentInspector.tsx`
- Test: `tests/unit/components/admin/support/inspectors/AssignAgentInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

> Before relying on this mock, confirm the real `assignTicket` signature in `app/admin/support/actions.ts` (Shared Contracts is canonical: `assignTicket(ticketId: string, adminUserId: string | null)`).

```tsx
// tests/unit/components/admin/support/inspectors/AssignAgentInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const assignTicket = vi.fn()
vi.mock('@/app/admin/support/actions', () => ({
  assignTicket: (...a: unknown[]) => assignTicket(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { AssignAgentInspector } from '@/components/admin/support/inspectors/AssignAgentInspector'
import type { AgentRow } from '@/lib/admin/support'

const agents: AgentRow[] = [
  { id: 'au1', name: 'Ada', openTicketCount: 3 },
  { id: 'au2', name: 'Babbage', openTicketCount: 1 },
]

beforeEach(() => vi.clearAllMocks())

describe('AssignAgentInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AssignAgentInspector
        open={false}
        ticketId="t1"
        agents={agents}
        currentAssigneeId={null}
        onClose={() => {}}
      />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('lists agents with open load and defaults to current assignee', () => {
    render(
      <AssignAgentInspector
        open
        ticketId="t1"
        agents={agents}
        currentAssigneeId="au2"
        onClose={() => {}}
      />,
    )
    const select = screen.getByLabelText(/assign to/i) as HTMLSelectElement
    expect(select.value).toBe('au2')
    expect(screen.getByText(/Ada/)).toBeTruthy()
    expect(screen.getByText(/Babbage/)).toBeTruthy()
  })

  it('assigns selected agent and closes on success', async () => {
    assignTicket.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(
      <AssignAgentInspector
        open
        ticketId="t1"
        agents={agents}
        currentAssigneeId={null}
        onClose={onClose}
      />,
    )
    fireEvent.change(screen.getByLabelText(/assign to/i), { target: { value: 'au1' } })
    fireEvent.click(screen.getByRole('button', { name: /assign/i }))
    await waitFor(() => expect(assignTicket).toHaveBeenCalledWith('t1', 'au1'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('unassign passes null', async () => {
    assignTicket.mockResolvedValue({ ok: true })
    render(
      <AssignAgentInspector
        open
        ticketId="t1"
        agents={agents}
        currentAssigneeId="au1"
        onClose={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText(/assign to/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /assign/i }))
    await waitFor(() => expect(assignTicket).toHaveBeenCalledWith('t1', null))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/AssignAgentInspector.test.tsx
```

- [ ] **Step 3: Write `components/admin/support/inspectors/AssignAgentInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { AgentRow } from '@/lib/admin/support'
import { assignTicket } from '@/app/admin/support/actions'
import { toast } from '@/lib/toast'

export interface AssignAgentInspectorProps {
  open: boolean
  ticketId: string
  agents: AgentRow[]
  currentAssigneeId: string | null
  onClose: () => void
}

export function AssignAgentInspector({
  open, ticketId, agents, currentAssigneeId, onClose,
}: AssignAgentInspectorProps) {
  const [selected, setSelected] = useState(currentAssigneeId ?? '')
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    startTransition(async () => {
      const r = await assignTicket(ticketId, selected === '' ? null : selected)
      if (r.ok) {
        toast.success('Ticket assigned')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Assign agent" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Assign agent</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/50">Assign to</span>
            <select
              aria-label="assign to"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.openTicketCount} open)
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR (no merge)**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/AssignAgentInspector.test.tsx
npx tsc --noEmit
git add components/admin/support/inspectors/AssignAgentInspector.tsx tests/unit/components/admin/support/inspectors/AssignAgentInspector.test.tsx
git commit -m "feat(admin-v2): add AssignAgentInspector (agent select → assignTicket)"
git push -u origin wave9p9/task-12-assign-agent-inspector
gh pr create --title "feat(admin-v2): Phase 9 W5 AssignAgentInspector" --body "Right-slide inspector. Agent select (incl. Unassigned→null) wires assignTicket(ticketId, adminUserId|null). 4 tests passing." # do not merge
```

---

### Task 13: `StatusChangeInspector.tsx`

**Wave:** 5 | **Parallel-safe with:** Tasks 12, 14, 15, 16, 17 | **Branch:** `wave9p9/task-13-status-change-inspector` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props are `StatusChangeInspectorProps` (Shared Contracts, verbatim): `{ open: boolean; ticketId: string; currentStatus: SupportTicketStatus; onClose: () => void }`.
- The 6 `SupportTicketStatus` values are `OPEN | IN_PROGRESS | WAITING_CUSTOMER | ESCALATED | RESOLVED | CLOSED` (§3). Render a `<select>` over them, defaulting to `currentStatus`.
- Routing on submit:
  - `RESOLVED` → requires a non-empty `resolution` textarea → `resolveTicket(ticketId, resolution)`. The Apply button is disabled while `RESOLVED` is chosen and `resolution` is blank.
  - `ESCALATED` → `escalateTicket(ticketId)`.
  - any other → `setTicketStatus(ticketId, status)`.
- The resolution textarea only renders when the chosen status is `RESOLVED`.
- Right-slide inspector; backdrop closes; `useTransition`; success toast + `onClose()`, failure `toast.error(r.error)`. Renders nothing when `!open`.

**Files:**
- Create: `components/admin/support/inspectors/StatusChangeInspector.tsx`
- Test: `tests/unit/components/admin/support/inspectors/StatusChangeInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

> Confirm the real `setTicketStatus` / `escalateTicket` / `resolveTicket` signatures in `app/admin/support/actions.ts` before relying on these mocks (Shared Contracts is canonical: `setTicketStatus(ticketId, status)`, `escalateTicket(ticketId)`, `resolveTicket(ticketId, resolution)`).

```tsx
// tests/unit/components/admin/support/inspectors/StatusChangeInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const setTicketStatus = vi.fn()
const escalateTicket = vi.fn()
const resolveTicket = vi.fn()
vi.mock('@/app/admin/support/actions', () => ({
  setTicketStatus: (...a: unknown[]) => setTicketStatus(...a),
  escalateTicket: (...a: unknown[]) => escalateTicket(...a),
  resolveTicket: (...a: unknown[]) => resolveTicket(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { StatusChangeInspector } from '@/components/admin/support/inspectors/StatusChangeInspector'

beforeEach(() => vi.clearAllMocks())

describe('StatusChangeInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <StatusChangeInspector open={false} ticketId="t1" currentStatus="OPEN" onClose={() => {}} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('plain status change calls setTicketStatus', async () => {
    setTicketStatus.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(
      <StatusChangeInspector open ticketId="t1" currentStatus="OPEN" onClose={onClose} />,
    )
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'IN_PROGRESS' } })
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    await waitFor(() => expect(setTicketStatus).toHaveBeenCalledWith('t1', 'IN_PROGRESS'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('escalate routes to escalateTicket', async () => {
    escalateTicket.mockResolvedValue({ ok: true })
    render(
      <StatusChangeInspector open ticketId="t1" currentStatus="OPEN" onClose={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'ESCALATED' } })
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    await waitFor(() => expect(escalateTicket).toHaveBeenCalledWith('t1'))
    expect(setTicketStatus).not.toHaveBeenCalled()
  })

  it('resolve requires resolution then calls resolveTicket', async () => {
    resolveTicket.mockResolvedValue({ ok: true })
    render(
      <StatusChangeInspector open ticketId="t1" currentStatus="OPEN" onClose={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'RESOLVED' } })
    const apply = screen.getByRole('button', { name: /apply/i }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/resolution/i), { target: { value: 'Refunded and apologized' } })
    expect(apply.disabled).toBe(false)
    fireEvent.click(apply)
    await waitFor(() =>
      expect(resolveTicket).toHaveBeenCalledWith('t1', 'Refunded and apologized'),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/StatusChangeInspector.test.tsx
```

- [ ] **Step 3: Write `components/admin/support/inspectors/StatusChangeInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { SupportTicketStatus } from '@prisma/client'
import { setTicketStatus, escalateTicket, resolveTicket } from '@/app/admin/support/actions'
import { toast } from '@/lib/toast'

export interface StatusChangeInspectorProps {
  open: boolean
  ticketId: string
  currentStatus: SupportTicketStatus
  onClose: () => void
}

const STATUSES: SupportTicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
]

export function StatusChangeInspector({
  open, ticketId, currentStatus, onClose,
}: StatusChangeInspectorProps) {
  const [status, setStatus] = useState<SupportTicketStatus>(currentStatus)
  const [resolution, setResolution] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const needsResolution = status === 'RESOLVED'
  const disabled = isPending || (needsResolution && resolution.trim() === '')

  const handleSubmit = () => {
    startTransition(async () => {
      let r
      if (status === 'RESOLVED') {
        r = await resolveTicket(ticketId, resolution.trim())
      } else if (status === 'ESCALATED') {
        r = await escalateTicket(ticketId)
      } else {
        r = await setTicketStatus(ticketId, status)
      }
      if (r.ok) {
        toast.success('Status updated')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Change status" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Change status</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/50">Status</span>
            <select
              aria-label="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SupportTicketStatus)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          {needsResolution && (
            <label className="block">
              <span className="text-xs text-white/50">Resolution</span>
              <textarea
                aria-label="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
              />
            </label>
          )}
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            className="text-xs px-3 py-1.5 rounded bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR (no merge)**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/StatusChangeInspector.test.tsx
npx tsc --noEmit
git add components/admin/support/inspectors/StatusChangeInspector.tsx tests/unit/components/admin/support/inspectors/StatusChangeInspector.test.tsx
git commit -m "feat(admin-v2): add StatusChangeInspector (resolve/escalate/setStatus routing)"
git push -u origin wave9p9/task-13-status-change-inspector
gh pr create --title "feat(admin-v2): Phase 9 W5 StatusChangeInspector" --body "Right-slide inspector. Status select over 6 SupportTicketStatus; RESOLVED requires resolution→resolveTicket, ESCALATED→escalateTicket, else setTicketStatus. 4 tests passing." # do not merge
```

---

### Task 14: `ReturnDecisionInspector.tsx`

**Wave:** 5 | **Parallel-safe with:** Tasks 12, 13, 15, 16, 17 | **Branch:** `wave9p9/task-14-return-decision-inspector` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props are `ReturnDecisionInspectorProps` (Shared Contracts, verbatim): `{ open: boolean; ticketId: string; data: TicketReturnRefundData; onClose: () => void }`.
- `TicketReturnRefundData` (Shared Contracts) carries `returnRequested`, `returnApproved`, `returnLabel`, etc. — show a small status summary at the top.
- Two decisions:
  - **Approve** with a "Generate return label" checkbox → `approveReturn(ticketId, { generateLabel })`.
  - **Deny** with a required reason textarea → `denyReturn(ticketId, reason)`; the Deny button is disabled while the reason is blank.
- Right-slide inspector; backdrop closes; `useTransition`; success toast + `onClose()`, failure `toast.error(r.error)`. Renders nothing when `!open`.

**Files:**
- Create: `components/admin/support/inspectors/ReturnDecisionInspector.tsx`
- Test: `tests/unit/components/admin/support/inspectors/ReturnDecisionInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

> Confirm the real `approveReturn` / `denyReturn` signatures in `app/admin/support/actions.ts` before relying on these mocks (Shared Contracts is canonical: `approveReturn(ticketId, { generateLabel? })`, `denyReturn(ticketId, reason)`).

```tsx
// tests/unit/components/admin/support/inspectors/ReturnDecisionInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const approveReturn = vi.fn()
const denyReturn = vi.fn()
vi.mock('@/app/admin/support/actions', () => ({
  approveReturn: (...a: unknown[]) => approveReturn(...a),
  denyReturn: (...a: unknown[]) => denyReturn(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { ReturnDecisionInspector } from '@/components/admin/support/inspectors/ReturnDecisionInspector'
import type { TicketReturnRefundData } from '@/lib/admin/support'

const data: TicketReturnRefundData = {
  ticketId: 't1',
  returnRequested: true,
  returnApproved: null,
  returnLabel: null,
  refundAmount: null,
  refundReason: null,
  refundEligible: true,
  refundEligibilityReason: null,
  returnId: null,
  refundRecordId: null,
}

beforeEach(() => vi.clearAllMocks())

describe('ReturnDecisionInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ReturnDecisionInspector open={false} ticketId="t1" data={data} onClose={() => {}} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('approve with generate-label checkbox calls approveReturn', async () => {
    approveReturn.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(
      <ReturnDecisionInspector open ticketId="t1" data={data} onClose={onClose} />,
    )
    fireEvent.click(screen.getByLabelText(/generate return label/i))
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() =>
      expect(approveReturn).toHaveBeenCalledWith('t1', { generateLabel: true }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('approve without checkbox passes generateLabel false', async () => {
    approveReturn.mockResolvedValue({ ok: true })
    render(
      <ReturnDecisionInspector open ticketId="t1" data={data} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() =>
      expect(approveReturn).toHaveBeenCalledWith('t1', { generateLabel: false }),
    )
  })

  it('deny requires reason then calls denyReturn', async () => {
    denyReturn.mockResolvedValue({ ok: true })
    render(
      <ReturnDecisionInspector open ticketId="t1" data={data} onClose={() => {}} />,
    )
    const deny = screen.getByRole('button', { name: /deny/i }) as HTMLButtonElement
    expect(deny.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/denial reason/i), {
      target: { value: 'Outside return window' },
    })
    expect(deny.disabled).toBe(false)
    fireEvent.click(deny)
    await waitFor(() =>
      expect(denyReturn).toHaveBeenCalledWith('t1', 'Outside return window'),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/ReturnDecisionInspector.test.tsx
```

- [ ] **Step 3: Write `components/admin/support/inspectors/ReturnDecisionInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { TicketReturnRefundData } from '@/lib/admin/support'
import { approveReturn, denyReturn } from '@/app/admin/support/actions'
import { toast } from '@/lib/toast'

export interface ReturnDecisionInspectorProps {
  open: boolean
  ticketId: string
  data: TicketReturnRefundData
  onClose: () => void
}

export function ReturnDecisionInspector({
  open, ticketId, data, onClose,
}: ReturnDecisionInspectorProps) {
  const [generateLabel, setGenerateLabel] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const handleApprove = () => {
    startTransition(async () => {
      const r = await approveReturn(ticketId, { generateLabel })
      if (r.ok) {
        toast.success('Return approved')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  const handleDeny = () => {
    startTransition(async () => {
      const r = await denyReturn(ticketId, reason.trim())
      if (r.ok) {
        toast.success('Return denied')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Return decision" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Return decision</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <dl className="text-xs text-white/60 space-y-1">
            <div className="flex justify-between">
              <dt>Return requested</dt>
              <dd className="text-white/80">{data.returnRequested ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Current decision</dt>
              <dd className="text-white/80">
                {data.returnApproved === null
                  ? 'Pending'
                  : data.returnApproved
                    ? 'Approved'
                    : 'Denied'}
              </dd>
            </div>
            {data.returnLabel && (
              <div className="flex justify-between">
                <dt>Label</dt>
                <dd className="text-white/80">{data.returnLabel}</dd>
              </div>
            )}
          </dl>

          <div className="space-y-2 border-t border-white/8 pt-3">
            <h3 className="text-xs font-semibold text-white/70">Approve</h3>
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input
                aria-label="generate return label"
                type="checkbox"
                checked={generateLabel}
                onChange={(e) => setGenerateLabel(e.target.checked)}
              />
              Generate return label
            </label>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="text-xs px-3 py-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              Approve return
            </button>
          </div>

          <div className="space-y-2 border-t border-white/8 pt-3">
            <h3 className="text-xs font-semibold text-white/70">Deny</h3>
            <label className="block">
              <span className="text-xs text-white/50">Denial reason</span>
              <textarea
                aria-label="denial reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
              />
            </label>
            <button
              type="button"
              onClick={handleDeny}
              disabled={isPending || reason.trim() === ''}
              className="text-xs px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Deny return
            </button>
          </div>
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR (no merge)**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/ReturnDecisionInspector.test.tsx
npx tsc --noEmit
git add components/admin/support/inspectors/ReturnDecisionInspector.tsx tests/unit/components/admin/support/inspectors/ReturnDecisionInspector.test.tsx
git commit -m "feat(admin-v2): add ReturnDecisionInspector (approve+label / deny+reason)"
git push -u origin wave9p9/task-14-return-decision-inspector
gh pr create --title "feat(admin-v2): Phase 9 W5 ReturnDecisionInspector" --body "Right-slide inspector. Approve (generate-label checkbox)→approveReturn; Deny (required reason)→denyReturn. 4 tests passing." # do not merge
```

---

### Task 15: `RefundInspector.tsx`

**Wave:** 5 | **Parallel-safe with:** Tasks 12, 13, 14, 16, 17 | **Branch:** `wave9p9/task-15-refund-inspector` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props are `RefundInspectorProps` (Shared Contracts, verbatim): `{ open: boolean; ticketId: string; data: TicketReturnRefundData; isSuperAdmin: boolean; onClose: () => void }`.
- Fields: `amount` (number), `type` (`'FULL' | 'PARTIAL' | 'SHIPPING_ONLY'`), `reason` (text). Submit calls `issueRefund(ticketId, { amount, type, reason })`.
- **SUPER_ADMIN-gated UX:** when `!isSuperAdmin`, render a disabled state with an explanation (no form, no submit). `issueRefund` itself also gates `requireAdminRole('SUPER_ADMIN')` server-side (§6) — the client gate is UX only.
- **Confirm UX modeled on `AnonymizeConfirmDialog`** (money is destructive): a typed-confirm step. The operator must type the word `REFUND` to enable the final "Issue refund" button (mirrors the typed-email confirm in `AnonymizeConfirmDialog`). The button is disabled until the typed value matches AND amount > 0 AND reason is non-empty.
- Use the `RefundInspectorProps` `data` to seed eligibility messaging (`data.refundEligible`, `data.refundEligibilityReason`) and to default `amount` (e.g. `data.refundAmount ?? 0`).
- Right-slide inspector; backdrop closes; `useTransition`; success toast + `onClose()`, failure `toast.error(r.error)`. Renders nothing when `!open`.

**Files:**
- Create: `components/admin/support/inspectors/RefundInspector.tsx`
- Test: `tests/unit/components/admin/support/inspectors/RefundInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

> Confirm the real `issueRefund` signature in `app/admin/support/actions.ts` before relying on this mock (Shared Contracts is canonical: `issueRefund(ticketId, { amount, type, reason })`, SUPER_ADMIN-gated).

```tsx
// tests/unit/components/admin/support/inspectors/RefundInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const issueRefund = vi.fn()
vi.mock('@/app/admin/support/actions', () => ({
  issueRefund: (...a: unknown[]) => issueRefund(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { RefundInspector } from '@/components/admin/support/inspectors/RefundInspector'
import type { TicketReturnRefundData } from '@/lib/admin/support'

const data: TicketReturnRefundData = {
  ticketId: 't1',
  returnRequested: false,
  returnApproved: null,
  returnLabel: null,
  refundAmount: 25,
  refundReason: null,
  refundEligible: true,
  refundEligibilityReason: null,
  returnId: null,
  refundRecordId: null,
}

beforeEach(() => vi.clearAllMocks())

describe('RefundInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RefundInspector open={false} ticketId="t1" data={data} isSuperAdmin onClose={() => {}} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders disabled explanation when not super admin', () => {
    render(
      <RefundInspector open ticketId="t1" data={data} isSuperAdmin={false} onClose={() => {}} />,
    )
    expect(screen.getByText(/super admin/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /issue refund/i })).toBeNull()
  })

  it('issue button disabled until typed-confirm matches', () => {
    render(
      <RefundInspector open ticketId="t1" data={data} isSuperAdmin onClose={() => {}} />,
    )
    const btn = screen.getByRole('button', { name: /issue refund/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Damaged item' } })
    fireEvent.change(screen.getByLabelText(/type refund to confirm/i), {
      target: { value: 'REFUND' },
    })
    expect(btn.disabled).toBe(false)
  })

  it('submits issueRefund with amount/type/reason and closes', async () => {
    issueRefund.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(
      <RefundInspector open ticketId="t1" data={data} isSuperAdmin onClose={onClose} />,
    )
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10.50' } })
    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: 'PARTIAL' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Damaged item' } })
    fireEvent.change(screen.getByLabelText(/type refund to confirm/i), {
      target: { value: 'REFUND' },
    })
    fireEvent.click(screen.getByRole('button', { name: /issue refund/i }))
    await waitFor(() =>
      expect(issueRefund).toHaveBeenCalledWith('t1', {
        amount: 10.5,
        type: 'PARTIAL',
        reason: 'Damaged item',
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/RefundInspector.test.tsx
```

- [ ] **Step 3: Write `components/admin/support/inspectors/RefundInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import type { TicketReturnRefundData } from '@/lib/admin/support'
import { issueRefund } from '@/app/admin/support/actions'
import { toast } from '@/lib/toast'

export interface RefundInspectorProps {
  open: boolean
  ticketId: string
  data: TicketReturnRefundData
  isSuperAdmin: boolean
  onClose: () => void
}

type RefundType = 'FULL' | 'PARTIAL' | 'SHIPPING_ONLY'
const REFUND_TYPES: RefundType[] = ['FULL', 'PARTIAL', 'SHIPPING_ONLY']
const CONFIRM_WORD = 'REFUND'

export function RefundInspector({
  open, ticketId, data, isSuperAdmin, onClose,
}: RefundInspectorProps) {
  const [amount, setAmount] = useState(String(data.refundAmount ?? 0))
  const [type, setType] = useState<RefundType>('FULL')
  const [reason, setReason] = useState(data.refundReason ?? '')
  const [typed, setTyped] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const Shell = ({ children }: { children: ReactNode }) => (
    <div role="dialog" aria-label="Issue refund" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Issue refund</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )

  if (!isSuperAdmin) {
    return (
      <Shell>
        <div className="p-4 space-y-3 text-sm text-white/70">
          <p className="text-red-300 text-xs font-semibold">Restricted action</p>
          <p>
            Issuing a refund charges the payment provider and requires{' '}
            <span className="text-white">SUPER_ADMIN</span> privileges. Your account does
            not have permission to issue refunds. Ask a super admin to complete this.
          </p>
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </Shell>
    )
  }

  const amountNum = Number(amount)
  const matches = typed.trim().toUpperCase() === CONFIRM_WORD
  const disabled =
    isPending || !matches || !(amountNum > 0) || reason.trim() === ''

  const handleSubmit = () => {
    startTransition(async () => {
      const r = await issueRefund(ticketId, {
        amount: amountNum,
        type,
        reason: reason.trim(),
      })
      if (r.ok) {
        toast.success('Refund issued')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <Shell>
      <div className="p-4 space-y-3 text-sm">
        {!data.refundEligible && (
          <p className="text-xs text-amber-300">
            {data.refundEligibilityReason ?? 'This ticket may not be refund-eligible.'}
          </p>
        )}
        <label className="block">
          <span className="text-xs text-white/50">Amount</span>
          <input
            aria-label="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
          />
        </label>
        <label className="block">
          <span className="text-xs text-white/50">Type</span>
          <select
            aria-label="type"
            value={type}
            onChange={(e) => setType(e.target.value as RefundType)}
            className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
          >
            {REFUND_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-white/50">Reason</span>
          <textarea
            aria-label="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
          />
        </label>
        <p className="text-xs text-red-300">
          This charges the payment provider and cannot be undone.
        </p>
        <label className="block">
          <span className="text-xs text-white/60">
            Type <code className="text-white">{CONFIRM_WORD}</code> to confirm
          </span>
          <input
            aria-label="type refund to confirm"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
          />
        </label>
      </div>
      <div className="p-4 border-t border-white/8 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Issue refund
        </button>
      </div>
    </Shell>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR (no merge)**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/RefundInspector.test.tsx
npx tsc --noEmit
git add components/admin/support/inspectors/RefundInspector.tsx tests/unit/components/admin/support/inspectors/RefundInspector.test.tsx
git commit -m "feat(admin-v2): add RefundInspector (SUPER_ADMIN-gated, typed-confirm → issueRefund)"
git push -u origin wave9p9/task-15-refund-inspector
gh pr create --title "feat(admin-v2): Phase 9 W5 RefundInspector" --body "Right-slide inspector. amount/type/reason; disabled explanation when !isSuperAdmin; typed-REFUND confirm (modeled on AnonymizeConfirmDialog)→issueRefund. 4 tests passing." # do not merge
```

---

### Task 16: `CannedResponseManagerInspector.tsx`

**Wave:** 5 | **Parallel-safe with:** Tasks 12, 13, 14, 15, 17 | **Branch:** `wave9p9/task-16-canned-response-manager` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props are `CannedResponseManagerInspectorProps` (Shared Contracts, verbatim): `{ open: boolean; responses: CannedResponseRow[]; onClose: () => void }`.
- `CannedResponseRow = { id, title, body, category, isActive, createdAt, updatedAt }`.
- Lists `responses` (the manager receives both active + inactive via `loadAllCannedResponses`). Each row shows title/category/active state with **Edit** and **Delete** controls.
- Create: a "New" form (title + body + optional category) → `createCannedResponse({ title, body, category })`.
- Edit: selecting a row populates the form; saving an existing row → `updateCannedResponse(id, patch)` with the edited `{ title, body, category }`.
- Delete: → `deleteCannedResponse(id)` (soft, `isActive=false`).
- Toast on each result (`toast.success` / `toast.error`). The inspector stays open after a CRUD op (manager workflow) — only the ✕/Cancel/backdrop calls `onClose()`. Renders nothing when `!open`.

**Files:**
- Create: `components/admin/support/inspectors/CannedResponseManagerInspector.tsx`
- Test: `tests/unit/components/admin/support/inspectors/CannedResponseManagerInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

> Confirm the real `createCannedResponse` / `updateCannedResponse` / `deleteCannedResponse` signatures in `app/admin/support/actions.ts` before relying on these mocks (Shared Contracts is canonical: `createCannedResponse({ title, body, category? })`, `updateCannedResponse(id, patch)`, `deleteCannedResponse(id)`).

```tsx
// tests/unit/components/admin/support/inspectors/CannedResponseManagerInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createCannedResponse = vi.fn()
const updateCannedResponse = vi.fn()
const deleteCannedResponse = vi.fn()
vi.mock('@/app/admin/support/actions', () => ({
  createCannedResponse: (...a: unknown[]) => createCannedResponse(...a),
  updateCannedResponse: (...a: unknown[]) => updateCannedResponse(...a),
  deleteCannedResponse: (...a: unknown[]) => deleteCannedResponse(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CannedResponseManagerInspector } from '@/components/admin/support/inspectors/CannedResponseManagerInspector'
import type { CannedResponseRow } from '@/lib/admin/support'

const responses: CannedResponseRow[] = [
  {
    id: 'cr1', title: 'Greeting', body: 'Hi there!', category: 'general',
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 'cr2', title: 'Refund info', body: 'Refunds take 5 days.', category: 'refund',
    isActive: false, createdAt: new Date(), updatedAt: new Date(),
  },
]

beforeEach(() => vi.clearAllMocks())

describe('CannedResponseManagerInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CannedResponseManagerInspector open={false} responses={responses} onClose={() => {}} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('lists existing responses', () => {
    render(
      <CannedResponseManagerInspector open responses={responses} onClose={() => {}} />,
    )
    expect(screen.getByText('Greeting')).toBeTruthy()
    expect(screen.getByText('Refund info')).toBeTruthy()
  })

  it('creates a new response', async () => {
    createCannedResponse.mockResolvedValue({ ok: true, data: { id: 'cr3' } })
    render(
      <CannedResponseManagerInspector open responses={responses} onClose={() => {}} />,
    )
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Bye' } })
    fireEvent.change(screen.getByLabelText(/body/i), { target: { value: 'Goodbye!' } })
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'general' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() =>
      expect(createCannedResponse).toHaveBeenCalledWith({
        title: 'Bye',
        body: 'Goodbye!',
        category: 'general',
      }),
    )
  })

  it('edits an existing response', async () => {
    updateCannedResponse.mockResolvedValue({ ok: true })
    render(
      <CannedResponseManagerInspector open responses={responses} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /edit greeting/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateCannedResponse).toHaveBeenCalled())
    expect(updateCannedResponse.mock.calls[0][0]).toBe('cr1')
    expect(updateCannedResponse.mock.calls[0][1].title).toBe('Hello')
  })

  it('deletes a response', async () => {
    deleteCannedResponse.mockResolvedValue({ ok: true })
    render(
      <CannedResponseManagerInspector open responses={responses} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete greeting/i }))
    await waitFor(() => expect(deleteCannedResponse).toHaveBeenCalledWith('cr1'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/CannedResponseManagerInspector.test.tsx
```

- [ ] **Step 3: Write `components/admin/support/inspectors/CannedResponseManagerInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { CannedResponseRow } from '@/lib/admin/support'
import {
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from '@/app/admin/support/actions'
import { toast } from '@/lib/toast'

export interface CannedResponseManagerInspectorProps {
  open: boolean
  responses: CannedResponseRow[]
  onClose: () => void
}

export function CannedResponseManagerInspector({
  open, responses, onClose,
}: CannedResponseManagerInspectorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setBody('')
    setCategory('')
  }

  const startEdit = (r: CannedResponseRow) => {
    setEditingId(r.id)
    setTitle(r.title)
    setBody(r.body)
    setCategory(r.category ?? '')
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const cat = category.trim() || undefined
      const r = editingId
        ? await updateCannedResponse(editingId, {
            title: title.trim(),
            body,
            category: cat,
          })
        : await createCannedResponse({
            title: title.trim(),
            body,
            category: cat,
          })
      if (r.ok) {
        toast.success(editingId ? 'Response updated' : 'Response created')
        resetForm()
      } else {
        toast.error(r.error)
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const r = await deleteCannedResponse(id)
      if (r.ok) {
        toast.success('Response deleted')
        if (editingId === id) resetForm()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Manage canned responses" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Canned responses</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>

        <ul className="p-4 space-y-2 text-sm border-b border-white/8">
          {responses.length === 0 && (
            <li className="text-xs text-white/40">No canned responses yet.</li>
          )}
          {responses.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white/4 border border-white/8"
            >
              <div className="min-w-0">
                <div className="text-white truncate">{r.title}</div>
                <div className="text-xs text-white/40 truncate">
                  {r.category ?? 'uncategorized'}
                  {!r.isActive && ' · inactive'}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Edit ${r.title}`}
                  onClick={() => startEdit(r)}
                  className="text-xs px-2 py-1 rounded bg-white/5 text-white/70 hover:bg-white/10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${r.title}`}
                  onClick={() => handleDelete(r.id)}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded bg-red-500/80 text-white hover:bg-red-400 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="p-4 space-y-3 text-sm">
          <h3 className="text-xs font-semibold text-white/70">
            {editingId ? 'Edit response' : 'New response'}
          </h3>
          <label className="block">
            <span className="text-xs text-white/50">Title</span>
            <input
              aria-label="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Category</span>
            <input
              aria-label="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Body</span>
            <textarea
              aria-label="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
              >
                Cancel edit
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || title.trim() === '' || body.trim() === ''}
              className="text-xs px-3 py-1.5 rounded bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingId ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR (no merge)**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/CannedResponseManagerInspector.test.tsx
npx tsc --noEmit
git add components/admin/support/inspectors/CannedResponseManagerInspector.tsx tests/unit/components/admin/support/inspectors/CannedResponseManagerInspector.test.tsx
git commit -m "feat(admin-v2): add CannedResponseManagerInspector (list + create/edit/delete)"
git push -u origin wave9p9/task-16-canned-response-manager
gh pr create --title "feat(admin-v2): Phase 9 W5 CannedResponseManagerInspector" --body "Right-slide inspector. Lists responses; create/edit→create/updateCannedResponse; delete→deleteCannedResponse (soft). 5 tests passing." # do not merge
```

---

### Task 17: `CannedResponsePicker.tsx`

**Wave:** 5 | **Parallel-safe with:** Tasks 12, 13, 14, 15, 16 | **Branch:** `wave9p9/task-17-canned-response-picker` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props are `CannedResponsePickerProps` (Shared Contracts, verbatim): `{ responses: CannedResponseRow[]; onPick: (body: string) => void }`.
- **Pure presentational — NO server action.** It is a dropdown of `responses`; on selecting a response it calls `onPick(response.body)`. The embedding composer (T23) owns insertion into the textarea.
- Defensive: only show **active** responses (`isActive`). The picker receives active-only from `loadCannedResponses` in practice, but filter again so it is correct regardless of caller.
- A `<select>` with a placeholder first option; on change, look up the row by `id` and call `onPick(row.body)`. Reset the select back to the placeholder after picking so the same response can be picked twice.
- Always renders (no `open` prop). If there are no active responses, render a disabled select with a "No canned responses" placeholder.

**Files:**
- Create: `components/admin/support/inspectors/CannedResponsePicker.tsx`
- Test: `tests/unit/components/admin/support/inspectors/CannedResponsePicker.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

> This component calls **no** server action — no action mock needed. `onPick` is asserted directly.

```tsx
// tests/unit/components/admin/support/inspectors/CannedResponsePicker.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { CannedResponsePicker } from '@/components/admin/support/inspectors/CannedResponsePicker'
import type { CannedResponseRow } from '@/lib/admin/support'

const responses: CannedResponseRow[] = [
  {
    id: 'cr1', title: 'Greeting', body: 'Hi there!', category: 'general',
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 'cr2', title: 'Inactive', body: 'should not show', category: null,
    isActive: false, createdAt: new Date(), updatedAt: new Date(),
  },
]

beforeEach(() => vi.clearAllMocks())

describe('CannedResponsePicker', () => {
  it('lists only active responses', () => {
    render(<CannedResponsePicker responses={responses} onPick={() => {}} />)
    expect(screen.getByText('Greeting')).toBeTruthy()
    expect(screen.queryByText('Inactive')).toBeNull()
  })

  it('calls onPick with the response body on select', () => {
    const onPick = vi.fn()
    render(<CannedResponsePicker responses={responses} onPick={onPick} />)
    fireEvent.change(screen.getByLabelText(/insert canned response/i), {
      target: { value: 'cr1' },
    })
    expect(onPick).toHaveBeenCalledWith('Hi there!')
  })

  it('resets to placeholder after picking', () => {
    render(<CannedResponsePicker responses={responses} onPick={() => {}} />)
    const select = screen.getByLabelText(/insert canned response/i) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'cr1' } })
    expect(select.value).toBe('')
  })

  it('renders disabled when no active responses', () => {
    render(
      <CannedResponsePicker
        responses={[responses[1]]}
        onPick={() => {}}
      />,
    )
    const select = screen.getByLabelText(/insert canned response/i) as HTMLSelectElement
    expect(select.disabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/CannedResponsePicker.test.tsx
```

- [ ] **Step 3: Write `components/admin/support/inspectors/CannedResponsePicker.tsx`**

```tsx
'use client'

import type { ChangeEvent } from 'react'
import type { CannedResponseRow } from '@/lib/admin/support'

export interface CannedResponsePickerProps {
  responses: CannedResponseRow[]
  onPick: (body: string) => void
}

export function CannedResponsePicker({ responses, onPick }: CannedResponsePickerProps) {
  const active = responses.filter((r) => r.isActive)

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    if (!id) return
    const row = active.find((r) => r.id === id)
    if (row) onPick(row.body)
    e.target.value = ''
  }

  return (
    <select
      aria-label="Insert canned response"
      defaultValue=""
      disabled={active.length === 0}
      onChange={handleChange}
      className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white text-xs disabled:opacity-50"
    >
      <option value="" disabled>
        {active.length === 0 ? 'No canned responses' : 'Insert canned response…'}
      </option>
      {active.map((r) => (
        <option key={r.id} value={r.id}>
          {r.title}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR (no merge)**

```bash
npx vitest run tests/unit/components/admin/support/inspectors/CannedResponsePicker.test.tsx
npx tsc --noEmit
git add components/admin/support/inspectors/CannedResponsePicker.tsx tests/unit/components/admin/support/inspectors/CannedResponsePicker.test.tsx
git commit -m "feat(admin-v2): add CannedResponsePicker (active-only dropdown → onPick(body))"
git push -u origin wave9p9/task-17-canned-response-picker
gh pr create --title "feat(admin-v2): Phase 9 W5 CannedResponsePicker" --body "Pure presentational dropdown of active canned responses; onPick(body) on select; resets to placeholder; disabled when empty. No server action. 4 tests passing." # do not merge
```

---
## Wave 6 — Live chat + SSE (Task 18 first, then 19-21 parallel, after W2 merged)

> **Wave dependency:** All of W6 depends on **W2 merged** (it consumes `lib/admin/support.ts` types — `ChatQueueRow`, `ChatSessionData`, `ChatMessageRow`, `AgentAvailabilityData` — and `app/admin/support/actions.ts` actions — `acceptChatSession`, `closeChatSession`, `sendChatMessage`, `setAgentAvailability`). **Task 18 must merge before Tasks 19-21** because Task 20's `AdminChatPanelV2` statically imports `useSupportChatStream` (Phase 8 lesson #8: Vite's static import-analysis resolves a `'use client'` component's imports BEFORE `vi.mock` can intercept — the hook module must exist on disk before the panel test can pass). Tasks 19, 20, 21 are mutually disjoint and run in parallel once Task 18 is merged.
>
> **Worktree note (every task):** Each task runs in its own git worktree off `main`. Worktrees have no `node_modules` — symlink the repo root's before running anything: `ln -s <repo-root>/node_modules node_modules`. This repo uses **npm, never pnpm** (pnpm creates a spurious `pnpm-lock.yaml`). Single-file test: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`.

---

### Task 18: SSE stream endpoint + `useSupportChatStream` client hook

**Wave:** 6 (first — Tasks 19-21 depend on this merging) | **Parallel-safe with:** none in W6 | **Branch:** `wave9p9/task-18-sse-stream` | **Model:** sonnet

**Schema / contract realities for this task:**
- **SSE contract (Shared Contracts §"SSE contract (T18)"), VERBATIM:**
  - Endpoint: `GET /api/admin/support/chat/[sessionId]/stream?cursor=<iso>` → `Content-Type: text/event-stream`.
  - Each event frame: `id: <message.createdAt ISO>\nevent: message\ndata: <JSON ChatMessageRow>\n\n`. Periodic `: keepalive\n\n` comments. Stream self-closes after ~50s; client reconnects with `?cursor=<last event id>`.
  - Hook signature: `useSupportChatStream(sessionId: string, initialCursor: string | null)` returns `{ messages: ChatMessageRow[]; connected: boolean }`. Uses `EventSource`, parses `data` JSON, dedupes by `id`, reconnects on `error`/close with the latest cursor; falls back to polling `/api/chat/live/[sessionId]` when `EventSource` is `undefined`.
- The stream reads the **same `LiveChatMessage` table** the existing polling route (`app/api/chat/live/[sessionId]/route.ts`) reads. The session is keyed by `LiveChatSession.sessionId` (the public uuid), but `LiveChatMessage.sessionId` is the **`LiveChatSession.id`** FK (see existing route: it looks up the session by `sessionId` then queries messages by `chatSession.id`). The stream loop must resolve the session row once up front, then poll `LiveChatMessage WHERE sessionId = <session.id> AND createdAt > cursor`.
- `LiveChatMessage` columns are `{ id, sessionId, message, senderType, senderId, senderName, isRead, readAt, createdAt }` (see §3 of the spec). The wire `ChatMessageRow` shape is `{ id, body, senderType, senderName, createdAt }` — so the row mapper renames `message → body` and drops the rest.
- **Auth:** gate with the API-route overload `requireAdmin(request)` from `@/lib/auth/admin` (reads the `auth_session` cookie from the `NextRequest`; throws if not an admin). On throw, return `401`.
- **Testability design (REQUIRED):** all unit-testable logic lives in **pure functions** in `lib/admin/support-chat-stream.ts` that the route imports — so the route's frame formatting, cursor parsing, and "messages since cursor" query shaping are unit-tested **without a live stream** (full network streaming is integration-tested in the QA doc). Pure helpers: `parseCursor(url)`, `mapChatMessageRow(row)`, `formatSseFrame(msg)`, `formatKeepalive()`, `buildMessagesSinceQuery(internalSessionId, cursor)`, plus the timing constants `SSE_POLL_INTERVAL_MS`, `SSE_KEEPALIVE_INTERVAL_MS`, `SSE_MAX_LIFETIME_MS`.

**Files:**
- Create: `lib/admin/support-chat-stream.ts` (pure helpers — the route imports these)
- Create: `app/api/admin/support/chat/[sessionId]/stream/route.ts` (Next.js 16 route handler returning a `ReadableStream`)
- Create: `components/admin/support/chat/useSupportChatStream.ts` (client hook)
- Test: `tests/unit/lib/admin/support-chat-stream.test.ts` (pure-helper unit tests)
- Test: `tests/unit/components/admin/support/chat/useSupportChatStream.test.tsx` (hook test with mocked `EventSource`)

#### Steps

- [ ] **Step 1: Write the failing helper test** — `tests/unit/lib/admin/support-chat-stream.test.ts`

```ts
// tests/unit/lib/admin/support-chat-stream.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseCursor,
  mapChatMessageRow,
  formatSseFrame,
  formatKeepalive,
  buildMessagesSinceQuery,
  SSE_POLL_INTERVAL_MS,
  SSE_KEEPALIVE_INTERVAL_MS,
  SSE_MAX_LIFETIME_MS,
  type ChatMessageRow,
} from '@/lib/admin/support-chat-stream'

describe('support-chat-stream helpers', () => {
  describe('parseCursor', () => {
    it('returns null when no cursor query param', () => {
      expect(parseCursor(new URL('https://x.test/stream'))).toBeNull()
    })

    it('parses a valid ISO cursor into a Date', () => {
      const iso = '2026-06-19T10:00:00.000Z'
      const cursor = parseCursor(new URL(`https://x.test/stream?cursor=${encodeURIComponent(iso)}`))
      expect(cursor).toBeInstanceOf(Date)
      expect(cursor?.toISOString()).toBe(iso)
    })

    it('returns null for a non-parseable cursor', () => {
      expect(parseCursor(new URL('https://x.test/stream?cursor=not-a-date'))).toBeNull()
    })
  })

  describe('mapChatMessageRow', () => {
    it('renames message->body and keeps only the wire fields', () => {
      const createdAt = new Date('2026-06-19T10:00:00.000Z')
      const row = mapChatMessageRow({
        id: 'm1',
        sessionId: 'internal-1',
        message: 'hello there',
        senderType: 'admin',
        senderId: 'a1',
        senderName: 'Agent Smith',
        isRead: false,
        readAt: null,
        createdAt,
      })
      expect(row).toEqual({
        id: 'm1',
        body: 'hello there',
        senderType: 'admin',
        senderName: 'Agent Smith',
        createdAt,
      })
    })
  })

  describe('formatSseFrame', () => {
    it('formats id/event/data lines terminated by a blank line', () => {
      const createdAt = new Date('2026-06-19T10:00:00.000Z')
      const msg: ChatMessageRow = {
        id: 'm1',
        body: 'hi',
        senderType: 'customer',
        senderName: 'Ada',
        createdAt,
      }
      const frame = formatSseFrame(msg)
      expect(frame).toBe(
        `id: ${createdAt.toISOString()}\n` +
          `event: message\n` +
          `data: ${JSON.stringify(msg)}\n\n`,
      )
    })

    it('uses the message createdAt ISO as the SSE id (so reconnect cursor advances)', () => {
      const createdAt = new Date('2026-06-19T11:22:33.444Z')
      const frame = formatSseFrame({
        id: 'm2',
        body: 'next',
        senderType: 'admin',
        senderName: 'Agent',
        createdAt,
      })
      expect(frame.startsWith(`id: ${createdAt.toISOString()}\n`)).toBe(true)
    })
  })

  describe('formatKeepalive', () => {
    it('is an SSE comment terminated by a blank line', () => {
      expect(formatKeepalive()).toBe(': keepalive\n\n')
    })
  })

  describe('buildMessagesSinceQuery', () => {
    it('shapes a where/orderBy querying by internal session id with no cursor', () => {
      const q = buildMessagesSinceQuery('internal-1', null)
      expect(q).toEqual({
        where: { sessionId: 'internal-1' },
        orderBy: { createdAt: 'asc' },
      })
    })

    it('adds a createdAt > cursor filter when a cursor is present', () => {
      const cursor = new Date('2026-06-19T10:00:00.000Z')
      const q = buildMessagesSinceQuery('internal-1', cursor)
      expect(q).toEqual({
        where: { sessionId: 'internal-1', createdAt: { gt: cursor } },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('timing constants', () => {
    it('polls faster than it keepalives, and self-closes under the serverless limit', () => {
      expect(SSE_POLL_INTERVAL_MS).toBe(1500)
      expect(SSE_KEEPALIVE_INTERVAL_MS).toBeGreaterThan(SSE_POLL_INTERVAL_MS)
      expect(SSE_MAX_LIFETIME_MS).toBe(50_000)
      expect(SSE_MAX_LIFETIME_MS).toBeLessThan(60_000)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/unit/lib/admin/support-chat-stream.test.ts` — expect module not found.

- [ ] **Step 3: Write the pure helpers** — `lib/admin/support-chat-stream.ts`

```ts
// lib/admin/support-chat-stream.ts
//
// Pure helpers for the admin live-chat SSE stream. Kept separate from the route
// handler so frame formatting, cursor parsing, row mapping, and query shaping are
// unit-testable without a live network stream (full streaming is integration-tested
// in the Phase 9 QA doc). The route handler in
// app/api/admin/support/chat/[sessionId]/stream/route.ts imports everything below.

/** Wire shape pushed to admin clients — mirrors Shared Contracts ChatMessageRow. */
export interface ChatMessageRow {
  id: string
  body: string
  senderType: string // "customer" | "admin" | "system"
  senderName: string
  createdAt: Date
}

/** The subset of LiveChatMessage columns the mapper reads (Prisma row). */
export interface LiveChatMessageRecord {
  id: string
  sessionId: string
  message: string
  senderType: string
  senderId: string | null
  senderName: string
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}

/** Server poll cadence: query LiveChatMessage since cursor this often. */
export const SSE_POLL_INTERVAL_MS = 1500
/** Emit a `: keepalive` comment at least this often to keep proxies from idling. */
export const SSE_KEEPALIVE_INTERVAL_MS = 15_000
/** Self-close the stream after this long (under the serverless function limit). */
export const SSE_MAX_LIFETIME_MS = 50_000

/**
 * Read the `?cursor=<iso>` query param off a request URL and parse it to a Date.
 * Returns null when absent or unparseable (caller treats null as "send full history").
 */
export function parseCursor(url: URL): Date | null {
  const raw = url.searchParams.get('cursor')
  if (!raw) return null
  const ms = Date.parse(raw)
  if (Number.isNaN(ms)) return null
  return new Date(ms)
}

/** Map a Prisma LiveChatMessage row to the wire ChatMessageRow (message -> body). */
export function mapChatMessageRow(row: LiveChatMessageRecord): ChatMessageRow {
  return {
    id: row.id,
    body: row.message,
    senderType: row.senderType,
    senderName: row.senderName,
    createdAt: row.createdAt,
  }
}

/**
 * Format one SSE event frame. The `id:` line is the message createdAt ISO string so
 * the browser EventSource exposes it as `lastEventId` and the client reconnects with
 * `?cursor=<that iso>` — advancing the cursor past every delivered message.
 */
export function formatSseFrame(msg: ChatMessageRow): string {
  return (
    `id: ${msg.createdAt.toISOString()}\n` +
    `event: message\n` +
    `data: ${JSON.stringify(msg)}\n\n`
  )
}

/** An SSE keepalive comment (ignored by clients; keeps the connection warm). */
export function formatKeepalive(): string {
  return ': keepalive\n\n'
}

/**
 * Shape the Prisma findMany args for "messages since cursor" on a session.
 * `internalSessionId` is LiveChatSession.id (the LiveChatMessage.sessionId FK).
 */
export function buildMessagesSinceQuery(internalSessionId: string, cursor: Date | null) {
  return {
    where: cursor
      ? { sessionId: internalSessionId, createdAt: { gt: cursor } }
      : { sessionId: internalSessionId },
    orderBy: { createdAt: 'asc' as const },
  }
}
```

- [ ] **Step 4: Re-run helper test** — `npx vitest run tests/unit/lib/admin/support-chat-stream.test.ts` — expect green.

- [ ] **Step 5: Write the route handler** — `app/api/admin/support/chat/[sessionId]/stream/route.ts`

```ts
// app/api/admin/support/chat/[sessionId]/stream/route.ts
//
// GET /api/admin/support/chat/[sessionId]/stream?cursor=<iso> -> text/event-stream
//
// Admin-auth-gated SSE endpoint. Resolves the LiveChatSession once, then server-side
// polls LiveChatMessage for rows created after the cursor every ~1.5s, enqueuing one
// SSE frame per new message (id = message createdAt ISO). Emits periodic `: keepalive`
// comments and self-closes after ~50s; the client EventSource reconnects with the last
// event id as the new cursor. Reads the same LiveChatMessage table as the legacy
// polling route (app/api/chat/live/[sessionId]/route.ts), which remains for the
// customer widget + as an admin fallback.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/admin'
import {
  parseCursor,
  mapChatMessageRow,
  formatSseFrame,
  formatKeepalive,
  buildMessagesSinceQuery,
  SSE_POLL_INTERVAL_MS,
  SSE_KEEPALIVE_INTERVAL_MS,
  SSE_MAX_LIFETIME_MS,
} from '@/lib/admin/support-chat-stream'

// Long-lived connection: never statically optimize, always run on the Node runtime.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth-gate at connection (API-route overload reads the auth_session cookie).
  try {
    await requireAdmin(request)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = await params

  // Resolve the session once: LiveChatMessage.sessionId is the LiveChatSession.id FK,
  // but the public route key is LiveChatSession.sessionId (the uuid).
  const session = await prisma.liveChatSession.findUnique({
    where: { sessionId },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  const internalSessionId = session.id

  const url = new URL(request.url)
  let cursor = parseCursor(url)

  const encoder = new TextEncoder()
  const startedAt = Date.now()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      let pollTimer: ReturnType<typeof setInterval> | null = null
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null
      let lifetimeTimer: ReturnType<typeof setTimeout> | null = null

      const cleanup = () => {
        if (closed) return
        closed = true
        if (pollTimer) clearInterval(pollTimer)
        if (keepaliveTimer) clearInterval(keepaliveTimer)
        if (lifetimeTimer) clearTimeout(lifetimeTimer)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      // Client disconnected (tab closed / navigated away) -> stop polling.
      request.signal.addEventListener('abort', cleanup)

      const poll = async () => {
        if (closed) return
        try {
          const rows = await prisma.liveChatMessage.findMany(
            buildMessagesSinceQuery(internalSessionId, cursor),
          )
          for (const row of rows) {
            const msg = mapChatMessageRow(row)
            controller.enqueue(encoder.encode(formatSseFrame(msg)))
            // Advance cursor past the newest delivered message.
            if (!cursor || row.createdAt > cursor) cursor = row.createdAt
          }
        } catch (error) {
          console.error('SSE poll error:', error)
          cleanup()
        }
      }

      // Immediate first poll so reconnects flush backlog without waiting a tick.
      await poll()
      if (closed) return

      pollTimer = setInterval(poll, SSE_POLL_INTERVAL_MS)
      keepaliveTimer = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(formatKeepalive()))
        } catch {
          cleanup()
        }
      }, SSE_KEEPALIVE_INTERVAL_MS)

      // Self-close under the serverless function duration cap; client auto-reconnects.
      const remaining = Math.max(0, SSE_MAX_LIFETIME_MS - (Date.now() - startedAt))
      lifetimeTimer = setTimeout(cleanup, remaining)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

- [ ] **Step 6: Write the failing hook test** — `tests/unit/components/admin/support/chat/useSupportChatStream.test.tsx`

```tsx
// tests/unit/components/admin/support/chat/useSupportChatStream.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// --- Mock EventSource -------------------------------------------------------
type Listener = (ev: MessageEvent) => void

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  readyState = 0
  onerror: ((ev: Event) => void) | null = null
  private listeners: Record<string, Listener[]> = {}

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: Listener) {
    ;(this.listeners[type] ||= []).push(cb)
  }

  removeEventListener(type: string, cb: Listener) {
    this.listeners[type] = (this.listeners[type] || []).filter((l) => l !== cb)
  }

  close() {
    this.readyState = 2
  }

  // Test helpers ------------------------------------------------------------
  emitMessage(data: unknown, lastEventId: string) {
    const ev = { data: JSON.stringify(data), lastEventId } as MessageEvent
    for (const cb of this.listeners['message'] || []) cb(ev)
  }

  emitOpen() {
    this.readyState = 1
    for (const cb of this.listeners['open'] || []) cb({} as MessageEvent)
  }

  emitError() {
    this.readyState = 2
    this.onerror?.({} as Event)
  }

  static last() {
    return MockEventSource.instances[MockEventSource.instances.length - 1]
  }

  static reset() {
    MockEventSource.instances = []
  }
}

import { useSupportChatStream } from '@/components/admin/support/chat/useSupportChatStream'
import type { ChatMessageRow } from '@/lib/admin/support-chat-stream'

function msg(id: string, body: string, createdAtIso: string): ChatMessageRow {
  return { id, body, senderType: 'customer', senderName: 'Ada', createdAt: new Date(createdAtIso) }
}

beforeEach(() => {
  vi.useFakeTimers()
  MockEventSource.reset()
  // @ts-expect-error — install the mock global for the hook to pick up.
  global.EventSource = MockEventSource
})

afterEach(() => {
  vi.useRealTimers()
  // @ts-expect-error — tear down.
  delete global.EventSource
})

describe('useSupportChatStream', () => {
  it('opens an EventSource with the initial cursor and accumulates messages', async () => {
    const { result } = renderHook(() => useSupportChatStream('sess-1', '2026-06-19T09:00:00.000Z'))

    const es = MockEventSource.last()
    expect(es.url).toContain('/api/admin/support/chat/sess-1/stream')
    expect(es.url).toContain('cursor=2026-06-19T09%3A00%3A00.000Z')

    act(() => {
      es.emitOpen()
      es.emitMessage(msg('m1', 'hello', '2026-06-19T10:00:00.000Z'), '2026-06-19T10:00:00.000Z')
      es.emitMessage(msg('m2', 'world', '2026-06-19T10:00:01.000Z'), '2026-06-19T10:00:01.000Z')
    })

    expect(result.current.connected).toBe(true)
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('dedupes messages by id (redelivery after reconnect)', () => {
    const { result } = renderHook(() => useSupportChatStream('sess-1', null))
    const es = MockEventSource.last()

    act(() => {
      es.emitMessage(msg('m1', 'hello', '2026-06-19T10:00:00.000Z'), '2026-06-19T10:00:00.000Z')
      es.emitMessage(msg('m1', 'hello', '2026-06-19T10:00:00.000Z'), '2026-06-19T10:00:00.000Z')
    })

    expect(result.current.messages).toHaveLength(1)
  })

  it('reconnects after an error with the latest event id as the new cursor', async () => {
    const { result } = renderHook(() => useSupportChatStream('sess-1', null))
    const first = MockEventSource.last()

    act(() => {
      first.emitMessage(msg('m1', 'hi', '2026-06-19T10:00:00.000Z'), '2026-06-19T10:00:00.000Z')
      first.emitError()
    })
    expect(result.current.connected).toBe(false)

    // Reconnect is scheduled on a short backoff timer.
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const second = MockEventSource.last()
    expect(second).not.toBe(first)
    // New connection resumes from the last delivered message's createdAt ISO.
    expect(second.url).toContain('cursor=2026-06-19T10%3A00%3A00.000Z')

    // Backlog redelivered after reconnect is still deduped.
    act(() => {
      second.emitMessage(msg('m1', 'hi', '2026-06-19T10:00:00.000Z'), '2026-06-19T10:00:00.000Z')
      second.emitMessage(msg('m2', 'again', '2026-06-19T10:00:05.000Z'), '2026-06-19T10:00:05.000Z')
    })
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('falls back to polling /api/chat/live/[sessionId] when EventSource is undefined', async () => {
    // @ts-expect-error — simulate a runtime with no EventSource.
    delete global.EventSource

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          messages: [
            {
              id: 'p1',
              message: 'polled',
              senderType: 'customer',
              senderName: 'Ada',
              createdAt: '2026-06-19T10:00:00.000Z',
            },
          ],
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useSupportChatStream('sess-1', null))

    // First poll fires on mount.
    await act(async () => {
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/live/sess-1')
      expect(result.current.messages.map((m) => m.id)).toEqual(['p1'])
      expect(result.current.messages[0]?.body).toBe('polled')
    })

    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 7: Run hook test to verify it fails** — `npx vitest run tests/unit/components/admin/support/chat/useSupportChatStream.test.tsx` — expect module not found.

- [ ] **Step 8: Write the client hook** — `components/admin/support/chat/useSupportChatStream.ts`

```ts
// components/admin/support/chat/useSupportChatStream.ts
'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChatMessageRow } from '@/lib/admin/support-chat-stream'

const RECONNECT_BACKOFF_MS = 2000
const POLL_FALLBACK_INTERVAL_MS = 3000

/** Raw LiveChatMessage shape returned by the legacy polling fallback endpoint. */
interface PolledMessage {
  id: string
  message: string
  senderType: string
  senderName: string
  createdAt: string
}

/**
 * Subscribe to an admin live-chat session over SSE.
 *
 * - Opens an EventSource at /api/admin/support/chat/<sessionId>/stream?cursor=<iso>.
 * - Parses each `message` event's JSON into a ChatMessageRow, dedupes by id.
 * - Tracks the latest delivered message's createdAt ISO as the cursor; on error/close
 *   it reconnects after a short backoff using that cursor (the SSE `id:` line is the
 *   message createdAt ISO, surfaced as `lastEventId`).
 * - If `EventSource` is undefined (e.g. non-browser runtime), falls back to polling
 *   the legacy /api/chat/live/<sessionId> endpoint every 3s.
 *
 * Returns `{ messages, connected }`.
 */
export function useSupportChatStream(
  sessionId: string,
  initialCursor: string | null,
): { messages: ChatMessageRow[]; connected: boolean } {
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [connected, setConnected] = useState(false)

  // Refs survive re-renders without re-subscribing the effect.
  const seenIds = useRef<Set<string>>(new Set())
  const cursorRef = useRef<string | null>(initialCursor)

  // De-duplicating appender shared by SSE + polling paths.
  const appendMessage = (row: ChatMessageRow, eventId?: string) => {
    if (seenIds.current.has(row.id)) return
    seenIds.current.add(row.id)
    setMessages((prev) => [...prev, row])
    // Advance the reconnect cursor to the last delivered message.
    cursorRef.current = eventId ?? row.createdAt.toISOString()
  }

  useEffect(() => {
    // Reset per-session state when the session changes.
    seenIds.current = new Set()
    cursorRef.current = initialCursor
    setMessages([])
    setConnected(false)

    let disposed = false
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const buildUrl = () => {
      const base = `/api/admin/support/chat/${sessionId}/stream`
      const cursor = cursorRef.current
      return cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base
    }

    const connect = () => {
      if (disposed) return
      es = new EventSource(buildUrl())

      es.addEventListener('open', () => {
        if (disposed) return
        setConnected(true)
      })

      es.addEventListener('message', (ev: MessageEvent) => {
        if (disposed) return
        try {
          const parsed = JSON.parse(ev.data) as ChatMessageRow
          const row: ChatMessageRow = { ...parsed, createdAt: new Date(parsed.createdAt) }
          appendMessage(row, ev.lastEventId || undefined)
        } catch {
          // Ignore malformed frames.
        }
      })

      es.onerror = () => {
        if (disposed) return
        setConnected(false)
        es?.close()
        es = null
        // Reconnect with the advanced cursor after a short backoff.
        reconnectTimer = setTimeout(connect, RECONNECT_BACKOFF_MS)
      }
    }

    const pollOnce = async () => {
      if (disposed) return
      try {
        const res = await fetch(`/api/chat/live/${sessionId}`)
        if (!res.ok) return
        const json = (await res.json()) as { data?: { messages?: PolledMessage[] } }
        const rows = json.data?.messages ?? []
        if (disposed) return
        setConnected(true)
        for (const r of rows) {
          appendMessage({
            id: r.id,
            body: r.message,
            senderType: r.senderType,
            senderName: r.senderName,
            createdAt: new Date(r.createdAt),
          })
        }
      } catch {
        if (!disposed) setConnected(false)
      }
    }

    if (typeof EventSource === 'undefined') {
      // Polling fallback for runtimes without EventSource.
      void pollOnce()
      pollTimer = setInterval(pollOnce, POLL_FALLBACK_INTERVAL_MS)
    } else {
      connect()
    }

    return () => {
      disposed = true
      es?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [sessionId, initialCursor])

  return { messages, connected }
}
```

- [ ] **Step 9: Verify both tests + tsc + commit + PR**

```bash
npx vitest run tests/unit/lib/admin/support-chat-stream.test.ts tests/unit/components/admin/support/chat/useSupportChatStream.test.tsx
npx tsc --noEmit
git add lib/admin/support-chat-stream.ts \
  app/api/admin/support/chat/[sessionId]/stream/route.ts \
  components/admin/support/chat/useSupportChatStream.ts \
  tests/unit/lib/admin/support-chat-stream.test.ts \
  tests/unit/components/admin/support/chat/useSupportChatStream.test.tsx
git commit -m "feat(admin-v2): add live-chat SSE stream endpoint + useSupportChatStream hook"
git push -u origin wave9p9/task-18-sse-stream
gh pr create --title "feat(admin-v2): Phase 9 W6 SSE stream + useSupportChatStream hook" --body "GET /api/admin/support/chat/[sessionId]/stream returns a text/event-stream ReadableStream (admin-gated, server-side DB poll every 1.5s, keepalive comments, self-close at 50s). Pure frame/cursor/query helpers extracted to lib/admin/support-chat-stream.ts and unit-tested. Client hook useSupportChatStream uses EventSource with dedupe + reconnect-with-cursor + polling fallback to /api/chat/live/[sessionId]. Reads the same LiveChatMessage table as the preserved customer polling route. Helper + hook tests passing. NO MERGE — depends on W2."
```

> **Testability summary (record in the PR):** the route handler contains *no* untested branching logic — every decision (cursor parse, message→wire mapping, SSE frame bytes, since-cursor query args, timing) is a pure function in `lib/admin/support-chat-stream.ts` covered by `support-chat-stream.test.ts`. The route only wires those pures into a `ReadableStream` + timers, which is exercised end-to-end in the QA doc's manual SSE integration check.

---

### Task 19: `AdminChatQueueV2.tsx` — waiting-chat queue with Accept

**Wave:** 6 (after Task 18 merged) | **Parallel-safe with:** Tasks 20, 21 | **Branch:** `wave9p9/task-19-chat-queue` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props (Shared Contracts §"Component prop interfaces", VERBATIM): `interface AdminChatQueueV2Props { queue: ChatQueueRow[] }`.
- `ChatQueueRow = { id, sessionId, customerName, issueCategory, issueSummary, waitTime, requestedAt }` (`waitTime` is seconds or null; `requestedAt` is a `Date`).
- `'use client'` (it has interactive Accept buttons + local pending state). Use `import type { ChatQueueRow } from '@/lib/admin/support'`.
- Each row's "Accept" button calls the **server action** `acceptChatSession(sessionId)` from `@/app/admin/support/actions` (value-import of a server action from a client component is fine — Phase 8 precedent). On `{ ok: true }` toast success; on `{ ok: false }` toast the error. Disable the button while pending.
- Toasts via `@/lib/toast` (`toast.success`, `toast.error`).
- No `dark:` modifiers; always-dark direct colors mirroring `CustomerActivityTimeline` (`bg-neutral-900/60`, `border-white/8`, `text-white/50`).
- Empty state when `queue.length === 0`.

**Files:**
- Create: `components/admin/support/chat/AdminChatQueueV2.tsx`
- Test: `tests/unit/components/admin/support/chat/AdminChatQueueV2.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test** — `tests/unit/components/admin/support/chat/AdminChatQueueV2.test.tsx`

```tsx
// tests/unit/components/admin/support/chat/AdminChatQueueV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const acceptChatSession = vi.fn()
vi.mock('@/app/admin/support/actions', () => ({
  acceptChatSession: (...args: unknown[]) => acceptChatSession(...args),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('@/lib/toast', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}))

import { AdminChatQueueV2 } from '@/components/admin/support/chat/AdminChatQueueV2'
import type { ChatQueueRow } from '@/lib/admin/support'

const queue: ChatQueueRow[] = [
  {
    id: 'lcs-1',
    sessionId: 'sess-1',
    customerName: 'Ada Lovelace',
    issueCategory: 'ORDER_ISSUE',
    issueSummary: 'Where is my order?',
    waitTime: 95,
    requestedAt: new Date('2026-06-19T10:00:00.000Z'),
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminChatQueueV2', () => {
  it('renders an empty state when the queue is empty', () => {
    render(<AdminChatQueueV2 queue={[]} />)
    expect(screen.getByText(/no customers waiting/i)).toBeInTheDocument()
  })

  it('renders a row per waiting session', () => {
    render(<AdminChatQueueV2 queue={queue} />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText(/where is my order/i)).toBeInTheDocument()
  })

  it('accepts a chat and toasts success', async () => {
    acceptChatSession.mockResolvedValue({ ok: true })
    render(<AdminChatQueueV2 queue={queue} />)
    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() => {
      expect(acceptChatSession).toHaveBeenCalledWith('sess-1')
      expect(toastSuccess).toHaveBeenCalled()
    })
  })

  it('toasts the error when accept fails', async () => {
    acceptChatSession.mockResolvedValue({ ok: false, error: 'Session no longer available' })
    render(<AdminChatQueueV2 queue={queue} />)
    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Session no longer available')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/unit/components/admin/support/chat/AdminChatQueueV2.test.tsx` — expect module not found.

- [ ] **Step 3: Write the component** — `components/admin/support/chat/AdminChatQueueV2.tsx`

```tsx
// components/admin/support/chat/AdminChatQueueV2.tsx
'use client'

import { useState, useTransition } from 'react'
import { ChatCircle, Clock, User } from '@phosphor-icons/react'
import { acceptChatSession } from '@/app/admin/support/actions'
import { toast } from '@/lib/toast'
import type { ChatQueueRow } from '@/lib/admin/support'

export interface AdminChatQueueV2Props {
  queue: ChatQueueRow[]
}

function formatWaitTime(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function QueueRow({ row }: { row: ChatQueueRow }) {
  const [pending, startTransition] = useTransition()
  const [accepted, setAccepted] = useState(false)

  const handleAccept = () => {
    startTransition(async () => {
      const result = await acceptChatSession(row.sessionId)
      if (result.ok) {
        setAccepted(true)
        toast.success('Chat accepted', `Now chatting with ${row.customerName}`)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <li className="rounded-md border border-white/8 bg-neutral-900/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <User size={14} className="shrink-0 text-white/40" weight="bold" />
            <span className="font-medium text-white truncate">{row.customerName}</span>
            {row.issueCategory && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60 shrink-0">
                {row.issueCategory.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {row.issueSummary && (
            <p className="mt-1 text-xs text-white/60 line-clamp-2">{row.issueSummary}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-white/40">
            <Clock size={12} weight="bold" />
            <span>
              Waiting <span className="text-white/70">{formatWaitTime(row.waitTime)}</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAccept}
          disabled={pending || accepted}
          className="shrink-0 rounded-md bg-[#FF3131] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {accepted ? 'Accepted' : pending ? 'Accepting…' : 'Accept'}
        </button>
      </div>
    </li>
  )
}

export function AdminChatQueueV2({ queue }: AdminChatQueueV2Props) {
  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <ChatCircle size={16} weight="bold" />
          Live chat queue
        </h2>
        <span className="text-xs text-white/40">
          {queue.length} {queue.length === 1 ? 'waiting' : 'waiting'}
        </span>
      </header>
      {queue.length === 0 ? (
        <div className="p-6 text-center text-sm text-white/40">No customers waiting.</div>
      ) : (
        <ol className="p-3 space-y-2">
          {queue.map((row) => (
            <QueueRow key={row.id} row={row} />
          ))}
        </ol>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
npx vitest run tests/unit/components/admin/support/chat/AdminChatQueueV2.test.tsx
npx tsc --noEmit
git add components/admin/support/chat/AdminChatQueueV2.tsx tests/unit/components/admin/support/chat/AdminChatQueueV2.test.tsx
git commit -m "feat(admin-v2): add AdminChatQueueV2 (waiting-chat queue + Accept)"
git push -u origin wave9p9/task-19-chat-queue
gh pr create --title "feat(admin-v2): Phase 9 W6 AdminChatQueueV2" --body "Client queue of WAITING ChatQueueRow[]; each row Accept button calls acceptChatSession(sessionId) with toast + per-row pending/accepted state. Empty state when no one is waiting. 4 tests passing. NO MERGE — depends on W2 + Task 18."
```

---

### Task 20: `AdminChatPanelV2.tsx` — SSE-driven chat panel

**Wave:** 6 (after Task 18 merged) | **Parallel-safe with:** Tasks 19, 21 | **Branch:** `wave9p9/task-20-chat-panel` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props (Shared Contracts, VERBATIM): `interface AdminChatPanelV2Props { session: ChatSessionData }`.
- `ChatSessionData = { id, sessionId, status: 'WAITING'|'ACTIVE'|'CLOSED', customerName, customerEmail, issueCategory, issueSummary, acceptedAt, messages: ChatMessageRow[] }`. `ChatMessageRow = { id, body, senderType, senderName, createdAt }`.
- `'use client'`. Use `import type { ChatSessionData, ChatMessageRow } from '@/lib/admin/support'`.
- **Live updates:** subscribe via `useSupportChatStream(session.sessionId, lastCursor)` (from `@/components/admin/support/chat/useSupportChatStream` — merged in Task 18). `lastCursor` = the ISO `createdAt` of the last message in `session.messages` (or `null` if empty), computed once with `useMemo` so it does not change identity each render. The seed `session.messages` are rendered immediately; the hook's streamed messages are **merged in and deduped by id** with the seed (the hook only knows about post-cursor messages, so combine `session.messages` + `hook.messages`, dedupe by id, sort by `createdAt`).
- **Compose box** calls the server action `sendChatMessage(session.sessionId, body)`; clears the input on `{ ok: true }`, toasts the error on `{ ok: false }`. Disabled while pending or when `session.status === 'CLOSED'`.
- **"Close chat"** button calls `closeChatSession(session.sessionId)`; toast result. Hidden/disabled when already `CLOSED`.
- Actions imported from `@/app/admin/support/actions`; toasts from `@/lib/toast`.
- **Static-import-before-mock note (Phase 8 lesson #8):** because this panel statically imports `useSupportChatStream`, that module **must already exist on disk** (Task 18 merged) for this test to pass. The test `vi.mock`s the hook module, the actions module, and `@/lib/toast`.
- No `dark:`; always-dark direct colors.

**Files:**
- Create: `components/admin/support/chat/AdminChatPanelV2.tsx`
- Test: `tests/unit/components/admin/support/chat/AdminChatPanelV2.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test** — `tests/unit/components/admin/support/chat/AdminChatPanelV2.test.tsx`

```tsx
// tests/unit/components/admin/support/chat/AdminChatPanelV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ChatMessageRow } from '@/lib/admin/support'

// Mock the SSE hook (Task 18). Tests drive its return value.
const useSupportChatStream = vi.fn<() => { messages: ChatMessageRow[]; connected: boolean }>()
vi.mock('@/components/admin/support/chat/useSupportChatStream', () => ({
  useSupportChatStream: (...args: unknown[]) => useSupportChatStream(...args),
}))

const sendChatMessage = vi.fn()
const closeChatSession = vi.fn()
vi.mock('@/app/admin/support/actions', () => ({
  sendChatMessage: (...a: unknown[]) => sendChatMessage(...a),
  closeChatSession: (...a: unknown[]) => closeChatSession(...a),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('@/lib/toast', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}))

import { AdminChatPanelV2 } from '@/components/admin/support/chat/AdminChatPanelV2'
import type { ChatSessionData } from '@/lib/admin/support'

const baseSession: ChatSessionData = {
  id: 'lcs-1',
  sessionId: 'sess-1',
  status: 'ACTIVE',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@e.com',
  issueCategory: 'ORDER_ISSUE',
  issueSummary: 'Where is my order?',
  acceptedAt: new Date('2026-06-19T10:00:00.000Z'),
  messages: [
    { id: 'm0', body: 'Hi, I need help', senderType: 'customer', senderName: 'Ada', createdAt: new Date('2026-06-19T10:00:00.000Z') },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  useSupportChatStream.mockReturnValue({ messages: [], connected: true })
})

describe('AdminChatPanelV2', () => {
  it('subscribes to the stream with the session id and last-message cursor', () => {
    render(<AdminChatPanelV2 session={baseSession} />)
    expect(useSupportChatStream).toHaveBeenCalledWith('sess-1', '2026-06-19T10:00:00.000Z')
  })

  it('subscribes with a null cursor when there are no seed messages', () => {
    render(<AdminChatPanelV2 session={{ ...baseSession, messages: [] }} />)
    expect(useSupportChatStream).toHaveBeenCalledWith('sess-1', null)
  })

  it('renders seed messages and merges streamed messages, deduped by id', () => {
    useSupportChatStream.mockReturnValue({
      connected: true,
      messages: [
        { id: 'm0', body: 'Hi, I need help', senderType: 'customer', senderName: 'Ada', createdAt: new Date('2026-06-19T10:00:00.000Z') },
        { id: 'm1', body: 'On its way!', senderType: 'admin', senderName: 'Agent', createdAt: new Date('2026-06-19T10:01:00.000Z') },
      ],
    })
    render(<AdminChatPanelV2 session={baseSession} />)
    expect(screen.getAllByText('Hi, I need help')).toHaveLength(1) // deduped
    expect(screen.getByText('On its way!')).toBeInTheDocument()
  })

  it('sends a message and clears the input on success', async () => {
    sendChatMessage.mockResolvedValue({ ok: true })
    render(<AdminChatPanelV2 session={baseSession} />)
    const input = screen.getByPlaceholderText(/type your message/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hello!' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith('sess-1', 'Hello!')
      expect(input.value).toBe('')
    })
  })

  it('toasts the error when send fails', async () => {
    sendChatMessage.mockResolvedValue({ ok: false, error: 'Cannot send to closed session' })
    render(<AdminChatPanelV2 session={baseSession} />)
    fireEvent.change(screen.getByPlaceholderText(/type your message/i), { target: { value: 'Hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Cannot send to closed session')
    })
  })

  it('closes the chat and toasts success', async () => {
    closeChatSession.mockResolvedValue({ ok: true })
    render(<AdminChatPanelV2 session={baseSession} />)
    fireEvent.click(screen.getByRole('button', { name: /close chat/i }))
    await waitFor(() => {
      expect(closeChatSession).toHaveBeenCalledWith('sess-1')
      expect(toastSuccess).toHaveBeenCalled()
    })
  })

  it('disables compose + hides close when the session is CLOSED', () => {
    render(<AdminChatPanelV2 session={{ ...baseSession, status: 'CLOSED' }} />)
    expect(screen.getByPlaceholderText(/type your message/i)).toBeDisabled()
    expect(screen.queryByRole('button', { name: /close chat/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/unit/components/admin/support/chat/AdminChatPanelV2.test.tsx` — expect module not found.

- [ ] **Step 3: Write the component** — `components/admin/support/chat/AdminChatPanelV2.tsx`

```tsx
// components/admin/support/chat/AdminChatPanelV2.tsx
'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { PaperPlaneTilt, X } from '@phosphor-icons/react'
import { useSupportChatStream } from '@/components/admin/support/chat/useSupportChatStream'
import { sendChatMessage, closeChatSession } from '@/app/admin/support/actions'
import { toast } from '@/lib/toast'
import type { ChatSessionData, ChatMessageRow } from '@/lib/admin/support'

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

export interface AdminChatPanelV2Props {
  session: ChatSessionData
}

/** Merge seed + streamed messages, dedupe by id, sort ascending by createdAt. */
function mergeMessages(seed: ChatMessageRow[], streamed: ChatMessageRow[]): ChatMessageRow[] {
  const byId = new Map<string, ChatMessageRow>()
  for (const m of seed) byId.set(m.id, m)
  for (const m of streamed) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function AdminChatPanelV2({ session }: AdminChatPanelV2Props) {
  // Cursor = createdAt of the last seed message (or null) — stable across renders.
  const lastCursor = useMemo(() => {
    const last = session.messages[session.messages.length - 1]
    return last ? last.createdAt.toISOString() : null
  }, [session.messages])

  const { messages: streamed, connected } = useSupportChatStream(session.sessionId, lastCursor)
  const messages = useMemo(() => mergeMessages(session.messages, streamed), [session.messages, streamed])

  const [draft, setDraft] = useState('')
  const [sendPending, startSend] = useTransition()
  const [closePending, startClose] = useTransition()
  const isClosed = session.status === 'CLOSED'

  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sendPending || isClosed) return
    startSend(async () => {
      const result = await sendChatMessage(session.sessionId, body)
      if (result.ok) {
        setDraft('')
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleClose = () => {
    startClose(async () => {
      const result = await closeChatSession(session.sessionId)
      if (result.ok) {
        toast.success('Chat closed')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <section className="flex flex-col h-full bg-neutral-900/60 border border-white/8 rounded-md">
      {/* Header */}
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">{session.customerName}</span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-emerald-400' : 'bg-white/30'}`}
              aria-label={connected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <div className="text-xs text-white/40 truncate">{session.customerEmail}</div>
        </div>
        {!isClosed && (
          <button
            type="button"
            onClick={handleClose}
            disabled={closePending}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-white/8 px-2 py-1 text-xs text-white/70 hover:bg-white/[0.06] disabled:opacity-50"
          >
            <X size={12} weight="bold" />
            {closePending ? 'Closing…' : 'Close chat'}
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => {
          const isAdmin = m.senderType === 'admin'
          const isSystem = m.senderType === 'system'
          return (
            <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                  isSystem
                    ? 'w-full max-w-full text-center italic text-white/40'
                    : isAdmin
                      ? 'bg-[#FF3131] text-white'
                      : 'bg-white/[0.06] text-white/90'
                }`}
              >
                {!isSystem && (
                  <div className={`text-[10px] mb-0.5 ${isAdmin ? 'text-white/70' : 'text-white/40'}`}>
                    {m.senderName}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                {!isSystem && (
                  <div className={`text-[10px] mt-0.5 ${isAdmin ? 'text-white/70 text-right' : 'text-white/40'}`}>
                    {timeFmt.format(m.createdAt)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="border-t border-white/8 p-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message…"
          disabled={isClosed || sendPending}
          className="flex-1 rounded-md bg-neutral-950/60 border border-white/8 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 disabled:opacity-50"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={isClosed || sendPending || !draft.trim()}
          className="shrink-0 inline-flex items-center justify-center rounded-md bg-[#FF3131] px-3 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PaperPlaneTilt size={16} weight="bold" />
        </button>
      </form>
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
npx vitest run tests/unit/components/admin/support/chat/AdminChatPanelV2.test.tsx
npx tsc --noEmit
git add components/admin/support/chat/AdminChatPanelV2.tsx tests/unit/components/admin/support/chat/AdminChatPanelV2.test.tsx
git commit -m "feat(admin-v2): add AdminChatPanelV2 (SSE-driven live chat panel)"
git push -u origin wave9p9/task-20-chat-panel
gh pr create --title "feat(admin-v2): Phase 9 W6 AdminChatPanelV2" --body "Client chat panel: seeds session.messages, subscribes via useSupportChatStream(sessionId, lastCursor) and merges/dedupes streamed messages by id. Compose box -> sendChatMessage; Close chat -> closeChatSession; both toast. Compose disabled + Close hidden when CLOSED. Connection dot reflects hook.connected. 7 tests passing (hook + actions + toast mocked). NO MERGE — depends on W2 + Task 18 (statically imports useSupportChatStream)."
```

---

### Task 21: `AgentAvailabilityToggle.tsx` — online/offline + max-chats control

**Wave:** 6 (after Task 18 merged) | **Parallel-safe with:** Tasks 19, 20 | **Branch:** `wave9p9/task-21-availability-toggle` | **Model:** sonnet

**Schema / contract realities for this task:**
- Props (Shared Contracts, VERBATIM): `interface AgentAvailabilityToggleProps { availability: AgentAvailabilityData }`.
- `AgentAvailabilityData = { isOnline: boolean; maxChats: number; activeChats: number }`.
- `'use client'`. Use `import type { AgentAvailabilityData } from '@/lib/admin/support'`.
- Online/offline toggle + a maxChats stepper; both call the server action `setAgentAvailability({ isOnline, maxChats })` from `@/app/admin/support/actions`. Toggling online flips `isOnline`; the maxChats control sends the new value with the current `isOnline`. Optimistic local state with rollback on `{ ok: false }` + error toast; success toast on `{ ok: true }`.
- Shows `activeChats/maxChats` (e.g. "2 / 3 active").
- Toasts via `@/lib/toast`. No `dark:`; always-dark direct colors.

**Files:**
- Create: `components/admin/support/chat/AgentAvailabilityToggle.tsx`
- Test: `tests/unit/components/admin/support/chat/AgentAvailabilityToggle.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test** — `tests/unit/components/admin/support/chat/AgentAvailabilityToggle.test.tsx`

```tsx
// tests/unit/components/admin/support/chat/AgentAvailabilityToggle.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const setAgentAvailability = vi.fn()
vi.mock('@/app/admin/support/actions', () => ({
  setAgentAvailability: (...a: unknown[]) => setAgentAvailability(...a),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('@/lib/toast', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}))

import { AgentAvailabilityToggle } from '@/components/admin/support/chat/AgentAvailabilityToggle'
import type { AgentAvailabilityData } from '@/lib/admin/support'

const availability: AgentAvailabilityData = { isOnline: false, maxChats: 3, activeChats: 1 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AgentAvailabilityToggle', () => {
  it('shows activeChats / maxChats', () => {
    render(<AgentAvailabilityToggle availability={availability} />)
    expect(screen.getByText(/1 \/ 3 active/i)).toBeInTheDocument()
  })

  it('toggles online and persists via setAgentAvailability', async () => {
    setAgentAvailability.mockResolvedValue({ ok: true })
    render(<AgentAvailabilityToggle availability={availability} />)
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => {
      expect(setAgentAvailability).toHaveBeenCalledWith({ isOnline: true, maxChats: 3 })
      expect(toastSuccess).toHaveBeenCalled()
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    })
  })

  it('rolls back the toggle and toasts on failure', async () => {
    setAgentAvailability.mockResolvedValue({ ok: false, error: 'nope' })
    render(<AgentAvailabilityToggle availability={availability} />)
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('nope')
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('increments maxChats and persists with the current online state', async () => {
    setAgentAvailability.mockResolvedValue({ ok: true })
    render(<AgentAvailabilityToggle availability={availability} />)
    fireEvent.click(screen.getByRole('button', { name: /increase max chats/i }))
    await waitFor(() => {
      expect(setAgentAvailability).toHaveBeenCalledWith({ isOnline: false, maxChats: 4 })
      expect(screen.getByText(/1 \/ 4 active/i)).toBeInTheDocument()
    })
  })

  it('does not decrement maxChats below 1', () => {
    render(<AgentAvailabilityToggle availability={{ ...availability, maxChats: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: /decrease max chats/i }))
    expect(setAgentAvailability).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/unit/components/admin/support/chat/AgentAvailabilityToggle.test.tsx` — expect module not found.

- [ ] **Step 3: Write the component** — `components/admin/support/chat/AgentAvailabilityToggle.tsx`

```tsx
// components/admin/support/chat/AgentAvailabilityToggle.tsx
'use client'

import { useState, useTransition } from 'react'
import { Minus, Plus } from '@phosphor-icons/react'
import { setAgentAvailability } from '@/app/admin/support/actions'
import { toast } from '@/lib/toast'
import type { AgentAvailabilityData } from '@/lib/admin/support'

export interface AgentAvailabilityToggleProps {
  availability: AgentAvailabilityData
}

export function AgentAvailabilityToggle({ availability }: AgentAvailabilityToggleProps) {
  const [isOnline, setIsOnline] = useState(availability.isOnline)
  const [maxChats, setMaxChats] = useState(availability.maxChats)
  const [pending, startTransition] = useTransition()

  const persist = (next: { isOnline: boolean; maxChats: number }, rollback: () => void) => {
    startTransition(async () => {
      const result = await setAgentAvailability(next)
      if (result.ok) {
        toast.success(next.isOnline ? 'You are online' : 'You are offline')
      } else {
        rollback()
        toast.error(result.error)
      }
    })
  }

  const handleToggle = () => {
    const next = !isOnline
    setIsOnline(next)
    persist({ isOnline: next, maxChats }, () => setIsOnline(!next))
  }

  const handleStep = (delta: number) => {
    const next = maxChats + delta
    if (next < 1) return
    const prev = maxChats
    setMaxChats(next)
    persist({ isOnline, maxChats: next }, () => setMaxChats(prev))
  }

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Availability</div>
          <div className="text-xs text-white/40">
            {availability.activeChats} / {maxChats} active
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOnline}
          aria-label="Toggle online"
          onClick={handleToggle}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
            isOnline ? 'bg-emerald-500' : 'bg-white/15'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isOnline ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-white/50">Max concurrent chats</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Decrease max chats"
            onClick={() => handleStep(-1)}
            disabled={pending || maxChats <= 1}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/8 text-white/70 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minus size={12} weight="bold" />
          </button>
          <span className="w-5 text-center text-sm text-white">{maxChats}</span>
          <button
            type="button"
            aria-label="Increase max chats"
            onClick={() => handleStep(1)}
            disabled={pending}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/8 text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
          >
            <Plus size={12} weight="bold" />
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
npx vitest run tests/unit/components/admin/support/chat/AgentAvailabilityToggle.test.tsx
npx tsc --noEmit
git add components/admin/support/chat/AgentAvailabilityToggle.tsx tests/unit/components/admin/support/chat/AgentAvailabilityToggle.test.tsx
git commit -m "feat(admin-v2): add AgentAvailabilityToggle (online/offline + maxChats)"
git push -u origin wave9p9/task-21-availability-toggle
gh pr create --title "feat(admin-v2): Phase 9 W6 AgentAvailabilityToggle" --body "Client toggle: online/offline switch + maxChats stepper, both persisting via setAgentAvailability({ isOnline, maxChats }) with optimistic state + rollback + toast. Shows activeChats / maxChats. maxChats floored at 1. 5 tests passing. NO MERGE — depends on W2."
```

---
## Wave 7 — Composition + dispatchers (sequential, **opus**, after W3–W6 merged)

> All of Wave 7 runs **sequentially on the opus model** after Tasks 4–21 are merged to the integration branch. Every task in this wave consumes the REAL merged prop shapes from the Shared Contracts section of the plan (`docs/superpowers/plans/2026-06-19-admin-rebuild-phase9-support.md`). If a merged file disagrees with prose, the merged file wins — re-read the merged component before wiring it.
>
> **Worktree note:** worktrees have no `node_modules`. Symlink it before running anything: `ln -s <repo-root>/node_modules node_modules`. This repo uses **npm, never pnpm** — `npx tsc --noEmit`, `npx vitest run <path>`, `npx eslint`.
>
> **Dispatcher test note (Phase 8 lesson — do NOT repeat the bug):** the Phase 8 plan's dispatcher tests asserted `expect(String(node)).toContain('V1')`. That assertion is **broken** — `String(node)` on a React element renders `[object Object]`, so it passes vacuously and tests nothing. **Every dispatcher test in this wave uses the working pattern** from `tests/unit/app/admin/loyalty/page.test.tsx`: mock V1/V2 to render `<div data-testid="…">`, `render(await Page(...))`, then `expect(screen.getByTestId('…')).toBeInTheDocument()` (+ a `vi.fn` spy with `toHaveBeenCalledWith` to verify forwarded props).

---

### Task 22: `SupportTicketsListClient.tsx` (selection-state client glue)

**Wave:** 7 | **Branch:** `wave9p9/task-22-tickets-list-client` | **Model:** opus

**Schema realities for this task:**
- Mirrors `components/admin/customers/CustomersListClient.tsx` exactly. A `'use client'` component that owns the `Set<string> selectedIds` state and glues the three merged W3 components: `SupportTicketsListTable` (desktop), `SupportTicketsListCardMobile` (mobile cards), `SupportBulkSheet`.
- Adopt the REAL merged props from the Shared Contracts:
  - `SupportTicketsListTableProps { rows: TicketRow[]; selectedIds: Set<string>; onToggleSelection: (id: string) => void; onToggleAll: () => void; allSelected: boolean }`
  - `SupportTicketsListCardMobileProps { row: TicketRow; selectedIds: Set<string>; onToggleSelection: (id: string) => void }` — note: the mobile card does NOT take `isSuperAdmin` (unlike Phase 8 customers, which had a SUPER_ADMIN swipe-gift). Do not pass it.
  - `SupportBulkSheetProps { selectedIds: string[]; agents: AgentRow[]; isSuperAdmin: boolean; onClear: () => void }` — the bulk sheet needs `agents` (for the assign dropdown) and `isSuperAdmin` (for the SUPER_ADMIN-gated bulk-close).
- `SupportTicketsListClientProps { rows: TicketRow[]; agents: AgentRow[]; isSuperAdmin: boolean }`.
- `import type` only for `TicketRow` / `AgentRow` — no Prisma value-imports in client files.

**Files:**
- Create: `components/admin/support/SupportTicketsListClient.tsx`
- Tests:
  - `tests/unit/components/admin/support/SupportTicketsListClient.test.tsx`

#### Steps

- [ ] **Step 1: Write `components/admin/support/SupportTicketsListClient.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import type { TicketRow, AgentRow } from '@/lib/admin/support'
import { SupportTicketsListTable } from './SupportTicketsListTable'
import { SupportTicketsListCardMobile } from './SupportTicketsListCardMobile'
import { SupportBulkSheet } from './SupportBulkSheet'

export interface SupportTicketsListClientProps {
  rows: TicketRow[]
  agents: AgentRow[]
  isSuperAdmin: boolean
}

export function SupportTicketsListClient({
  rows,
  agents,
  isSuperAdmin,
}: SupportTicketsListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allIds = useMemo(() => rows.map((r) => r.id), [rows])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  const onToggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onToggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    )
  }

  const onClear = () => setSelectedIds(new Set())

  return (
    <div className="space-y-3">
      <SupportTicketsListTable
        rows={rows}
        selectedIds={selectedIds}
        onToggleSelection={onToggleSelection}
        onToggleAll={onToggleAll}
        allSelected={allSelected}
      />
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <SupportTicketsListCardMobile
            key={r.id}
            row={r}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
          />
        ))}
      </div>
      <SupportBulkSheet
        selectedIds={Array.from(selectedIds)}
        agents={agents}
        isSuperAdmin={isSuperAdmin}
        onClear={onClear}
      />
    </div>
  )
}
```

- [ ] **Step 2: Write the test**

```tsx
// tests/unit/components/admin/support/SupportTicketsListClient.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { TicketRow, AgentRow } from '@/lib/admin/support'

let lastTableProps: { allSelected: boolean; onToggleAll: () => void } | null = null
let lastSheetProps: { selectedIds: string[] } | null = null

vi.mock('@/components/admin/support/SupportTicketsListTable', () => ({
  SupportTicketsListTable: (props: {
    allSelected: boolean
    onToggleAll: () => void
  }) => {
    lastTableProps = props
    return (
      <button data-testid="table-toggle-all" onClick={() => props.onToggleAll()}>
        all={String(props.allSelected)}
      </button>
    )
  },
}))
vi.mock('@/components/admin/support/SupportTicketsListCardMobile', () => ({
  SupportTicketsListCardMobile: (props: { row: TicketRow }) => (
    <div data-testid={`card-${props.row.id}`} />
  ),
}))
vi.mock('@/components/admin/support/SupportBulkSheet', () => ({
  SupportBulkSheet: (props: { selectedIds: string[] }) => {
    lastSheetProps = props
    return <div data-testid="bulk-sheet">count={props.selectedIds.length}</div>
  },
}))

beforeEach(() => {
  lastTableProps = null
  lastSheetProps = null
  vi.clearAllMocks()
})

import { SupportTicketsListClient } from '@/components/admin/support/SupportTicketsListClient'

const ROWS: TicketRow[] = [
  {
    id: 't1', ticketNumber: 'TKT-2026-000001', subject: 'Where is my order',
    type: 'ORDER_ISSUE', status: 'OPEN', priority: 'HIGH',
    customerName: 'Ada', customerEmail: 'ada@e.com',
    assigneeId: null, assigneeName: null,
    createdAt: new Date(), firstRespondedAt: null, ageHours: 5, isOverdue: true,
  },
  {
    id: 't2', ticketNumber: 'TKT-2026-000002', subject: 'Refund please',
    type: 'REFUND', status: 'IN_PROGRESS', priority: 'URGENT',
    customerName: 'Bo', customerEmail: 'bo@e.com',
    assigneeId: 'a1', assigneeName: 'Agent 1',
    createdAt: new Date(), firstRespondedAt: new Date(), ageHours: 2, isOverdue: false,
  },
]
const AGENTS: AgentRow[] = [{ id: 'a1', name: 'Agent 1', openTicketCount: 3 }]

describe('SupportTicketsListClient', () => {
  it('renders table, a mobile card per row, and the bulk sheet', () => {
    render(<SupportTicketsListClient rows={ROWS} agents={AGENTS} isSuperAdmin={false} />)
    expect(screen.getByTestId('table-toggle-all')).toBeInTheDocument()
    expect(screen.getByTestId('card-t1')).toBeInTheDocument()
    expect(screen.getByTestId('card-t2')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-sheet')).toHaveTextContent('count=0')
  })

  it('toggle-all selects every row, then clears on second toggle', () => {
    render(<SupportTicketsListClient rows={ROWS} agents={AGENTS} isSuperAdmin />)
    fireEvent.click(screen.getByTestId('table-toggle-all'))
    expect(lastSheetProps?.selectedIds).toEqual(['t1', 't2'])
    expect(lastTableProps?.allSelected).toBe(true)
    fireEvent.click(screen.getByTestId('table-toggle-all'))
    expect(lastSheetProps?.selectedIds).toEqual([])
    expect(lastTableProps?.allSelected).toBe(false)
  })
})
```

- [ ] **Step 3: Run the test + typecheck**

```bash
npx vitest run tests/unit/components/admin/support/SupportTicketsListClient.test.tsx
npx tsc --noEmit
```
Expected: PASS (2 tests).

- [ ] **Step 4: Commit + push + PR (no merge)**

```bash
git add \
  components/admin/support/SupportTicketsListClient.tsx \
  tests/unit/components/admin/support/SupportTicketsListClient.test.tsx
git commit -m "feat(admin-v2): add SupportTicketsListClient (selection-state glue)"
git push -u origin wave9p9/task-22-tickets-list-client
gh pr create --title "feat(admin-v2): SupportTicketsListClient — Phase 9 W7 Task 22" --body "Client glue owning Set<string> selection; wires SupportTicketsListTable + SupportTicketsListCardMobile + SupportBulkSheet (adopts merged W3 props). 2 tests passing."
```

---

### Task 23: `detail/TicketReplyComposer.tsx` (reply/internal-note composer embedding the canned picker)

**Wave:** 7 | **Branch:** `wave9p9/task-23-reply-composer` | **Model:** opus

**Schema realities for this task:**
- **Why this is in W7, not W4:** the composer statically imports the W5 `CannedResponsePicker`. Vite's static import-analysis resolves a `'use client'` component's imports BEFORE `vi.mock` can intercept (Phase 8 inspector-before-panel lesson). The picker must exist on disk (merged in W5) before this composer can have a passing test. That is why the composer lives in the composition wave.
- Adopt the merged contracts:
  - `TicketReplyComposerProps { ticketId: string; cannedResponses: CannedResponseRow[] }`
  - `CannedResponsePickerProps { responses: CannedResponseRow[]; onPick: (body: string) => void }` — the picker calls `onPick(body)` with the selected canned-response body; the composer inserts it into the textarea (appends to current content if non-empty).
- `'use client'`. A reply-vs-internal-note toggle (`isInternal` checkbox). Submit routes through the merged server actions: `replyToTicket(ticketId, body, { isInternal: false })` for a public reply, `addInternalNote(ticketId, body)` for an internal note. Both return `ActionResult`. Show a Sonner toast on success/failure via `lib/toast.ts`.
- Value-importing `@/app/admin/support/actions` is fine (server functions). `import type` for `CannedResponseRow`.
- After a successful submit, clear the textarea and reset `isInternal` to false. The server actions `revalidatePath` the ticket route, so the thread re-renders server-side — the composer does not need to optimistically append.

**Files:**
- Create: `components/admin/support/detail/TicketReplyComposer.tsx`
- Tests:
  - `tests/unit/components/admin/support/detail/TicketReplyComposer.test.tsx`

#### Steps

- [ ] **Step 1: Write `components/admin/support/detail/TicketReplyComposer.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import type { CannedResponseRow } from '@/lib/admin/support'
import { replyToTicket, addInternalNote } from '@/app/admin/support/actions'
import { CannedResponsePicker } from '@/components/admin/support/inspectors/CannedResponsePicker'
import { toast } from '@/lib/toast'

export interface TicketReplyComposerProps {
  ticketId: string
  cannedResponses: CannedResponseRow[]
}

export function TicketReplyComposer({ ticketId, cannedResponses }: TicketReplyComposerProps) {
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const onPick = (cannedBody: string) => {
    setBody((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${cannedBody}` : cannedBody))
  }

  const onSubmit = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = isInternal
        ? await addInternalNote(ticketId, trimmed)
        : await replyToTicket(ticketId, trimmed, { isInternal: false })
      if (result.ok) {
        setBody('')
        setIsInternal(false)
        toast.success(
          isInternal ? 'Internal note added' : 'Reply sent',
          isInternal ? 'Not visible to customer' : 'Customer notified',
        )
      } else {
        toast.error(isInternal ? 'Could not add note' : 'Could not send reply', result.error)
      }
    })
  }

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {isInternal ? 'Internal note' : 'Reply to customer'}
        </h2>
        <CannedResponsePicker responses={cannedResponses} onPick={onPick} />
      </div>
      <div className="p-3 space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isInternal ? 'Add an internal note…' : 'Type your reply…'}
          rows={4}
          aria-label="Message body"
          className="w-full px-3 py-2 rounded-md border border-white/8 bg-white/[0.03] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-white/50">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.03]"
            />
            Internal note (not visible to customer)
          </label>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !body.trim()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#FF3131] text-white text-sm font-semibold hover:bg-[#ff4a4a] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperPlaneTilt size={14} weight="bold" />
            {isPending ? 'Sending…' : isInternal ? 'Add note' : 'Send'}
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Write the test**

```tsx
// tests/unit/components/admin/support/detail/TicketReplyComposer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CannedResponseRow } from '@/lib/admin/support'

const replyToTicket = vi.fn<(...a: unknown[]) => Promise<{ ok: boolean; error?: string }>>()
const addInternalNote = vi.fn<(...a: unknown[]) => Promise<{ ok: boolean; error?: string }>>()
vi.mock('@/app/admin/support/actions', () => ({
  replyToTicket: (...a: unknown[]) => replyToTicket(...a),
  addInternalNote: (...a: unknown[]) => addInternalNote(...a),
}))

// The picker is merged in W5; mock it so onPick is driveable from the test.
vi.mock('@/components/admin/support/inspectors/CannedResponsePicker', () => ({
  CannedResponsePicker: (props: { onPick: (body: string) => void }) => (
    <button data-testid="pick-canned" onClick={() => props.onPick('Canned hello')}>
      pick
    </button>
  ),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('@/lib/toast', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}))

beforeEach(() => vi.clearAllMocks())

import { TicketReplyComposer } from '@/components/admin/support/detail/TicketReplyComposer'

const CANNED: CannedResponseRow[] = [
  {
    id: 'cr1', title: 'Greeting', body: 'Hi there', category: null,
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  },
]

describe('TicketReplyComposer', () => {
  it('inserts a canned response body into the textarea via onPick', () => {
    render(<TicketReplyComposer ticketId="t1" cannedResponses={CANNED} />)
    const textarea = screen.getByLabelText('Message body') as HTMLTextAreaElement
    fireEvent.click(screen.getByTestId('pick-canned'))
    expect(textarea.value).toBe('Canned hello')
  })

  it('sends a public reply via replyToTicket and clears on success', async () => {
    replyToTicket.mockResolvedValue({ ok: true })
    render(<TicketReplyComposer ticketId="t1" cannedResponses={CANNED} />)
    const textarea = screen.getByLabelText('Message body') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Resolved for you' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() =>
      expect(replyToTicket).toHaveBeenCalledWith('t1', 'Resolved for you', { isInternal: false }),
    )
    await waitFor(() => expect(textarea.value).toBe(''))
    expect(toastSuccess).toHaveBeenCalled()
    expect(addInternalNote).not.toHaveBeenCalled()
  })

  it('routes to addInternalNote when the internal toggle is checked', async () => {
    addInternalNote.mockResolvedValue({ ok: true })
    render(<TicketReplyComposer ticketId="t1" cannedResponses={CANNED} />)
    fireEvent.change(screen.getByLabelText('Message body'), { target: { value: 'note to self' } })
    fireEvent.click(screen.getByLabelText(/internal note/i))
    fireEvent.click(screen.getByRole('button', { name: /add note/i }))
    await waitFor(() => expect(addInternalNote).toHaveBeenCalledWith('t1', 'note to self'))
    expect(replyToTicket).not.toHaveBeenCalled()
  })

  it('surfaces an error toast when the action fails', async () => {
    replyToTicket.mockResolvedValue({ ok: false, error: 'boom' })
    render(<TicketReplyComposer ticketId="t1" cannedResponses={CANNED} />)
    fireEvent.change(screen.getByLabelText('Message body'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not send reply', 'boom'))
  })
})
```

- [ ] **Step 3: Run the test + typecheck**

```bash
npx vitest run tests/unit/components/admin/support/detail/TicketReplyComposer.test.tsx
npx tsc --noEmit
```
Expected: PASS (4 tests).

- [ ] **Step 4: Commit + push + PR (no merge)**

```bash
git add \
  components/admin/support/detail/TicketReplyComposer.tsx \
  tests/unit/components/admin/support/detail/TicketReplyComposer.test.tsx
git commit -m "feat(admin-v2): add TicketReplyComposer (reply/internal-note + canned picker)"
git push -u origin wave9p9/task-23-reply-composer
gh pr create --title "feat(admin-v2): TicketReplyComposer — Phase 9 W7 Task 23" --body "Reply vs internal-note toggle; embeds merged W5 CannedResponsePicker (onPick inserts body); submits via replyToTicket / addInternalNote; toast feedback. Placed in W7 (not W4) because it statically imports the W5 picker. 4 tests passing."
```

---

### Task 24: `AdminSupportTicketsV2.tsx` (server root) + `SupportTabPills.tsx` + `SupportRangePills.tsx`

**Wave:** 7 | **Branch:** `wave9p9/task-24-tickets-v2-root` | **Model:** opus

**Schema realities for this task:**
- `AdminSupportTicketsV2.tsx` is a **server** component. Mirrors `AdminCustomersV2.tsx`. Props (Shared Contracts): `AdminSupportTicketsV2Props { searchParams: { tab?: string; range?: string; q?: string; page?: string }; currentAdminId: string | null; isSuperAdmin: boolean }`.
- Parse `tab` via `isSupportTab` (default `'inbox'`) and `range` via `isTimeRange` (default `'30d'`). Build `SupportFilters` from `q` (`search`) and `page`.
- Renders: `SupportTabPills` + `SupportRangePills` (client URL-sync wrappers, mirroring the Phase 8 pills), a KPI strip Suspense slot (`loadSupportKpis(range, currentAdminId)`), and a list Suspense slot (`loadSupportTab(tab, range, filters, currentAdminId)` → `loadAgentList()` → `SupportTicketsListClient`).
- The list slot must also load `loadAgentList()` (for the bulk sheet's assign dropdown) and pass `agents` + `isSuperAdmin` into `SupportTicketsListClient`.
- Tabs config: `inbox` (Inbox) / `mine` (Mine) / `open` (Open) / `escalated` (Escalated) / `resolved` (Resolved).
- KPI cards deep-link to matching tabs: Open→open, Unassigned→inbox, Escalated→escalated (link only if there's a natural tab; otherwise no link), Resolved→resolved.
- `SupportTabPills` / `SupportRangePills` are byte-for-byte analogues of the Phase 8 `CustomersTabPills` / `CustomersRangePills`, retargeted to `lib/admin/support` types and the `inbox` default tab. They preserve the sibling query param on change.

**Files:**
- Create: `components/admin/dashboard/AdminSupportTicketsV2.tsx`
- Create: `components/admin/dashboard/SupportTabPills.tsx`
- Create: `components/admin/dashboard/SupportRangePills.tsx`
- Tests:
  - `tests/unit/components/admin/dashboard/AdminSupportTicketsV2.test.tsx`

#### Steps

- [ ] **Step 1: Write `components/admin/dashboard/SupportTabPills.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { SupportTab } from '@/lib/admin/support'

export interface SupportTabPillsProps {
  tabs: ReadonlyArray<{ id: SupportTab; label: string }>
  active: SupportTab
}

export function SupportTabPills({ tabs, active }: SupportTabPillsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const range = searchParams?.get('range') ?? '30d'

  const pillTabs: TabPillsTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))

  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${id}&range=${range}`)}
    />
  )
}
```

- [ ] **Step 2: Write `components/admin/dashboard/SupportRangePills.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { TIME_RANGES, type TimeRange } from '@/lib/admin/support'

const LABEL: Record<TimeRange, string> = {
  today: 'Today', '7d': '7 days', '30d': '30 days', '90d': '90 days', year: 'Year',
}

export interface SupportRangePillsProps {
  active: TimeRange
}

export function SupportRangePills({ active }: SupportRangePillsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams?.get('tab') ?? 'inbox'
  const [isPending, startTransition] = useTransition()

  const onPick = (range: TimeRange) => {
    if (range === active) return
    startTransition(() => router.push(`?tab=${tab}&range=${range}`))
  }

  return (
    <div className="flex gap-1" data-pending={isPending}>
      {TIME_RANGES.map((r) => {
        const isActive = r === active
        return (
          <button
            key={r}
            type="button"
            onClick={() => onPick(r)}
            aria-pressed={isActive}
            className={`text-[10px] px-2 py-1 rounded-[4px] font-semibold transition-colors ${
              isActive
                ? 'bg-white/6 text-white shadow-[inset_0_0_0_1px_rgba(255,49,49,0.2)]'
                : 'bg-white/2 text-white/40 hover:text-white/70 hover:bg-white/4'
            }`}
          >
            {LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Write `components/admin/dashboard/AdminSupportTicketsV2.tsx`**

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadSupportKpis,
  loadSupportTab,
  loadAgentList,
  isSupportTab,
  isTimeRange,
  type SupportTab,
  type SupportFilters,
  type TimeRange,
} from '@/lib/admin/support'
import { SupportTicketsListClient } from '@/components/admin/support/SupportTicketsListClient'
import { SupportTabPills } from './SupportTabPills'
import { SupportRangePills } from './SupportRangePills'

export interface AdminSupportTicketsV2Props {
  searchParams: { tab?: string; range?: string; q?: string; page?: string }
  currentAdminId: string | null
  isSuperAdmin: boolean
}

const TAB_CONFIG: ReadonlyArray<{ id: SupportTab; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'mine', label: 'Mine' },
  { id: 'open', label: 'Open' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'resolved', label: 'Resolved' },
]

const nFmt = new Intl.NumberFormat('en-US')

function parseTab(raw: string | undefined): SupportTab {
  return isSupportTab(raw) ? raw : 'inbox'
}
function parseRange(raw: string | undefined): TimeRange {
  return isTimeRange(raw) ? raw : '30d'
}
function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}
function fmtHours(h: number): string {
  return h >= 24 ? `${(h / 24).toFixed(1)}d` : `${h.toFixed(1)}h`
}

async function KpiStripSlot({
  range, currentAdminId,
}: { range: TimeRange; currentAdminId: string | null }) {
  const k = await loadSupportKpis(range, currentAdminId)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href={`?tab=open&range=${range}`} className="block">
        <StatCard label="Open" value={nFmt.format(k.openCount)} />
      </Link>
      <Link href={`?tab=inbox&range=${range}`} className="block">
        <StatCard
          label="Unassigned"
          value={nFmt.format(k.unassignedCount)}
          {...(k.unassignedCount > 0
            ? { trend: { direction: 'down' as const, text: 'needs triage' } }
            : {})}
        />
      </Link>
      <StatCard
        label="Avg first response"
        value={fmtHours(k.avgFirstResponseHours)}
        trend={k.avgFirstResponseTrend}
      />
      <Link href={`?tab=resolved&range=${range}`} className="block">
        <StatCard
          label="Resolved (range)"
          value={nFmt.format(k.resolvedInRange)}
          trend={k.resolvedInRangeTrend}
        />
      </Link>
    </div>
  )
}

async function ListSlot({
  tab, range, filters, currentAdminId, isSuperAdmin,
}: {
  tab: SupportTab
  range: TimeRange
  filters: SupportFilters
  currentAdminId: string | null
  isSuperAdmin: boolean
}) {
  const [data, agents] = await Promise.all([
    loadSupportTab(tab, range, filters, currentAdminId),
    loadAgentList(),
  ])
  return (
    <SupportTicketsListClient rows={data.items} agents={agents} isSuperAdmin={isSuperAdmin} />
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}

export async function AdminSupportTicketsV2({
  searchParams, currentAdminId, isSuperAdmin,
}: AdminSupportTicketsV2Props) {
  const tab = parseTab(searchParams.tab)
  const range = parseRange(searchParams.range)
  const filters: SupportFilters = {
    page: parsePage(searchParams.page),
    ...(searchParams.q ? { search: searchParams.q } : {}),
  }

  return (
    <AdminLayout title="Support tickets" subtitle="Inbox · SLA · assignment · returns · refunds">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SupportTabPills tabs={TAB_CONFIG} active={tab} />
          <SupportRangePills active={range} />
        </div>
        <Suspense fallback={<KpiSkeleton />}>
          <KpiStripSlot range={range} currentAdminId={currentAdminId} />
        </Suspense>
        <Suspense fallback={<ListSkeleton />}>
          <ListSlot
            tab={tab}
            range={range}
            filters={filters}
            currentAdminId={currentAdminId}
            isSuperAdmin={isSuperAdmin}
          />
        </Suspense>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 4: Write the smoke test**

```tsx
// tests/unit/components/admin/dashboard/AdminSupportTicketsV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/support', () => ({
  loadSupportKpis: vi.fn().mockResolvedValue({
    openCount: 5, unassignedCount: 2,
    avgFirstResponseHours: 3.2,
    avgFirstResponseTrend: { direction: 'flat', text: '— 0%' },
    avgResolutionHours: 18, resolvedInRange: 12,
    resolvedInRangeTrend: { direction: 'up', text: '+3' },
  }),
  loadSupportTab: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  loadAgentList: vi.fn().mockResolvedValue([{ id: 'a1', name: 'Agent 1', openTicketCount: 3 }]),
  isSupportTab: (v: unknown) =>
    typeof v === 'string' && ['inbox', 'mine', 'open', 'escalated', 'resolved'].includes(v),
  isTimeRange: (v: unknown) =>
    typeof v === 'string' && ['today', '7d', '30d', '90d', 'year'].includes(v),
}))

vi.mock('@/components/admin/dashboard/SupportTabPills', () => ({
  SupportTabPills: () => <div data-testid="tab-pills" />,
}))
vi.mock('@/components/admin/dashboard/SupportRangePills', () => ({
  SupportRangePills: () => <div data-testid="range-pills" />,
}))
vi.mock('@/components/admin/support/SupportTicketsListClient', () => ({
  SupportTicketsListClient: () => <div data-testid="list-client" />,
}))

beforeEach(() => vi.clearAllMocks())

import { AdminSupportTicketsV2 } from '@/components/admin/dashboard/AdminSupportTicketsV2'

describe('AdminSupportTicketsV2', () => {
  it('renders tab + range pills on the default inbox tab', async () => {
    const node = await AdminSupportTicketsV2({
      searchParams: {}, currentAdminId: 'admin-1', isSuperAdmin: false,
    })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeInTheDocument()
    expect(screen.getByTestId('range-pills')).toBeInTheDocument()
  })

  it('renders the KPI strip and list client for the mine tab', async () => {
    const node = await AdminSupportTicketsV2({
      searchParams: { tab: 'mine', range: '7d', q: 'ada', page: '2' },
      currentAdminId: 'admin-1', isSuperAdmin: true,
    })
    render(node as React.ReactElement)
    expect(await screen.findByText('Avg first response')).toBeInTheDocument()
    expect(await screen.findByTestId('list-client')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run the test + typecheck**

```bash
npx vitest run tests/unit/components/admin/dashboard/AdminSupportTicketsV2.test.tsx
npx tsc --noEmit
```
Expected: PASS (2 tests).

- [ ] **Step 6: Commit + push + PR (no merge)**

```bash
git add \
  components/admin/dashboard/AdminSupportTicketsV2.tsx \
  components/admin/dashboard/SupportTabPills.tsx \
  components/admin/dashboard/SupportRangePills.tsx \
  tests/unit/components/admin/dashboard/AdminSupportTicketsV2.test.tsx
git commit -m "feat(admin-v2): add AdminSupportTicketsV2 root + Support tab/range pills"
git push -u origin wave9p9/task-24-tickets-v2-root
gh pr create --title "feat(admin-v2): AdminSupportTicketsV2 root — Phase 9 W7 Task 24" --body "Server root: parses tab/range/q/page; SupportTabPills + SupportRangePills (URL-sync); KPI strip Suspense (loadSupportKpis); list Suspense (loadSupportTab + loadAgentList → SupportTicketsListClient). 2 tests passing."
```

---

### Task 25: `AdminTicketDetailV2.tsx` (server root) + `TicketDetailInteractive.tsx` (client inspector-state wrapper)

**Wave:** 7 | **Branch:** `wave9p9/task-25-detail-v2-root` | **Model:** opus

**Schema realities for this task:**
- `AdminTicketDetailV2.tsx` is a **server** component. Props (Shared Contracts): `AdminTicketDetailV2Props { ticketId: string; isSuperAdmin: boolean }`. Mirrors `AdminCustomerDetailV2.tsx`.
- It calls `loadTicketHeader(ticketId)` synchronously; if `null`, calls `notFound()`.
- **State problem:** the inspectors (`AssignAgentInspector`, `StatusChangeInspector`, `ReturnDecisionInspector`, `RefundInspector`) are opened from the header/panel and need `open`/`onClose` state. A server component cannot hold `useState`. Solution (mirrors the Phase 8 inspector-state pattern): a small `'use client'` wrapper, **`TicketDetailInteractive.tsx`**, owns the inspector open-state and renders the `TicketHeader` + the return/refund panel + the inspectors, fed all server-loaded data as props. The thread / composer / activity / customer-context widgets stream independently as their own Suspense slots from the server root (they don't need inspector state).
- The server root composes a 2-column grid:
  - **Left:** `TicketMessageThread` (Suspense, `loadTicketMessages`) + `TicketReplyComposer` (Suspense, `loadCannedResponses`) + `TicketActivityTimeline` (server widget, loads internally).
  - **Right:** `TicketCustomerContext` (Suspense, `loadTicketCustomerContext`) + `TicketReturnRefundPanel` (server wrapper, loads internally).
  - **Top (full width):** `TicketDetailInteractive` — wraps `TicketHeader` + the inspectors. It receives `header`, `agents` (`loadAgentList`), `returnRefund` (`loadTicketReturnRefund`), and `isSuperAdmin`.
- Adopt the REAL merged widget/inspector props (Shared Contracts):
  - `TicketHeaderProps { header: TicketHeaderData; agents: AgentRow[]; isSuperAdmin: boolean }`
  - `TicketMessageThreadProps { messages: TicketMessageRow[] }`
  - `TicketCustomerContextProps { context: TicketCustomerContextData }`
  - `TicketReturnRefundPanelProps { ticketId: string }` (server wrapper; loads internally)
  - `TicketActivityTimelineProps { ticketId: string }` (server wrapper; loads internally)
  - `TicketReplyComposerProps { ticketId: string; cannedResponses: CannedResponseRow[] }`
  - `AssignAgentInspectorProps { open; ticketId; agents; currentAssigneeId; onClose }`
  - `StatusChangeInspectorProps { open; ticketId; currentStatus; onClose }`
  - `ReturnDecisionInspectorProps { open; ticketId; data; onClose }`
  - `RefundInspectorProps { open; ticketId; data; isSuperAdmin; onClose }`
- **`TicketDetailInteractive` owns ALL FOUR inspectors' open-state** (RECONCILED — the merged W4 widgets are inspector-FREE and callback-based, per the Phase 8 static-import lesson). The merged `TicketHeader` (W4, Task 7) does NOT self-own inspectors — it exposes optional callbacks `onAssign?`/`onStatus?`/`onEscalate?`/`onResolve?`, and the merged `TicketReturnRefundPanelClient` (W4, Task 10) exposes `onDecideReturn?`/`onIssueRefund?`. Therefore `TicketDetailInteractive` MUST own four `useState` flags and render all four inspectors — `AssignAgentInspector`, `StatusChangeInspector`, `ReturnDecisionInspector`, `RefundInspector` — wiring the header's callbacks to them: `onAssign` → open Assign; `onStatus`/`onEscalate`/`onResolve` → open Status (the `StatusChangeInspector` covers all status transitions incl. ESCALATED + RESOLVED-with-resolution). The right-column `TicketReturnRefundPanel` stays **read-only** (its callbacks are left unwired — the return/refund actions live in `TicketDetailInteractive` at the top so the inspector state has a single owner). The thread/composer/activity/customer-context slots stream independently from the server root and need no inspector state.

- [ ] **Step 1: Write `components/admin/support/detail/TicketDetailInteractive.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type {
  TicketHeaderData,
  AgentRow,
  TicketReturnRefundData,
} from '@/lib/admin/support'
import { TicketHeader } from './TicketHeader'
import { AssignAgentInspector } from '@/components/admin/support/inspectors/AssignAgentInspector'
import { StatusChangeInspector } from '@/components/admin/support/inspectors/StatusChangeInspector'
import { ReturnDecisionInspector } from '@/components/admin/support/inspectors/ReturnDecisionInspector'
import { RefundInspector } from '@/components/admin/support/inspectors/RefundInspector'

export interface TicketDetailInteractiveProps {
  header: TicketHeaderData
  agents: AgentRow[]
  returnRefund: TicketReturnRefundData | null
  isSuperAdmin: boolean
}

export function TicketDetailInteractive({
  header,
  agents,
  returnRefund,
  isSuperAdmin,
}: TicketDetailInteractiveProps) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  return (
    <div className="space-y-3">
      {/* Header is inspector-free (W4); we wire its callbacks to inspector state here. */}
      <TicketHeader
        header={header}
        agents={agents}
        isSuperAdmin={isSuperAdmin}
        onAssign={() => setAssignOpen(true)}
        onStatus={() => setStatusOpen(true)}
        onEscalate={() => setStatusOpen(true)}
        onResolve={() => setStatusOpen(true)}
      />

      {returnRefund && (returnRefund.returnRequested || isSuperAdmin) ? (
        <div className="flex flex-wrap gap-2">
          {returnRefund.returnRequested ? (
            <button
              type="button"
              onClick={() => setReturnOpen(true)}
              className="h-8 px-3 rounded-md border border-white/8 bg-white/[0.03] text-sm text-white/70 hover:text-white hover:bg-white/[0.06]"
            >
              Review return
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setRefundOpen(true)}
            disabled={!isSuperAdmin}
            title={isSuperAdmin ? undefined : 'SUPER_ADMIN only'}
            className="h-8 px-3 rounded-md border border-white/8 bg-white/[0.03] text-sm text-white/70 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Issue refund
          </button>
        </div>
      ) : null}

      <AssignAgentInspector
        open={assignOpen}
        ticketId={header.id}
        agents={agents}
        currentAssigneeId={header.assigneeId}
        onClose={() => setAssignOpen(false)}
      />
      <StatusChangeInspector
        open={statusOpen}
        ticketId={header.id}
        currentStatus={header.status}
        onClose={() => setStatusOpen(false)}
      />
      {returnRefund ? (
        <>
          <ReturnDecisionInspector
            open={returnOpen}
            ticketId={header.id}
            data={returnRefund}
            onClose={() => setReturnOpen(false)}
          />
          <RefundInspector
            open={refundOpen}
            ticketId={header.id}
            data={returnRefund}
            isSuperAdmin={isSuperAdmin}
            onClose={() => setRefundOpen(false)}
          />
        </>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Write `components/admin/dashboard/AdminTicketDetailV2.tsx`**

```tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  loadTicketHeader,
  loadTicketMessages,
  loadTicketCustomerContext,
  loadTicketReturnRefund,
  loadCannedResponses,
  loadAgentList,
} from '@/lib/admin/support'
import { TicketDetailInteractive } from '@/components/admin/support/detail/TicketDetailInteractive'
import { TicketMessageThread } from '@/components/admin/support/detail/TicketMessageThread'
import { TicketReplyComposer } from '@/components/admin/support/detail/TicketReplyComposer'
import { TicketActivityTimeline } from '@/components/admin/support/detail/TicketActivityTimeline'
import { TicketCustomerContext } from '@/components/admin/support/detail/TicketCustomerContext'
import { TicketReturnRefundPanel } from '@/components/admin/support/detail/TicketReturnRefundPanel'

export interface AdminTicketDetailV2Props {
  ticketId: string
  isSuperAdmin: boolean
}

function WidgetSkeleton() {
  return (
    <div
      aria-hidden
      className="h-40 bg-white/[0.03] border border-white/8 rounded-md animate-pulse"
    />
  )
}

async function ThreadSlot({ ticketId }: { ticketId: string }) {
  const messages = await loadTicketMessages(ticketId)
  return <TicketMessageThread messages={messages} />
}

async function ComposerSlot({ ticketId }: { ticketId: string }) {
  const cannedResponses = await loadCannedResponses()
  return <TicketReplyComposer ticketId={ticketId} cannedResponses={cannedResponses} />
}

async function CustomerContextSlot({ ticketId }: { ticketId: string }) {
  const context = await loadTicketCustomerContext(ticketId)
  if (!context) return null
  return <TicketCustomerContext context={context} />
}

export async function AdminTicketDetailV2({
  ticketId,
  isSuperAdmin,
}: AdminTicketDetailV2Props) {
  const header = await loadTicketHeader(ticketId)
  if (!header) notFound()

  const [agents, returnRefund] = await Promise.all([
    loadAgentList(),
    loadTicketReturnRefund(ticketId),
  ])

  return (
    <AdminLayout title={header.ticketNumber} subtitle={header.subject}>
      <div className="space-y-3.5">
        <TicketDetailInteractive
          header={header}
          agents={agents}
          returnRefund={returnRefund}
          isSuperAdmin={isSuperAdmin}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <Suspense fallback={<WidgetSkeleton />}>
              <ThreadSlot ticketId={ticketId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <ComposerSlot ticketId={ticketId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <TicketActivityTimeline ticketId={ticketId} />
            </Suspense>
          </div>
          <div className="space-y-3">
            <Suspense fallback={<WidgetSkeleton />}>
              <CustomerContextSlot ticketId={ticketId} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <TicketReturnRefundPanel ticketId={ticketId} />
            </Suspense>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 3: Write the smoke test**

```tsx
// tests/unit/components/admin/dashboard/AdminTicketDetailV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const notFoundMock = vi.fn(() => { throw new Error('NEXT_NOT_FOUND') })
vi.mock('next/navigation', () => ({ notFound: () => notFoundMock() }))

vi.mock('@/lib/admin/support', () => ({
  loadTicketHeader: vi.fn(),
  loadTicketMessages: vi.fn().mockResolvedValue([]),
  loadTicketCustomerContext: vi.fn().mockResolvedValue(null),
  loadTicketReturnRefund: vi.fn().mockResolvedValue(null),
  loadCannedResponses: vi.fn().mockResolvedValue([]),
  loadAgentList: vi.fn().mockResolvedValue([{ id: 'a1', name: 'Agent 1', openTicketCount: 1 }]),
}))

vi.mock('@/components/admin/support/detail/TicketDetailInteractive', () => ({
  TicketDetailInteractive: () => <div data-testid="interactive" />,
}))
vi.mock('@/components/admin/support/detail/TicketMessageThread', () => ({
  TicketMessageThread: () => <div data-testid="thread" />,
}))
vi.mock('@/components/admin/support/detail/TicketReplyComposer', () => ({
  TicketReplyComposer: () => <div data-testid="composer" />,
}))
vi.mock('@/components/admin/support/detail/TicketActivityTimeline', () => ({
  TicketActivityTimeline: () => <div data-testid="activity" />,
}))
vi.mock('@/components/admin/support/detail/TicketCustomerContext', () => ({
  TicketCustomerContext: () => <div data-testid="context" />,
}))
vi.mock('@/components/admin/support/detail/TicketReturnRefundPanel', () => ({
  TicketReturnRefundPanel: () => <div data-testid="return-refund" />,
}))

beforeEach(() => vi.clearAllMocks())

import { AdminTicketDetailV2 } from '@/components/admin/dashboard/AdminTicketDetailV2'

const HEADER = {
  id: 't1', ticketNumber: 'TKT-2026-000001', subject: 'Help',
  type: 'GENERAL', status: 'OPEN', priority: 'MEDIUM',
  customerId: 'c1', customerName: 'Ada', customerEmail: 'ada@e.com',
  orderId: null, orderNumber: null, assigneeId: null, assigneeName: null,
  createdAt: new Date(), firstRespondedAt: null, resolvedAt: null,
  ageHours: 1, isOverdue: false,
  returnRequested: false, returnApproved: null, refundAmount: null,
}

describe('AdminTicketDetailV2', () => {
  it('renders the interactive header + thread/composer/activity/context/return-refund slots', async () => {
    const mod = await import('@/lib/admin/support')
    ;(mod.loadTicketHeader as ReturnType<typeof vi.fn>).mockResolvedValueOnce(HEADER)
    const node = await AdminTicketDetailV2({ ticketId: 't1', isSuperAdmin: true })
    render(node as React.ReactElement)
    expect(screen.getByTestId('interactive')).toBeInTheDocument()
    expect(await screen.findByTestId('thread')).toBeInTheDocument()
    expect(await screen.findByTestId('composer')).toBeInTheDocument()
    expect(await screen.findByTestId('return-refund')).toBeInTheDocument()
  })

  it('calls notFound when the header is null', async () => {
    const mod = await import('@/lib/admin/support')
    ;(mod.loadTicketHeader as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await expect(
      AdminTicketDetailV2({ ticketId: 'missing', isSuperAdmin: false }),
    ).rejects.toThrow(/NEXT_NOT_FOUND/)
  })
})
```

- [ ] **Step 4: Run the test + typecheck**

```bash
npx vitest run tests/unit/components/admin/dashboard/AdminTicketDetailV2.test.tsx
npx tsc --noEmit
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit + push + PR (no merge)**

```bash
git add \
  components/admin/support/detail/TicketDetailInteractive.tsx \
  components/admin/dashboard/AdminTicketDetailV2.tsx \
  tests/unit/components/admin/dashboard/AdminTicketDetailV2.test.tsx
git commit -m "feat(admin-v2): add AdminTicketDetailV2 root + TicketDetailInteractive wrapper"
git push -u origin wave9p9/task-25-detail-v2-root
gh pr create --title "feat(admin-v2): AdminTicketDetailV2 root — Phase 9 W7 Task 25" --body "Server root: loadTicketHeader → notFound() if null; TicketDetailInteractive ('use client') owns return/refund inspector state + renders TicketHeader; 2-column grid of Suspense slots (thread + composer + activity left; customer-context + return/refund right). 2 tests passing. NOTE: assembler must confirm whether merged TicketHeader/return-refund panel self-own their inspectors — if so, collapse TicketDetailInteractive."
```

---

### Task 26: `AdminSupportV2.tsx` (server root for `/admin/support` home)

**Wave:** 7 | **Branch:** `wave9p9/task-26-support-home-v2` | **Model:** opus

**Schema realities for this task:**
- `AdminSupportV2.tsx` is a **server** component for the `/admin/support` dashboard home. Props (Shared Contracts): `AdminSupportV2Props { currentAdminId: string | null }`.
- Renders: a KPI strip (`loadSupportKpis('30d', currentAdminId)`), the live-chat queue summary (`loadChatQueue()` → merged W6 `AdminChatQueueV2` with `AdminChatQueueV2Props { queue: ChatQueueRow[] }`), the `AgentAvailabilityToggle` (`loadAgentAvailability(currentAdminId)` → merged W6 `AgentAvailabilityToggleProps { availability: AgentAvailabilityData }`), and quick links to `/admin/support/tickets`.
- Each section is its own Suspense slot so they stream independently.
- KPI strip here is read-only (no tab deep-links needed on the home page) — render plain `StatCard`s.

**Files:**
- Create: `components/admin/dashboard/AdminSupportV2.tsx`
- Tests:
  - `tests/unit/components/admin/dashboard/AdminSupportV2.test.tsx`

#### Steps

- [ ] **Step 1: Write `components/admin/dashboard/AdminSupportV2.tsx`**

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadSupportKpis,
  loadChatQueue,
  loadAgentAvailability,
} from '@/lib/admin/support'
import { AdminChatQueueV2 } from '@/components/admin/support/chat/AdminChatQueueV2'
import { AgentAvailabilityToggle } from '@/components/admin/support/chat/AgentAvailabilityToggle'

export interface AdminSupportV2Props {
  currentAdminId: string | null
}

const nFmt = new Intl.NumberFormat('en-US')

function fmtHours(h: number): string {
  return h >= 24 ? `${(h / 24).toFixed(1)}d` : `${h.toFixed(1)}h`
}

function SectionSkeleton() {
  return (
    <div aria-hidden className="h-40 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
  )
}

async function KpiStripSlot({ currentAdminId }: { currentAdminId: string | null }) {
  const k = await loadSupportKpis('30d', currentAdminId)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <StatCard label="Open" value={nFmt.format(k.openCount)} />
      <StatCard label="Unassigned" value={nFmt.format(k.unassignedCount)} />
      <StatCard
        label="Avg first response"
        value={fmtHours(k.avgFirstResponseHours)}
        trend={k.avgFirstResponseTrend}
      />
      <StatCard
        label="Resolved (30d)"
        value={nFmt.format(k.resolvedInRange)}
        trend={k.resolvedInRangeTrend}
      />
    </div>
  )
}

async function ChatQueueSlot() {
  const queue = await loadChatQueue()
  return <AdminChatQueueV2 queue={queue} />
}

async function AvailabilitySlot({ currentAdminId }: { currentAdminId: string | null }) {
  const availability = await loadAgentAvailability(currentAdminId)
  return <AgentAvailabilityToggle availability={availability} />
}

export async function AdminSupportV2({ currentAdminId }: AdminSupportV2Props) {
  return (
    <AdminLayout title="Support" subtitle="Tickets · live chat · agent availability">
      <div className="space-y-3.5">
        <Suspense fallback={<SectionSkeleton />}>
          <KpiStripSlot currentAdminId={currentAdminId} />
        </Suspense>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <Suspense fallback={<SectionSkeleton />}>
              <ChatQueueSlot />
            </Suspense>
          </div>
          <div className="space-y-3">
            <Suspense fallback={<SectionSkeleton />}>
              <AvailabilitySlot currentAdminId={currentAdminId} />
            </Suspense>
            <section className="bg-neutral-900/60 border border-white/8 rounded-md p-3 space-y-2">
              <h2 className="text-sm font-semibold text-white">Quick links</h2>
              <Link
                href="/admin/support/tickets"
                className="block h-9 px-3 inline-flex items-center rounded-md border border-white/8 bg-white/[0.03] text-sm text-white/70 hover:text-white hover:bg-white/[0.06]"
              >
                All tickets
              </Link>
              <Link
                href="/admin/support/tickets?tab=escalated"
                className="block h-9 px-3 inline-flex items-center rounded-md border border-white/8 bg-white/[0.03] text-sm text-white/70 hover:text-white hover:bg-white/[0.06]"
              >
                Escalated
              </Link>
              <Link
                href="/admin/support/tickets?tab=mine"
                className="block h-9 px-3 inline-flex items-center rounded-md border border-white/8 bg-white/[0.03] text-sm text-white/70 hover:text-white hover:bg-white/[0.06]"
              >
                My tickets
              </Link>
            </section>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 2: Write the smoke test**

```tsx
// tests/unit/components/admin/dashboard/AdminSupportV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/support', () => ({
  loadSupportKpis: vi.fn().mockResolvedValue({
    openCount: 5, unassignedCount: 2,
    avgFirstResponseHours: 3.2,
    avgFirstResponseTrend: { direction: 'flat', text: '— 0%' },
    avgResolutionHours: 18, resolvedInRange: 12,
    resolvedInRangeTrend: { direction: 'up', text: '+3' },
  }),
  loadChatQueue: vi.fn().mockResolvedValue([]),
  loadAgentAvailability: vi.fn().mockResolvedValue({ isOnline: true, maxChats: 3, activeChats: 1 }),
}))

vi.mock('@/components/admin/support/chat/AdminChatQueueV2', () => ({
  AdminChatQueueV2: () => <div data-testid="chat-queue" />,
}))
vi.mock('@/components/admin/support/chat/AgentAvailabilityToggle', () => ({
  AgentAvailabilityToggle: () => <div data-testid="availability" />,
}))

beforeEach(() => vi.clearAllMocks())

import { AdminSupportV2 } from '@/components/admin/dashboard/AdminSupportV2'

describe('AdminSupportV2', () => {
  it('renders the KPI strip, chat queue, availability toggle, and quick links', async () => {
    const node = await AdminSupportV2({ currentAdminId: 'admin-1' })
    render(node as React.ReactElement)
    expect(await screen.findByText('Avg first response')).toBeInTheDocument()
    expect(await screen.findByTestId('chat-queue')).toBeInTheDocument()
    expect(await screen.findByTestId('availability')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All tickets' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test + typecheck**

```bash
npx vitest run tests/unit/components/admin/dashboard/AdminSupportV2.test.tsx
npx tsc --noEmit
```
Expected: PASS (1 test).

- [ ] **Step 4: Commit + push + PR (no merge)**

```bash
git add \
  components/admin/dashboard/AdminSupportV2.tsx \
  tests/unit/components/admin/dashboard/AdminSupportV2.test.tsx
git commit -m "feat(admin-v2): add AdminSupportV2 home root (KPIs + chat queue + availability)"
git push -u origin wave9p9/task-26-support-home-v2
gh pr create --title "feat(admin-v2): AdminSupportV2 home root — Phase 9 W7 Task 26" --body "Server root for /admin/support home: KPI strip Suspense (loadSupportKpis), live-chat queue Suspense (loadChatQueue → AdminChatQueueV2), AgentAvailabilityToggle Suspense (loadAgentAvailability), quick links to tickets. 1 test passing."
```

---

### Task 27: V1 relocation + 3 dispatchers + cross-link fix

**Wave:** 7 | **Branch:** `wave9p9/task-27-dispatchers-v1-relocation` | **Model:** opus

**Schema realities for this task:**
- **V1 routes to relocate (verbatim):**
  - `app/admin/support/page.tsx` (413L, **server** component, `export const dynamic = 'force-dynamic'`, no `params`). Relocate its body into `components/admin/_v1/AdminSupportV1Page.tsx` as `export function AdminSupportV1Page()`. Re-expose at `app/admin/support-v1/page.tsx`.
  - `app/admin/support/tickets/page.tsx` (537L, **client** component `'use client'`, no `params`). Relocate into `components/admin/_v1/AdminSupportV1TicketsPage.tsx` as `export function AdminSupportV1TicketsPage()`. Re-expose at `app/admin/support-v1/tickets/page.tsx`.
  - `app/admin/support/tickets/[id]/page.tsx` (554L, **client** component, uses `useParams()` internally — **no `params` prop indirection to strip**, it reads the id via `useParams`). Relocate into `components/admin/_v1/AdminSupportV1TicketDetailPage.tsx` as `export function AdminSupportV1TicketDetailPage()`. Re-expose at `app/admin/support-v1/tickets/[id]/page.tsx`. Because it uses `useParams()`, the re-exposer is a plain `() => <AdminSupportV1TicketDetailPage />` with no params forwarding needed.
- **V1 stub:** `components/admin/_v1/AdminSupportV1.tsx` — links to `/admin/support-v1` (mirrors `AdminCustomersV1.tsx`).
- **3 dispatchers** replace the canonical routes. Each resolves `isSuperAdmin` (via `getSession` + `prisma.customer.adminRole`, like every Phase 4–8 dispatcher) AND `currentAdminId` (via `resolveAdminUserId(session.userId)` from `lib/admin/support` — Customer.id → AdminUser.id). Gate on `process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true'`.
  - `app/admin/support/page.tsx` → `AdminSupportV2 { currentAdminId }` (home).
  - `app/admin/support/tickets/page.tsx` → `AdminSupportTicketsV2 { searchParams, currentAdminId, isSuperAdmin }`. The canonical tickets route awaits `searchParams: Promise<...>`.
  - `app/admin/support/tickets/[id]/page.tsx` → `AdminTicketDetailV2 { ticketId, isSuperAdmin }`. Awaits `params: Promise<{ id: string }>`.
- **Cross-link fix:** `components/admin/customers/detail/CustomerSupportTicketsPanel.tsx` currently links to `/admin/support/${t.id}` (404s). Repoint to `/admin/support/tickets/${t.id}`.
- **Dispatcher tests use the WORKING render+getByTestId pattern** from `tests/unit/app/admin/loyalty/page.test.tsx` — NOT the broken `String(node).toContain` from the Phase 8 plan.

**Files:**
- Create: `components/admin/_v1/AdminSupportV1.tsx` (stub)
- Create: `components/admin/_v1/AdminSupportV1Page.tsx` (relocation of support home)
- Create: `components/admin/_v1/AdminSupportV1TicketsPage.tsx` (relocation of tickets list)
- Create: `components/admin/_v1/AdminSupportV1TicketDetailPage.tsx` (relocation of ticket detail)
- Create: `app/admin/support-v1/page.tsx`
- Create: `app/admin/support-v1/tickets/page.tsx`
- Create: `app/admin/support-v1/tickets/[id]/page.tsx`
- **Replace:** `app/admin/support/page.tsx` (dispatcher)
- **Replace:** `app/admin/support/tickets/page.tsx` (dispatcher)
- **Replace:** `app/admin/support/tickets/[id]/page.tsx` (dispatcher)
- **Modify:** `components/admin/customers/detail/CustomerSupportTicketsPanel.tsx` (cross-link)
- Tests:
  - `tests/unit/app/admin/support/page.test.tsx`
  - `tests/unit/app/admin/support/tickets/page.test.tsx`
  - `tests/unit/app/admin/support/tickets/[id]/page.test.tsx`

#### Steps

- [ ] **Step 1: Relocate the 3 V1 pages verbatim**

For each route, move the FULL file body into the corresponding `_v1` component file and rename the export. Imports and JSX stay byte-for-byte identical; only the function name + `export default` → `export function` changes.

`components/admin/_v1/AdminSupportV1Page.tsx` — copy the entire body of `app/admin/support/page.tsx` (413L). It is already a server component with `export const dynamic = 'force-dynamic'`. Keep the `dynamic` export and all helper functions (`getTicketStats`, `getRecentTickets`, `StatCard`, `getStatusColor`, etc.). Rename only the final route:

```tsx
// at the bottom of the relocated file, the original was:
//   export default function SupportPage() { ... }
// becomes:
export function AdminSupportV1Page() {
  return (
    <AdminLayout
      title="Support Tickets"
      subtitle="Manage customer support requests, refunds, returns, and inquiries"
    >
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-12 w-12 border-b-2 border-white"></div>
        </div>
      }>
        <SupportDashboard />
      </Suspense>
    </AdminLayout>
  )
}
```

`components/admin/_v1/AdminSupportV1TicketsPage.tsx` — copy the entire body of `app/admin/support/tickets/page.tsx` (537L). It is `'use client'`; keep that pragma at the top. Rename:

```tsx
// original: export default function TicketsPage() { ... }
// becomes:
export function AdminSupportV1TicketsPage() {
  // ... entire original body verbatim ...
}
```

`components/admin/_v1/AdminSupportV1TicketDetailPage.tsx` — copy the entire body of `app/admin/support/tickets/[id]/page.tsx` (554L). It is `'use client'` and reads the id via `useParams()` — **leave that as-is** (no params prop). Rename:

```tsx
// original: export default function TicketDetailPage() { ... }
// becomes:
export function AdminSupportV1TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id as string
  // ... entire original body verbatim ...
}
```

- [ ] **Step 2: Write the V1 stub `components/admin/_v1/AdminSupportV1.tsx`**

```tsx
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

export function AdminSupportV1() {
  return (
    <AdminLayout title="Support" subtitle="Tickets + live chat">
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified support dashboard is in beta. Enable{' '}
          <code className="font-mono">NEXT_PUBLIC_ADMIN_V2_ENABLED=true</code> to try it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <Link href="/admin/support-v1" className="block">
            <Card className="p-4 hover:bg-white/[0.04] transition-colors">
              <h3 className="text-base font-semibold text-white">Support (V1)</h3>
              <p className="text-sm text-white/50 mt-1">Original dashboard + tickets + live chat</p>
            </Card>
          </Link>
        </div>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 3: Re-expose the 3 V1 routes**

```tsx
// app/admin/support-v1/page.tsx
import { AdminSupportV1Page } from '@/components/admin/_v1/AdminSupportV1Page'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <AdminSupportV1Page />
}
```

```tsx
// app/admin/support-v1/tickets/page.tsx
import { AdminSupportV1TicketsPage } from '@/components/admin/_v1/AdminSupportV1TicketsPage'

export default function Page() {
  return <AdminSupportV1TicketsPage />
}
```

```tsx
// app/admin/support-v1/tickets/[id]/page.tsx
import { AdminSupportV1TicketDetailPage } from '@/components/admin/_v1/AdminSupportV1TicketDetailPage'

export default function Page() {
  return <AdminSupportV1TicketDetailPage />
}
```

- [ ] **Step 4: Replace `app/admin/support/page.tsx` with the home dispatcher**

```tsx
// app/admin/support/page.tsx
import { AdminSupportV1 } from '@/components/admin/_v1/AdminSupportV1'
import { AdminSupportV2 } from '@/components/admin/dashboard/AdminSupportV2'
import { getSession } from '@/lib/auth/session'
import { resolveAdminUserId } from '@/lib/admin/support'

export const revalidate = 60

export default async function AdminSupportPage() {
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminSupportV1 />
  }

  let currentAdminId: string | null = null
  try {
    const session = await getSession()
    currentAdminId = await resolveAdminUserId(session?.userId ?? null)
  } catch {
    currentAdminId = null
  }

  return <AdminSupportV2 currentAdminId={currentAdminId} />
}
```

- [ ] **Step 5: Replace `app/admin/support/tickets/page.tsx` with the tickets dispatcher**

```tsx
// app/admin/support/tickets/page.tsx
import { AdminSupportV1TicketsPage } from '@/components/admin/_v1/AdminSupportV1TicketsPage'
import { AdminSupportTicketsV2 } from '@/components/admin/dashboard/AdminSupportTicketsV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { resolveAdminUserId } from '@/lib/admin/support'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string; range?: string; q?: string; page?: string }>
}

export default async function AdminSupportTicketsPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminSupportV1TicketsPage />
  }

  let isSuperAdmin = false
  let currentAdminId: string | null = null
  try {
    const session = await getSession()
    if (session?.userId) {
      const customer = await prisma.customer.findUnique({
        where: { id: session.userId },
        select: { adminRole: true },
      })
      isSuperAdmin = customer?.adminRole === 'SUPER_ADMIN'
    }
    currentAdminId = await resolveAdminUserId(session?.userId ?? null)
  } catch {
    isSuperAdmin = false
    currentAdminId = null
  }

  return (
    <AdminSupportTicketsV2
      searchParams={params}
      currentAdminId={currentAdminId}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
```

- [ ] **Step 6: Replace `app/admin/support/tickets/[id]/page.tsx` with the detail dispatcher**

```tsx
// app/admin/support/tickets/[id]/page.tsx
import { AdminSupportV1TicketDetailPage } from '@/components/admin/_v1/AdminSupportV1TicketDetailPage'
import { AdminTicketDetailV2 } from '@/components/admin/dashboard/AdminTicketDetailV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminSupportTicketDetailPage({ params }: PageProps) {
  const { id } = await params

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminSupportV1TicketDetailPage />
  }

  let isSuperAdmin = false
  try {
    const session = await getSession()
    if (session?.userId) {
      const customer = await prisma.customer.findUnique({
        where: { id: session.userId },
        select: { adminRole: true },
      })
      isSuperAdmin = customer?.adminRole === 'SUPER_ADMIN'
    }
  } catch {
    isSuperAdmin = false
  }

  return <AdminTicketDetailV2 ticketId={id} isSuperAdmin={isSuperAdmin} />
}
```

- [ ] **Step 7: Fix the cross-link in `CustomerSupportTicketsPanel.tsx`**

```tsx
// components/admin/customers/detail/CustomerSupportTicketsPanel.tsx
// change the <Link href> from `/admin/support/${t.id}` to:
              <Link
                href={`/admin/support/tickets/${t.id}`}
                className="block px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between gap-2"
              >
```

- [ ] **Step 8: Write the home dispatcher test**

```tsx
// tests/unit/app/admin/support/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => ({ userId: 'cust-1', isAdmin: true })),
}))
vi.mock('@/lib/admin/support', () => ({
  resolveAdminUserId: vi.fn(async () => 'admin-1'),
}))
vi.mock('@/components/admin/dashboard/AdminSupportV2', () => ({
  AdminSupportV2: () => <div data-testid="v2">V2 support</div>,
}))
vi.mock('@/components/admin/_v1/AdminSupportV1', () => ({
  AdminSupportV1: () => <div data-testid="v1">V1 support</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/support/page dispatcher', () => {
  it('renders V1 when the flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/support/page')
    render(await mod.default())
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 and forwards the resolved currentAdminId when the flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const v2Spy = vi.fn(() => <div data-testid="v2-spy">V2</div>)
    vi.doMock('@/components/admin/dashboard/AdminSupportV2', () => ({ AdminSupportV2: v2Spy }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn(async () => ({ userId: 'cust-1', isAdmin: true })),
    }))
    vi.doMock('@/lib/admin/support', () => ({ resolveAdminUserId: vi.fn(async () => 'admin-1') }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/support/page')
    render(await mod.default())
    expect(screen.getByTestId('v2-spy')).toBeInTheDocument()
    expect(v2Spy).toHaveBeenCalledWith(
      expect.objectContaining({ currentAdminId: 'admin-1' }),
      undefined,
    )
  })
})
```

- [ ] **Step 9: Write the tickets-list dispatcher test**

```tsx
// tests/unit/app/admin/support/tickets/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => ({ userId: 'cust-1', isAdmin: true })),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { customer: { findUnique: vi.fn(async () => ({ adminRole: 'SUPER_ADMIN' })) } },
}))
vi.mock('@/lib/admin/support', () => ({ resolveAdminUserId: vi.fn(async () => 'admin-1') }))
vi.mock('@/components/admin/dashboard/AdminSupportTicketsV2', () => ({
  AdminSupportTicketsV2: () => <div data-testid="v2">V2 tickets</div>,
}))
vi.mock('@/components/admin/_v1/AdminSupportV1TicketsPage', () => ({
  AdminSupportV1TicketsPage: () => <div data-testid="v1">V1 tickets</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/support/tickets/page dispatcher', () => {
  it('renders V1 tickets when the flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/support/tickets/page')
    render(await mod.default({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 and forwards searchParams + isSuperAdmin + currentAdminId when the flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const v2Spy = vi.fn(() => <div data-testid="v2-spy">V2</div>)
    vi.doMock('@/components/admin/dashboard/AdminSupportTicketsV2', () => ({
      AdminSupportTicketsV2: v2Spy,
    }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn(async () => ({ userId: 'cust-1', isAdmin: true })),
    }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: { customer: { findUnique: vi.fn(async () => ({ adminRole: 'SUPER_ADMIN' })) } },
    }))
    vi.doMock('@/lib/admin/support', () => ({ resolveAdminUserId: vi.fn(async () => 'admin-1') }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/support/tickets/page')
    render(await mod.default({ searchParams: Promise.resolve({ tab: 'mine', range: '7d' }) }))
    expect(screen.getByTestId('v2-spy')).toBeInTheDocument()
    expect(v2Spy).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: { tab: 'mine', range: '7d' },
        isSuperAdmin: true,
        currentAdminId: 'admin-1',
      }),
      undefined,
    )
  })
})
```

- [ ] **Step 10: Write the ticket-detail dispatcher test**

```tsx
// tests/unit/app/admin/support/tickets/[id]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => ({ userId: 'cust-1', isAdmin: true })),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { customer: { findUnique: vi.fn(async () => ({ adminRole: 'ADMIN' })) } },
}))
vi.mock('@/components/admin/dashboard/AdminTicketDetailV2', () => ({
  AdminTicketDetailV2: () => <div data-testid="v2">V2 detail</div>,
}))
vi.mock('@/components/admin/_v1/AdminSupportV1TicketDetailPage', () => ({
  AdminSupportV1TicketDetailPage: () => <div data-testid="v1">V1 detail</div>,
}))

beforeEach(() => {
  vi.resetModules()
})

describe('admin/support/tickets/[id]/page dispatcher', () => {
  it('renders V1 detail when the flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/support/tickets/[id]/page')
    render(await mod.default({ params: Promise.resolve({ id: 't1' }) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 detail and forwards ticketId + isSuperAdmin when the flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const v2Spy = vi.fn(() => <div data-testid="v2-spy">V2</div>)
    vi.doMock('@/components/admin/dashboard/AdminTicketDetailV2', () => ({
      AdminTicketDetailV2: v2Spy,
    }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn(async () => ({ userId: 'cust-1', isAdmin: true })),
    }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: { customer: { findUnique: vi.fn(async () => ({ adminRole: 'ADMIN' })) } },
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/support/tickets/[id]/page')
    render(await mod.default({ params: Promise.resolve({ id: 't1' }) }))
    expect(screen.getByTestId('v2-spy')).toBeInTheDocument()
    expect(v2Spy).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 't1', isSuperAdmin: false }),
      undefined,
    )
  })
})
```

- [ ] **Step 11: Run the tests + typecheck**

```bash
npx vitest run \
  tests/unit/app/admin/support/page.test.tsx \
  tests/unit/app/admin/support/tickets/page.test.tsx \
  'tests/unit/app/admin/support/tickets/[id]/page.test.tsx'
npx tsc --noEmit
```
Expected: PASS (6 tests).

- [ ] **Step 12: Commit + push + PR (no merge)**

```bash
mkdir -p app/admin/support-v1/tickets/'[id]' \
  tests/unit/app/admin/support/tickets/'[id]'
git add \
  components/admin/_v1/AdminSupportV1.tsx \
  components/admin/_v1/AdminSupportV1Page.tsx \
  components/admin/_v1/AdminSupportV1TicketsPage.tsx \
  components/admin/_v1/AdminSupportV1TicketDetailPage.tsx \
  app/admin/support-v1/page.tsx \
  app/admin/support-v1/tickets/page.tsx \
  app/admin/support-v1/tickets/'[id]'/page.tsx \
  app/admin/support/page.tsx \
  app/admin/support/tickets/page.tsx \
  app/admin/support/tickets/'[id]'/page.tsx \
  components/admin/customers/detail/CustomerSupportTicketsPanel.tsx \
  tests/unit/app/admin/support/page.test.tsx \
  tests/unit/app/admin/support/tickets/page.test.tsx \
  'tests/unit/app/admin/support/tickets/[id]/page.test.tsx'
git commit -m "feat(admin-v2): wire Phase 9 support dispatchers + V1 relocation + cross-link fix"
git push -u origin wave9p9/task-27-dispatchers-v1-relocation
gh pr create --title "feat(admin-v2): Phase 9 W7 dispatchers + V1 relocation" --body "Relocates 3 V1 support routes (413L home / 537L tickets / 554L detail) verbatim to /admin/support-v1/**. Replaces the 3 canonical routes with flag dispatchers (resolve isSuperAdmin + currentAdminId via getSession + resolveAdminUserId). Fixes CustomerSupportTicketsPanel cross-link → /admin/support/tickets/[id]. 6 dispatcher tests passing (working render+getByTestId pattern, not the broken Phase 8 String(node) assertion)."
```

---

## Wave 8 — Verification + QA doc (sequential)

### Task 28: Verification + QA doc

**Wave:** 8 | **Branch:** `wave9p9/task-28-qa-doc` | **Model:** sonnet

**Schema realities for this task:**
- Verification runs `npx tsc --noEmit` + `npx vitest run` + `npx eslint` on the merged `main` branch (assumes the controller has merged Tasks 1–27). Expected: ~28 new test files; zero NEW tsc errors, zero NEW lint errors, zero NEW test failures (baseline-compare any pre-existing failures against the pre-Phase-9 commit, as Phase 8 QA did).
- QA doc structure mirrors `docs/superpowers/plans/2026-05-30-admin-rebuild-phase8-qa.md`. Sections: title/status/scope; pre-flight (captured counts); list-page smoke (tabs/KPIs/SLA/bulk); detail-page smoke (thread/canned-reply/assign/status/return-refund); live-chat smoke (SSE connect/reconnect/send/availability); V1 fallback; cross-link checks; regression risk register (incl. customer API preservation); Phase 9.5 follow-ups.
- **Never run pnpm.** Use npx.

**Files:**
- Create: `docs/superpowers/plans/2026-06-19-admin-rebuild-phase9-qa.md`

#### Steps

- [ ] **Step 1: Run verification commands on merged `main`**

```bash
npx tsc --noEmit
npx vitest run
npx eslint .
```

Capture: total test count + pass/fail breakdown; any tsc errors; any lint errors. For any pre-existing failures, re-run the affected suites at the pre-Phase-9 baseline commit and confirm Phase 9 introduced **zero** new failures (Phase 8 QA precedent).

- [ ] **Step 2: Grep Phase 9.5 follow-up markers**

```bash
grep -rn "Phase 9.5\|TODO(9.5)\|deferred to 9.5" \
  app/admin/support app/api/admin/support \
  components/admin/support components/admin/dashboard/AdminSupport* \
  components/admin/dashboard/AdminTicketDetail* \
  lib/admin/support.ts app/admin/support/actions.ts
```

List each result under "Phase 9.5 follow-ups".

- [ ] **Step 3: Confirm customer-facing APIs are preserved (regression guard)**

```bash
# These MUST still exist and be unmodified by Phase 9:
ls app/api/support/tickets/route.ts \
   app/api/support/tickets/'[id]'/route.ts \
   app/api/support/tickets/'[id]'/messages/route.ts \
   app/api/chat/live/'[sessionId]'/route.ts
git log --oneline -- app/api/support app/api/chat/live | head
```

Confirm Phase 9 added the admin SSE endpoint (`app/api/admin/support/chat/[sessionId]/stream/route.ts`) ALONGSIDE — never modifying the customer routes.

- [ ] **Step 4: Write the QA doc**

````md
# Phase 9: Support QA

**Status:** Ready for QA — all 28 tasks (Waves 1–8) merged to `main`.
**Phase plan:** `docs/superpowers/plans/2026-06-19-admin-rebuild-phase9-support.md`
**Phase spec:** `docs/superpowers/specs/2026-06-19-admin-rebuild-phase9-support.md`

## Scope

New V2 `/admin/support` suite gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED`:
- `/admin/support` home (KPI strip + live-chat queue + agent availability + quick links).
- `/admin/support/tickets` list (5 segment tabs: Inbox / Mine / Open / Escalated / Resolved
  + range pills + KPI strip + SLA/overdue badges + bulk assign/status/close).
- `/admin/support/tickets/[id]` detail (header + thread + reply/internal-note composer with
  canned responses + assign/status/return-decision/refund inspectors + customer context +
  activity timeline).
- Live chat over **SSE** (`/api/admin/support/chat/[sessionId]/stream`) with a polling fallback.
- One additive schema migration (`CannedResponse` model + `SupportTicket.firstRespondedAt`).

V1 home + tickets + detail relocated verbatim to `/admin/support-v1` (+ `/tickets`, `/tickets/[id]`).
Customer-facing `/api/support/*` + `/api/chat/live/*` routes preserved unchanged.

## Pre-flight (captured on merged `main`)

- `npx tsc --noEmit` → **0 new errors** (pre-existing unrelated errors baseline-compared against
  the pre-Phase-9 commit; enumerate any here).
- `npx vitest run` → **N passed / M total**; the (M−N) failures are pre-existing suites with
  no Phase 9 involvement (verified by re-running them at the pre-Phase-9 baseline — identical
  failures; Phase 9 introduced **zero** new test failures). Phase 9 support suites in isolation:
  **~28 test files, all green** (migration, data layer, actions, list components, detail widgets,
  inspectors, SSE hook + route, chat components, list client, reply composer, 3 roots, 3
  dispatchers).
- `npx eslint` (Phase 9 files) → **0 errors** (note any warnings).

## List page smoke checklist (NEXT_PUBLIC_ADMIN_V2_ENABLED=true)

- [ ] /admin/support/tickets loads with tab=inbox + range=30d by default
- [ ] Switching tabs updates the URL: inbox / mine / open / escalated / resolved
- [ ] Range pills update ?range=…; KPI strip refreshes within Suspense
- [ ] KPI cards deep-link: Open→open, Unassigned→inbox, Resolved→resolved
- [ ] "Mine" tab shows only tickets assigned to the current agent (depends on resolveAdminUserId)
- [ ] SLA/overdue badge shows on tickets with no firstRespondedAt and ageHours > FIRST_RESPONSE_SLA_HOURS (4h)
- [ ] Desktop row click → /admin/support/tickets/[id]
- [ ] Desktop checkbox toggles selection; header checkbox toggles all
- [ ] Mobile (md:hidden) cards: tap navigates when no selection; long-press enters multi-select
- [ ] BulkSheet appears when selection > 0; shows count
- [ ] Bulk assign: dropdown lists agents (loadAgentList); success toast; selection clears
- [ ] Bulk set-status: success toast
- [ ] Bulk close: SUPER_ADMIN only (disabled tooltip for plain ADMIN)
- [ ] Search (?q=) filters subject / ticketNumber / customerEmail
- [ ] Pagination (?page=) advances; PaginatedResult.items used (not .rows)

## Detail page smoke checklist

- [ ] /admin/support/tickets/[id] streams header first, then thread/composer/activity/context/return-refund slots
- [ ] TicketHeader: ticket#, subject, type, status, priority, age/SLA, assignee; Assign + Status inspectors open
- [ ] AssignAgentInspector: agent list with open-load counts; assign persists; toast
- [ ] StatusChangeInspector: status transitions persist; toast
- [ ] TicketMessageThread: messages asc; internal notes visually distinct; attachments rendered
- [ ] TicketReplyComposer: reply vs internal-note toggle; canned-response picker inserts body into textarea; send via replyToTicket / addInternalNote; clears on success; toast
- [ ] First public admin reply sets firstRespondedAt (verify the SLA KPI/badge reflects it)
- [ ] Reply to a RESOLVED/CLOSED ticket follows the existing reopen behavior
- [ ] TicketCustomerContext: tier/LTV/totalOrders; linked order summary; other-tickets count
- [ ] TicketReturnRefundPanel + ReturnDecisionInspector: approve (optional EasyPost label) / deny with reason; persists; toast
- [ ] RefundInspector: SUPER_ADMIN only; amount/type/reason; processRefund (Stripe) + RefundRecord; idempotency prevents double-charge
- [ ] TicketActivityTimeline: chronological merge of message/status/assignment/return/refund events
- [ ] /admin/support/tickets/[missing-id] returns 404 (notFound)

## Live chat smoke checklist

- [ ] /admin/support home shows the WAITING queue (loadChatQueue) with wait times
- [ ] Accept a chat session (acceptChatSession): status → ACTIVE, adminId set, availability.activeChats increments
- [ ] AdminChatPanelV2 connects via EventSource to /api/admin/support/chat/[sessionId]/stream
- [ ] New customer messages arrive over SSE within ~1.5s (server DB-poll tick)
- [ ] Stream self-closes (~50s) and the client auto-reconnects with ?cursor=<last event id> — no duplicate messages (dedupe by id)
- [ ] Send an admin message (sendChatMessage): appears in the panel; reaches the customer widget on its next poll
- [ ] EventSource-undefined fallback: panel falls back to polling /api/chat/live/[sessionId]
- [ ] AgentAvailabilityToggle: toggle online/offline + maxChats (setAgentAvailability) persists; activeChats reflected
- [ ] Close a chat session (closeChatSession): status → CLOSED, duration set, availability.activeChats decrements

## V1 fallback checks (NEXT_PUBLIC_ADMIN_V2_ENABLED=false)

- [ ] /admin/support → V1 stub linking to /admin/support-v1
- [ ] /admin/support-v1 → original V1 dashboard (413L server, force-dynamic)
- [ ] /admin/support-v1/tickets → original V1 tickets list + live-chat tab (537L client)
- [ ] /admin/support-v1/tickets/[id] → original V1 ticket detail (554L client, useParams)

## Cross-link checks

- [ ] CustomerSupportTicketsPanel row → /admin/support/tickets/[id] (FIXED from the 404ing /admin/support/[id])
- [ ] Ticket → order link → Phase 4 fulfillment
- [ ] Customer context → customer detail link

## Regression risk register

- **Customer-facing API preservation (critical):** `app/api/support/tickets/**` and
  `app/api/chat/live/**` must remain unmodified — the customer widget + ticket creation depend
  on them. Phase 9 only ADDS `app/api/admin/support/chat/[sessionId]/stream`. Re-test the
  customer chat/ticket flows if any of those files change.
- Any change to `SupportTicket` / `SupportMessage` / `LiveChatSession` schema re-validates the
  loaders + actions.
- `resolveAdminUserId` (Customer.id → AdminUser.id) drives the "Mine" tab + assignment defaults —
  changes to the AdminUser↔Customer linkage field re-validate it.
- `firstRespondedAt` is set-once on the first public admin message; changes to `replyToTicket`
  must preserve that contract (it backs the avg-first-response KPI + overdue badge).
- `issueRefund` + `bulkCloseTickets` gate `requireAdminRole('SUPER_ADMIN')`; the refund
  idempotency key prevents double-charge — re-validate on any actions.ts change.
- The 3 dispatchers resolve `isSuperAdmin` via `getSession()` + `prisma.customer.adminRole` and
  `currentAdminId` via `resolveAdminUserId`; changes to the session shape re-validate all three.
- SSE on serverless: the stream caps lifetime + the client auto-reconnects with a cursor;
  cross-instance writes are visible because the stream DB-polls (no in-memory pub/sub).

## Phase 9.5 follow-ups

In-code markers found via grep (`Phase 9.5` / `TODO(9.5)` / `deferred to 9.5`):

- (Insert grep results from Step 2 here, one bullet per occurrence with file:line + context.)

Planned backlog (from spec §12, not yet marked in code):

- Configurable SLA thresholds (currently hard-coded FIRST_RESPONSE_SLA_HOURS=4 / RESOLUTION_SLA_HOURS=48).
- Websocket/Redis real-time upgrade (replacing SSE DB-poll).
- Customer-side SSE (customer widget still polls).
- Saved ticket views / filters.
- Ticket tagging.
- Macro / automation rules.
- CSAT survey on resolve.
- Per-agent performance dashboard.
- Merge-duplicate-tickets.
- Attachment upload pipeline hardening.
````

- [ ] **Step 5: Commit + push + PR (no merge)**

```bash
git add docs/superpowers/plans/2026-06-19-admin-rebuild-phase9-qa.md
git commit -m "docs(admin-v2): add Phase 9 support QA doc"
git push -u origin wave9p9/task-28-qa-doc
gh pr create --title "docs(admin-v2): Phase 9 W8 QA doc" --body "QA checklist for the Phase 9 support rebuild: list-page tab/range/KPI/SLA/bulk smoke; detail-page thread/canned-reply/assign/status/return-refund smoke; live-chat SSE connect/reconnect/send/availability smoke; V1 fallback; cross-link checks; regression risks (incl. customer API preservation); Phase 9.5 follow-ups."
```

---
