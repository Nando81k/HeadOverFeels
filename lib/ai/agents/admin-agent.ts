import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiClient, GEMINI_MODEL, GENERATION_CONFIG } from '../config'
import { adminTools, toolRequiresConfirmation, getConfirmationTemplate, type AdminToolConfig } from '../tools/admin-tools'
import { executeAdminTool } from './admin-tool-executor'
import { prisma } from '@/lib/prisma'

/**
 * Admin-facing Reggie Agent
 * 
 * Context-aware assistant that understands which admin page the user is on
 * and can perform actions requiring confirmation for destructive operations.
 */

// Admin context passed with each request
export interface AdminContext {
  adminId: string
  adminName: string
  adminEmail: string
  currentPage: string        // e.g., '/admin/fulfillment', '/admin/customers'
  pageContext?: {            // Additional context from the current page
    orderId?: string
    customerId?: string
    ticketId?: string
    productId?: string
    filters?: Record<string, unknown>
    selectedItems?: string[]
  }
}

// Stream chunk types for admin responses
export interface AdminStreamChunk {
  type: 'text' | 'tool_start' | 'tool_result' | 'confirmation_required' | 'error' | 'done'
  content?: string
  toolName?: string
  toolResult?: unknown
  pendingAction?: {
    id: string
    actionType: string
    description: string
    payload: unknown
    expiresAt: Date
  }
  error?: string
}

// System prompt for admin Reggie
const ADMIN_SYSTEM_PROMPT = `You are Reggie, the AI assistant for Head Over Feels admin team.

## Your Role
You help admin staff manage the streetwear e-commerce platform efficiently. You can:
- Look up orders, customers, and tickets
- Help with analytics and inventory
- Process refunds and update statuses (with confirmation)
- Draft customer emails and responses
- Provide insights and summaries

## Personality
- Professional but friendly
- Efficient and action-oriented
- Proactive in suggesting related actions
- Confirm before any destructive action

## Current Context
You're assisting an admin user. Pay attention to their current page context:
- If they're on the Orders page, prioritize order-related tools
- If they're on Customers, focus on customer management
- If they're on Support, help with tickets
- Always offer to take the next logical action

## Important Rules
1. **DESTRUCTIVE ACTIONS REQUIRE CONFIRMATION**: Before processing refunds, updating order status, adjusting inventory, or sending emails, you MUST request confirmation
2. Use the admin's name when appropriate
3. Provide quick summaries - admins are busy
4. Suggest bulk actions when viewing lists
5. Flag urgent items (low stock, overdue tickets, etc.)

## Response Format
- Be concise but complete
- Use bullet points for lists
- Highlight important numbers/statuses
- Always offer a next action

## Example Interactions
Admin: "What's the deal with order #1234?"
Reggie: "Let me pull that up for you..."
[Uses getOrderDetails]
"Order #1234:
• Status: Processing
• Customer: John D. (Gold tier, 12 orders)
• Total: $156.00
• Items: 2x Street Hoodie (M, Black), 1x Cap
• Note: Customer requested gift wrap

Want me to update the status or send tracking info?"

Admin: "Refund order #5678"
Reggie: "I can process that refund for you.

⚠️ Confirmation Required:
• Order: #5678
• Customer: Sarah M.
• Refund Amount: $89.00
• Reason: [Please specify]

Reply 'confirm' to proceed or 'cancel' to abort."
`

// Build context-aware system prompt
function buildAdminPrompt(context: AdminContext): string {
  let prompt = ADMIN_SYSTEM_PROMPT
  
  prompt += `\n\n## Current Session Info
- Admin: ${context.adminName}
- Current Page: ${context.currentPage}`
  
  if (context.pageContext) {
    prompt += '\n- Page Context:'
    if (context.pageContext.orderId) prompt += `\n  • Viewing Order: ${context.pageContext.orderId}`
    if (context.pageContext.customerId) prompt += `\n  • Viewing Customer: ${context.pageContext.customerId}`
    if (context.pageContext.ticketId) prompt += `\n  • Viewing Ticket: ${context.pageContext.ticketId}`
    if (context.pageContext.productId) prompt += `\n  • Viewing Product: ${context.pageContext.productId}`
    if (context.pageContext.selectedItems?.length) {
      prompt += `\n  • Selected Items: ${context.pageContext.selectedItems.length} items`
    }
  }
  
  return prompt
}

// Get tools relevant to the current page
function getRelevantTools(currentPage: string): AdminToolConfig[] {
  const allTools = Object.values(adminTools)
  
  // Page-specific tool prioritization
  const pageToolMap: Record<string, string[]> = {
    '/admin/fulfillment': ['getOrderDetails', 'listOrders', 'updateOrderStatus', 'processRefund'],
    '/admin/customers': ['getCustomerProfile', 'listCustomers', 'adjustLoyaltyPoints', 'addCustomerNote'],
    '/admin/support': ['listTickets', 'getTicketDetails', 'updateTicketStatus', 'assignTicket', 'sendTicketResponse', 'suggestTicketResponse'],
    '/admin/analytics': ['getDailySummary', 'getRevenueAnalytics', 'getTopProducts'],
    '/admin/inventory': ['getLowStockAlerts', 'updateInventory'],
    '/admin/products': ['getLowStockAlerts', 'updateInventory'],
    '/admin': ['getDailySummary', 'getLowStockAlerts', 'listTickets'], // Dashboard
  }
  
  // Find matching page pattern
  const matchedPage = Object.keys(pageToolMap).find(p => 
    currentPage === p || currentPage.startsWith(p + '/')
  ) || '/admin'
  
  const priorityTools = pageToolMap[matchedPage] || []
  
  // Return all tools but put priority tools first
  return [
    ...allTools.filter(t => priorityTools.includes(t.declaration.name!)),
    ...allTools.filter(t => !priorityTools.includes(t.declaration.name!)),
  ]
}

/**
 * Stream admin response with tool execution and confirmation handling
 */
export async function* streamAdminResponse(
  message: string,
  conversationId: string,
  context: AdminContext
): AsyncGenerator<AdminStreamChunk> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: buildAdminPrompt(context),
  })
  
  // Get relevant tools for current page
  const relevantTools = getRelevantTools(context.currentPage)
  const toolDeclarations = relevantTools.map(t => t.declaration)
  
  // Load conversation history
  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
    },
  })
  
  // Build chat history
  const history = conversation?.messages.map(msg => ({
    role: msg.role === 'USER' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  })) || []
  
  try {
    // Start chat with history
    const chat = model.startChat({
      history: history as { role: 'user' | 'model'; parts: { text: string }[] }[],
      tools: [{ functionDeclarations: toolDeclarations }],
      generationConfig: GENERATION_CONFIG,
    })
    
    // Send message and stream response
    const result = await chat.sendMessageStream(message)
    
    let fullResponse = ''
    const pendingFunctionCalls: { name: string; args: Record<string, unknown> }[] = []
    
    for await (const chunk of result.stream) {
      const candidate = chunk.candidates?.[0]
      if (!candidate) continue
      
      for (const part of candidate.content.parts) {
        if (part.text) {
          fullResponse += part.text
          yield { type: 'text', content: part.text }
        }
        
        if (part.functionCall) {
          pendingFunctionCalls.push({
            name: part.functionCall.name,
            args: part.functionCall.args as Record<string, unknown>,
          })
        }
      }
    }
    
    // Process function calls
    for (const fc of pendingFunctionCalls) {
      yield { type: 'tool_start', toolName: fc.name }
      
      // Check if this tool requires confirmation
      if (toolRequiresConfirmation(fc.name)) {
        // Create pending action instead of executing
        const template = getConfirmationTemplate(fc.name)
        
        const pendingAction = await prisma.aiPendingAction.create({
          data: {
            conversationId,
            actionType: fc.name,
            actionPayload: JSON.stringify(fc.args),
            description: template || `Execute ${fc.name}`,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          },
        })
        
        const description = template || `Execute ${fc.name}`
        
        yield {
          type: 'confirmation_required',
          pendingAction: {
            id: pendingAction.id,
            actionType: fc.name,
            description,
            payload: fc.args,
            expiresAt: pendingAction.expiresAt,
          },
        }
        
        // Add assistant's confirmation request to the response
        fullResponse += `\n\n⚠️ **Confirmation Required**\n${description}`
      } else {
        // Execute non-destructive tool immediately
        try {
          const toolResult = await executeAdminTool(fc.name, fc.args, context)
          yield { type: 'tool_result', toolName: fc.name, toolResult }
          
          // Continue conversation with tool result
          const followUp = await chat.sendMessageStream([
            {
              functionResponse: {
                name: fc.name,
                response: toolResult as object,
              },
            },
          ])
          
          for await (const chunk of followUp.stream) {
            const text = chunk.candidates?.[0]?.content.parts
              .filter(p => p.text)
              .map(p => p.text)
              .join('')
            
            if (text) {
              fullResponse += text
              yield { type: 'text', content: text }
            }
          }
        } catch (error) {
          yield { 
            type: 'error', 
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }
        }
      }
    }
    
    // Save assistant message
    await prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: fullResponse,
        toolCalls: pendingFunctionCalls.length > 0 
          ? JSON.stringify(pendingFunctionCalls) 
          : null,
      },
    })
    
    yield { type: 'done' }
    
  } catch (error) {
    console.error('Admin agent error:', error)
    yield { 
      type: 'error', 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }
  }
}

/**
 * Execute a confirmed pending action
 */
export async function executeConfirmedAction(
  pendingActionId: string,
  context: AdminContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const pendingAction = await prisma.aiPendingAction.findUnique({
    where: { id: pendingActionId },
  })
  
  if (!pendingAction) {
    return { success: false, error: 'Pending action not found' }
  }
  
  if (pendingAction.status !== 'PENDING') {
    return { success: false, error: `Action already ${pendingAction.status.toLowerCase()}` }
  }
  
  if (pendingAction.expiresAt < new Date()) {
    await prisma.aiPendingAction.update({
      where: { id: pendingActionId },
      data: { status: 'EXPIRED' },
    })
    return { success: false, error: 'Action has expired' }
  }
  
  try {
    const args = JSON.parse(pendingAction.actionPayload)
    const result = await executeAdminTool(pendingAction.actionType, args, context)
    
    await prisma.aiPendingAction.update({
      where: { id: pendingActionId },
      data: { 
        status: 'EXECUTED',
        executedAt: new Date(),
      },
    })
    
    return { success: true, result }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Execution failed' 
    }
  }
}

/**
 * Reject a pending action
 */
export async function rejectPendingAction(
  pendingActionId: string
): Promise<{ success: boolean }> {
  await prisma.aiPendingAction.update({
    where: { id: pendingActionId },
    data: { status: 'REJECTED' },
  })
  
  return { success: true }
}
