# Phase 9: Support — Design Spec

**Status:** Approved design, ready for implementation planning.
**Date:** 2026-06-19
**Series:** Admin Dashboard Rebuild (follows Phase 8 Customers).
**Predecessor specs/plans:** `docs/superpowers/specs/2026-05-30-admin-rebuild-phase8-customers.md`, `docs/superpowers/plans/2026-05-30-admin-rebuild-phase8-customers.md`.

---

## 1. Goal & scope

Rebuild the admin **Support** experience as a V2 surface gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED`, mirroring the Phase 4–8 pattern (feature-flag dispatcher + V1 relocation + V2 root with TabPills/range pills/KPI strip/Suspense slots + new `lib/admin/*` data layer + `app/admin/*/actions.ts` server actions).

**Full support suite is in scope:**
1. **Ticket management** — V2 list (segment tabs + KPIs + bulk) and V2 detail (thread + reply + status/assign/resolve + sidebar context).
2. **Live chat** — V2 queue + chat panel with an **SSE streaming** transport (replacing 3s client polling for admins) + agent availability.
3. **Return/refund** — an **inline decision inspector** in the ticket detail reusing existing `lib/support/refund-helpers.ts` (Stripe + EasyPost). No new payment logic.
4. **Supporting features** — canned responses (new model + composer picker + manager), SLA/aging indicators, bulk actions, agent-performance KPIs.

### Out of scope
- Rebuilding the customer-facing chat widget or customer ticket APIs (they are preserved unchanged).
- Rebuilding the Phase 4 fulfillment return pipeline itself (the inspector reuses it).
- Replacing the customer-side live-chat polling transport (only the admin side gets SSE; customer polling endpoint remains).
- Websocket/Redis infrastructure (SSE is backed by server-side DB polling — see §7).

---

## 2. Tech stack & conventions

Same as Phase 8: Next.js 16 App Router, React 19 (RSC + Server Actions + Suspense), TypeScript strict, Prisma 6 + Neon, Tailwind v4 (`@theme`, direct dark colors — **no `dark:` modifiers**), Framer Motion, Phosphor icons, Sonner toasts (`lib/toast.ts`), class-variance-authority, Vitest 4.1.7 + @testing-library/react + jsdom.

**Cross-cutting rules carried from Phase 8 (apply to every task):**
1. No Prisma value-imports in `'use client'` files — use `import type` for `lib/admin/support` types; client mutations go through server actions.
2. No `dark:` Tailwind modifiers; always-dark, direct colors (`bg-neutral-900/60`, `text-white/50`, `border-white/8`).
3. `PaginatedResult` shape is `{ items, total, page, pageSize }` — destructure `.items`.
4. Vitest 4.x generics use 1-arg `vi.fn<T>()`.
5. **This repo uses npm, not pnpm.** Test commands: `npx vitest run <path>`, typecheck `npx tsc --noEmit`. Never run pnpm.
6. `requireAdmin()` no-arg overload in server actions returns the admin userId; `requireAdminRole('SUPER_ADMIN')` for sensitive ops.
7. Interactive panels that embed inspectors must be implemented **after** their inspectors exist on disk (Phase 8 lesson: Vite static import-analysis can't resolve a not-yet-created module before `vi.mock`). Wave ordering reflects this.

---

## 3. Existing system (must-preserve map)

**Prisma models (already exist — no changes except §4):**
- `SupportTicket` — `id, ticketNumber (unique "TKT-YYYY-XXXXXX"), type (SupportTicketType), status (SupportTicketStatus), priority (SupportPriority), subject, customerId?, customerEmail, customerName, orderId?, orderNumber?, refundAmount?, refundReason?, returnRequested (Bool), returnApproved (Bool?), returnLabel?, assignedToId? (→AdminUser), assignedAt?, resolvedAt?, resolvedBy?, resolution?, aiAssisted (Bool), aiSummary?, createdAt, updatedAt`. Relations: `liveChatSession?`, `messages: SupportMessage[]`, `assignedTo: AdminUser?`, `customer: Customer?`, `order: Order?`.
- `SupportMessage` — `id, ticketId (→SupportTicket, cascade), message, isInternal (Bool), senderType ("customer"|"admin"), senderId?, senderName, attachments? (JSON string), createdAt`.
- `LiveChatSession` — `id, sessionId (unique), ticketId (unique →SupportTicket), customerId?, adminId? (→AdminUser), status (ChatSessionStatus: WAITING|ACTIVE|CLOSED), requestedAt, acceptedAt?, closedAt?, customerName, customerEmail, waitTime?, duration?, preChatContext? (JSON), issueCategory?, issueSummary?, createdAt, updatedAt`. Relations: `messages: LiveChatMessage[]`, `admin?`, `customer?`, `ticket`.
- `LiveChatMessage` — `id, sessionId (→LiveChatSession, cascade), message, senderType, senderId?, senderName, isRead (Bool), readAt?, createdAt`.
- `AdminAvailability` — `id, adminId (unique →AdminUser, cascade), isOnline (Bool), status (String default "offline"), maxChats (Int default 3), activeChats (Int default 0), lastSeenAt?, createdAt, updatedAt`.
- Enums: `SupportTicketType = REFUND|RETURN|EXCHANGE|ORDER_ISSUE|PRODUCT_QUESTION|SHIPPING_ISSUE|PAYMENT_ISSUE|GENERAL`; `SupportTicketStatus = OPEN|IN_PROGRESS|WAITING_CUSTOMER|ESCALATED|RESOLVED|CLOSED`; `SupportPriority = LOW|MEDIUM|HIGH|URGENT`; `ChatSessionStatus = WAITING|ACTIVE|CLOSED`.
- Tangent (reused by return/refund inspector): `Return` (has `supportTicketId?` unique), `RefundRecord`.

**V1 routes (relocate verbatim to `*-v1`):**
- `app/admin/support/page.tsx` (413L, server) — dashboard home.
- `app/admin/support/tickets/page.tsx` (537L, client) — canonical ticket list + live-chat tab.
- `app/admin/support/tickets/[id]/page.tsx` (554L, client) — canonical ticket detail.

**Customer-facing / shared APIs (PRESERVE — do not delete):**
- `app/api/support/tickets/route.ts` (GET list, POST create), `app/api/support/tickets/[id]/route.ts` (GET, PATCH), `app/api/support/tickets/[id]/messages/route.ts` (GET, POST).
- `app/api/chat/live/request|queue|status/route.ts`, `app/api/chat/live/[sessionId]/route.ts` (polling).
- `lib/support/` helpers: `ticket-detection.ts`, `admin-ticket-filters.ts`, `refund-helpers.ts` (`checkRefundEligibility`, `processRefund`, `createReturnLabel`), `questionnaire-flows.ts`.

**Cross-link fix:** `components/admin/customers/detail/CustomerSupportTicketsPanel.tsx` currently links to `/admin/support/${t.id}` which 404s; repoint to `/admin/support/tickets/${t.id}`.

**Note on admin identity:** `SupportTicket.assignedToId` references `AdminUser.id`, but the session yields a `userId` (Customer.id). The dispatcher must resolve the current agent's `AdminUser` record (by the existing Customer↔AdminUser linkage) to drive the "Mine" tab and assignment defaults. The plan must confirm the exact linkage field during implementation (likely `AdminUser.customerId` or email match) and document it.

---

## 4. Schema migration (Wave 1, merge first)

Two additive changes, hand-authored SQL applied via `prisma db push --skip-generate` + `prisma migrate resolve --applied` + `prisma generate` (Phase 8 precedent; Neon shadow-DB rejects `migrate dev`):

1. **New model `CannedResponse`:**
   - `id String @id @default(cuid())`, `title String`, `body String`, `category String?`, `isActive Boolean @default(true)`, `createdById String`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `@@index([isActive])`, `@@index([category])`, `@@map("canned_responses")`.
2. **`SupportTicket.firstRespondedAt DateTime?`** + `@@index([firstRespondedAt])`. Set when the first **public** (non-internal) admin `SupportMessage` is created for a ticket. Enables avg-first-response KPI and overdue/SLA badges without scanning the message table.

No other schema changes.

---

## 5. Data layer — `lib/admin/support.ts`

Mirrors `lib/admin/customers.ts` structure. Defines `TimeRange` + `getRangeBounds` + `buildTrend` + `PaginatedResult` locally (do not import from sibling phase files).

**Constants:**
- `SUPPORT_TABS = ['inbox','mine','open','escalated','resolved'] as const`; `SupportTab` type + `isSupportTab` guard.
- SLA threshold constant: `FIRST_RESPONSE_SLA_HOURS` (default 4) and `RESOLUTION_SLA_HOURS` (default 48) — used for overdue badges. Hard-coded constants in v1 (configurable deferred to 9.5).

**Tab → where clause** (based on `status` / `assignedToId`):
- `inbox` → `status IN (OPEN) AND assignedToId = null` (new + unassigned).
- `mine` → `assignedToId = <currentAdminId>` AND `status NOT IN (RESOLVED, CLOSED)`.
- `open` → `status IN (OPEN, IN_PROGRESS, WAITING_CUSTOMER, ESCALATED)`.
- `escalated` → `status = ESCALATED`.
- `resolved` → `status IN (RESOLVED, CLOSED)` AND `resolvedAt` within range.

**KPI loader** `loadSupportKpis(range, currentAdminId)` → `{ openCount, avgFirstResponseHours (+trend), avgResolutionHours, resolvedInRange (+trend), unassignedCount }`. Uses `Promise.all` of counts/aggregates. Avg first response = avg(`firstRespondedAt - createdAt`) over tickets with a first response in range; avg resolution = avg(`resolvedAt - createdAt`) for resolved-in-range.

**Tab loader** `loadSupportTab(tab, range, filters, currentAdminId)` → `PaginatedResult<TicketRow>`. `TicketRow = { id, ticketNumber, subject, type, status, priority, customerName, customerEmail, assigneeId, assigneeName, createdAt, firstRespondedAt, ageHours, isOverdue }`. `filters`: `search` (subject/ticketNumber/customerEmail), `type?`, `priority?`, `page`, `pageSize` (25). `isOverdue` computed: no `firstRespondedAt` and `ageHours > FIRST_RESPONSE_SLA_HOURS` and status active.

**Detail loaders:**
- `loadTicketHeader(id)` → ticket core + customer/order link refs + assignee + age/SLA + return/refund status flags; null if missing.
- `loadTicketMessages(id)` → ordered `SupportMessage[]` (asc), mapped to a `TicketMessageRow` (id, body, isInternal, senderType, senderName, createdAt, attachments[]).
- `loadTicketCustomerContext(id)` → linked customer snapshot (LTV/tier/totalOrders), linked order summary, count of the customer's other tickets.
- `loadTicketReturnRefund(id)` → return/refund status for the inspector (returnRequested, returnApproved, returnLabel, refundAmount, linked `Return`/`RefundRecord` if any, eligibility via `checkRefundEligibility`).
- `loadCannedResponses(filter?)` → active canned responses for the picker; `loadAllCannedResponses()` for the manager.
- `loadAgentList()` → assignable `AdminUser`s (id, name, current open load) for assignment + per-agent KPI.
- `loadTicketActivity(id, limit)` → merged chronological events (status changes inferred from messages/fields, assignments, return/refund events). (Status-change history is approximate unless an audit source exists; the plan confirms whether `AdminAuditLog` covers tickets and uses it if so, else derives from message/field timestamps.)

**Live chat loaders:**
- `loadChatQueue()` → WAITING sessions (id, sessionId, customerName, issueCategory, issueSummary, waitTime, requestedAt).
- `loadChatSession(sessionId)` → session + messages.
- `loadAgentAvailability(currentAdminId)` → the agent's `AdminAvailability` row (isOnline, maxChats, activeChats).

---

## 6. Server actions — `app/admin/support/actions.ts`

All gate `requireAdmin()` unless noted. All `revalidatePath` the affected list + detail routes. Return `ActionResult = { ok: true; data? } | { ok: false; error: string }` (Phase 8 shape).

**Tickets:** `replyToTicket(ticketId, body, { isInternal })` (creates SupportMessage; if first public admin message, set `firstRespondedAt`; if ticket RESOLVED/CLOSED and sender is customer-visible reply, follow existing reopen behavior), `addInternalNote(ticketId, body)`, `setTicketStatus(ticketId, status)`, `assignTicket(ticketId, adminUserId | null)` (sets `assignedAt`), `escalateTicket(ticketId)`, `resolveTicket(ticketId, resolution)` (sets `resolvedAt`, `resolvedBy`), `closeTicket(ticketId)`.

**Bulk:** `bulkAssign(ticketIds, adminUserId)`, `bulkSetStatus(ticketIds, status)`, `bulkCloseTickets(ticketIds)` — **`bulkCloseTickets` gates `requireAdminRole('SUPER_ADMIN')`** (destructive en masse). Bulk ops use a single `batchId` per call.

**Return/refund** (reuse `lib/support/refund-helpers.ts`): `approveReturn(ticketId, { generateLabel })` (sets `returnApproved=true`, optional EasyPost label via `createReturnLabel`), `denyReturn(ticketId, reason)`, `issueRefund(ticketId, { amount, type, reason })` — **gates `requireAdminRole('SUPER_ADMIN')`** (money); calls `processRefund` (Stripe), writes `RefundRecord`, updates ticket. Idempotency key per refund to prevent double-charge.

**Canned responses:** `createCannedResponse({title, body, category})`, `updateCannedResponse(id, patch)`, `deleteCannedResponse(id)` (soft via `isActive=false`).

**Live chat:** `acceptChatSession(sessionId)` (sets ACTIVE, adminId, acceptedAt, increments availability.activeChats), `closeChatSession(sessionId)` (CLOSED, duration, decrement activeChats), `sendChatMessage(sessionId, body)` (writes LiveChatMessage from admin), `setAgentAvailability({ isOnline, maxChats })` (upserts `AdminAvailability`).

---

## 7. Live chat SSE transport

**New endpoint:** `GET /api/admin/support/chat/[sessionId]/stream` returns `Content-Type: text/event-stream`. Implementation:
- Auth-gate (admin) at connection.
- Server-side loop: every ~1.5s query `LiveChatMessage WHERE sessionId AND createdAt > cursor`, push each as an SSE `data:` event, advance cursor. Also emit periodic `:keepalive` comments.
- Cap stream lifetime (~50s, under serverless function limits), then close; the client `EventSource` auto-reconnects with a `Last-Event-ID` / cursor query param to resume.
- Rationale: serverless instances are stateless, so an in-memory pub/sub wouldn't see cross-instance writes; server-side DB polling is the lowest-infra correct approach and still removes the client-side 3s loop.

**Admin send path:** `sendChatMessage` server action (POST) — the new message arrives back to all connected admins via their SSE streams on the next poll tick.

**Fallback & customer side:** the existing `/api/chat/live/[sessionId]` polling route remains for the customer widget and as an admin fallback if `EventSource` is unavailable. `AdminChatPanelV2` uses SSE with a polling fallback.

---

## 8. Components (V2)

**List (`components/admin/support/` + `components/admin/dashboard/`):**
- `SupportTicketsListTable.tsx` (desktop sticky table: ticket#, subject, customer, type, status, priority, age/SLA badge, assignee; selection checkboxes).
- `SupportTicketsListCardMobile.tsx` (mobile cards; long-press multi-select, like Phase 8).
- `SupportBulkSheet.tsx` (bulk assign / set-status / close).
- `SupportTabPills.tsx`, `SupportRangePills.tsx` (client URL-sync wrappers).
- `SupportTicketsListClient.tsx` (owns `Set<string>` selection; glues table/cards/sheet).
- `AdminSupportTicketsV2.tsx` (server root: parse `tab`/`range`, KPI strip Suspense + list Suspense).
- `AdminSupportV2.tsx` (the `/admin/support` dashboard home root: KPI strip + live-chat queue summary + quick links to tickets).

**Detail (`components/admin/support/detail/`):**
- `TicketHeader.tsx`, `TicketMessageThread.tsx`, `TicketReplyComposer.tsx` (+ `CannedResponsePicker.tsx`), `TicketCustomerContext.tsx` (sidebar), `TicketReturnRefundPanel.tsx`, `TicketActivityTimeline.tsx`.
- `AdminTicketDetailV2.tsx` (server root: header + 2-column grid of Suspense widget slots, `notFound()` if header null).

**Inspectors (`components/admin/support/inspectors/`):**
- `AssignAgentInspector.tsx`, `StatusChangeInspector.tsx`, `ReturnDecisionInspector.tsx`, `RefundInspector.tsx`, `CannedResponseManagerInspector.tsx`.

**Live chat (`components/admin/support/chat/`):**
- `AdminChatQueueV2.tsx`, `AdminChatPanelV2.tsx` (SSE-driven, with `useSupportChatStream` hook), `AgentAvailabilityToggle.tsx`.

**Dispatchers + V1 relocation:**
- Relocate V1 → `components/admin/_v1/AdminSupportV1*.tsx`; re-expose at `app/admin/support-v1/page.tsx`, `app/admin/support-v1/tickets/page.tsx`, `app/admin/support-v1/tickets/[id]/page.tsx`.
- Replace `app/admin/support/page.tsx`, `app/admin/support/tickets/page.tsx`, `app/admin/support/tickets/[id]/page.tsx` with flag dispatchers (resolve `isSuperAdmin` + current `AdminUser` id).
- Fix `CustomerSupportTicketsPanel` cross-link.

---

## 9. Wave structure (for the implementation plan)

Grouped so each wave-group merges independently:

- **W1 — Schema:** CannedResponse + `firstRespondedAt` migration (sequential, merge first).
- **W2 — Data + actions:** `lib/admin/support.ts` + `app/admin/support/actions.ts` (2 parallel, after W1).
- **W3 — List components:** table, mobile card, bulk sheet, tab/range pills (parallel, after W2).
- **W4 — Detail widgets:** header, thread, customer-context, return/refund panel, activity timeline (parallel, after W2).
- **W5 — Inspectors:** assign, status, return-decision, refund, canned-response manager, canned picker (parallel, after W2).
- **W6 — Live chat + SSE:** SSE endpoint + stream hook, queue, panel, availability toggle (after W2; SSE endpoint first).
- **W7 — Composition + dispatchers:** list client + roots, detail root, V1 relocation, 3 dispatchers, cross-link fix (sequential, opus, after W3–W6).
- **W8 — QA:** verification + QA doc (sequential).

Interactive panels (reply composer, return/refund panel, detail header) that embed inspectors are sequenced **after** their inspectors merge (Phase 8 lesson).

---

## 10. Testing

Per-unit Vitest mirroring the Phase 8 harness:
- Data layer: tab where-clauses, KPI math (avg first-response/resolution, overdue), pagination.
- Server actions: auth gates (incl. SUPER_ADMIN on `issueRefund`/`bulkCloseTickets`), `firstRespondedAt` set-once, reopen-on-reply, refund idempotency, return label path (mock refund-helpers).
- Components: each renders against mocked loaders/actions; inspectors mocked in panels.
- SSE: unit-test the stream hook's event parsing + reconnect cursor logic with a mocked `EventSource`; unit-test the route's cursor query shaping (full streaming is integration-tested manually per the QA doc).
- Dispatchers: flag on/off → V2/V1; `isSuperAdmin` + current-agent resolution.

Final QA doc: list (tabs/KPIs/bulk/SLA badges), detail (thread/canned reply/assign/status/return-refund), live chat (SSE connect + reconnect + send, availability), V1 fallback, cross-links, regression risks, Phase 9.5 follow-ups.

---

## 11. Risks & mitigations

- **SSE on serverless:** function duration limits → cap stream + client auto-reconnect; DB-poll inside the stream avoids cross-instance invisibility. Mitigation documented in §7; polling fallback retained.
- **Admin identity mapping** (Customer.id session vs AdminUser.id assignment): plan must confirm the linkage field before W2; "Mine" tab + assignment depend on it.
- **Refund double-charge:** idempotency key on `issueRefund`; SUPER_ADMIN gate.
- **Preserving customer APIs:** Phase 9 adds actions/SSE alongside existing `/api/support/*` + `/api/chat/live/*`; deletions are forbidden — regression-test the customer widget paths exist.
- **Status-change history:** if no audit source exists for tickets, the activity timeline derives events from message/field timestamps (approximate) — flagged, not blocking.

---

## 12. Phase 9.5 follow-ups (deferred)

Configurable SLA thresholds; websocket/Redis real-time upgrade; customer-side SSE; saved ticket views/filters; ticket tagging; macro/automation rules; CSAT survey on resolve; per-agent performance dashboard; merge-duplicate-tickets; attachment upload pipeline hardening.
