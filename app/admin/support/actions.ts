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

// checkRefundEligibility is imported per the Shared Contracts; it is invoked
// transitively by initiateRefund. Referenced here to document the dependency.
void checkRefundEligibility

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
