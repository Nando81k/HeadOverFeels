import { prisma } from '@/lib/prisma'
import { MAX_CONVERSATION_MESSAGES } from './config'

/**
 * Memory System for Reggie AI
 * 
 * Handles full conversation persistence to the database.
 * Conversations are stored per customer/admin and can be resumed.
 */

export interface ConversationMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
  content: string
  toolCalls?: string | null
  toolResults?: string | null
  createdAt: Date
}

export interface ConversationSummary {
  id: string
  title: string | null
  messageCount: number
  lastMessage: string
  updatedAt: Date
}

/**
 * Create a new conversation for a customer
 */
export async function createCustomerConversation(
  customerId?: string,
  title?: string
): Promise<string> {
  const conversation = await prisma.aiConversation.create({
    data: {
      customerId,
      title: title || 'New conversation',
    },
  })
  
  return conversation.id
}

/**
 * Create a new conversation for an admin
 */
export async function createAdminConversation(
  adminId: string,
  title?: string
): Promise<string> {
  const conversation = await prisma.aiConversation.create({
    data: {
      adminId,
      title: title || 'New conversation',
    },
  })
  
  return conversation.id
}

/**
 * Load conversation history for context
 */
export async function loadConversationHistory(
  conversationId: string
): Promise<ConversationMessage[]> {
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: MAX_CONVERSATION_MESSAGES,
  })
  
  return messages.map(m => ({
    role: m.role as 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL',
    content: m.content,
    toolCalls: m.toolCalls,
    toolResults: m.toolResults,
    createdAt: m.createdAt,
  }))
}

/**
 * Save a user message to the conversation
 */
export async function saveUserMessage(
  conversationId: string,
  content: string
): Promise<void> {
  await prisma.aiMessage.create({
    data: {
      conversationId,
      role: 'USER',
      content,
    },
  })
  
  // Update conversation's updated timestamp
  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })
}

/**
 * Save an assistant message to the conversation
 */
export async function saveAssistantMessage(
  conversationId: string,
  content: string,
  toolCalls?: string,
  toolResults?: string
): Promise<void> {
  await prisma.aiMessage.create({
    data: {
      conversationId,
      role: 'ASSISTANT',
      content,
      toolCalls,
      toolResults,
    },
  })
  
  // Update conversation title if it's the first exchange
  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    include: { messages: { take: 3 } },
  })
  
  if (conversation && conversation.messages.length <= 2 && conversation.title === 'New conversation') {
    // Generate a title from the first user message
    const firstUserMessage = conversation.messages.find(m => m.role === 'USER')
    if (firstUserMessage) {
      const title = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      await prisma.aiConversation.update({
        where: { id: conversationId },
        data: { title },
      })
    }
  }
}

/**
 * Get customer's recent conversations
 */
export async function getCustomerConversations(
  customerId: string,
  limit: number = 10
): Promise<ConversationSummary[]> {
  const conversations = await prisma.aiConversation.findMany({
    where: { customerId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
  })
  
  return conversations.map(c => ({
    id: c.id,
    title: c.title,
    messageCount: c._count.messages,
    lastMessage: c.messages[0]?.content.slice(0, 100) || '',
    updatedAt: c.updatedAt,
  }))
}

/**
 * Get admin's recent conversations
 */
export async function getAdminConversations(
  adminId: string,
  limit: number = 10
): Promise<ConversationSummary[]> {
  const conversations = await prisma.aiConversation.findMany({
    where: { adminId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
  })
  
  return conversations.map(c => ({
    id: c.id,
    title: c.title,
    messageCount: c._count.messages,
    lastMessage: c.messages[0]?.content.slice(0, 100) || '',
    updatedAt: c.updatedAt,
  }))
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  // Delete messages first due to foreign key
  await prisma.aiMessage.deleteMany({
    where: { conversationId },
  })
  
  // Delete pending actions
  await prisma.aiPendingAction.deleteMany({
    where: { conversationId },
  })
  
  // Delete conversation
  await prisma.aiConversation.delete({
    where: { id: conversationId },
  })
}

/**
 * Get or create a conversation for a customer
 * Returns the most recent conversation if it's less than 24 hours old
 * Otherwise creates a new one
 */
export async function getOrCreateCustomerConversation(
  customerId?: string
): Promise<string> {
  if (customerId) {
    const recentConversation = await prisma.aiConversation.findFirst({
      where: {
        customerId,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    
    if (recentConversation) {
      return recentConversation.id
    }
  }
  
  return createCustomerConversation(customerId)
}

/**
 * Get or create a conversation for an admin
 * Always returns the most recent conversation from today
 */
export async function getOrCreateAdminConversation(
  adminId: string
): Promise<string> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const recentConversation = await prisma.aiConversation.findFirst({
    where: {
      adminId,
      createdAt: { gte: today },
    },
    orderBy: { updatedAt: 'desc' },
  })
  
  if (recentConversation) {
    return recentConversation.id
  }
  
  return createAdminConversation(adminId)
}

/**
 * Clean up old conversations (for cron job)
 */
export async function cleanupOldConversations(
  daysOld: number = 90
): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)
  
  // Get conversations to delete
  const oldConversations = await prisma.aiConversation.findMany({
    where: { updatedAt: { lt: cutoffDate } },
    select: { id: true },
  })
  
  const ids = oldConversations.map(c => c.id)
  
  if (ids.length === 0) return 0
  
  // Delete messages
  await prisma.aiMessage.deleteMany({
    where: { conversationId: { in: ids } },
  })
  
  // Delete pending actions
  await prisma.aiPendingAction.deleteMany({
    where: { conversationId: { in: ids } },
  })
  
  // Delete conversations
  const result = await prisma.aiConversation.deleteMany({
    where: { id: { in: ids } },
  })
  
  return result.count
}

/**
 * Get pending actions for a conversation
 */
export async function getPendingActions(conversationId: string) {
  return prisma.aiPendingAction.findMany({
    where: {
      conversationId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Expire old pending actions (for cron job)
 */
export async function expireOldPendingActions(): Promise<number> {
  const result = await prisma.aiPendingAction.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  })
  
  return result.count
}
