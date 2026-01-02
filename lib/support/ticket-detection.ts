/**
 * Support ticket detection and creation from AI chat
 */

interface SupportTicketData {
  type: 'REFUND' | 'RETURN' | 'EXCHANGE' | 'ORDER_ISSUE' | 'PRODUCT_QUESTION' | 'GENERAL'
  subject: string
  orderNumber?: string
  reason?: string
  refundAmount?: number
}

/**
 * Detect if AI response indicates need for support ticket
 */
export function detectSupportTicketIntent(aiResponse: string): {
  needsTicket: boolean
  ticketType?: SupportTicketData['type']
  confidence: number
} {
  const lowerResponse = aiResponse.toLowerCase()

  // High confidence patterns
  const highConfidencePatterns = {
    REFUND: /create.*support ticket.*refund|initiate.*refund|process.*refund/i,
    RETURN: /create.*support ticket.*return|approve.*return|generate.*return label/i,
    EXCHANGE: /create.*support ticket.*exchange|process.*exchange/i,
    ORDER_ISSUE: /create.*support ticket.*order|investigate.*order|track.*order/i,
  }

  // Check high confidence patterns first
  for (const [type, pattern] of Object.entries(highConfidencePatterns)) {
    if (pattern.test(aiResponse)) {
      return {
        needsTicket: true,
        ticketType: type as SupportTicketData['type'],
        confidence: 0.9,
      }
    }
  }

  // Medium confidence - AI mentions ticket creation
  if (/create.*ticket|submit.*request|escalate|speak.*admin|contact.*support/i.test(lowerResponse)) {
    // Try to determine type from context
    if (/refund|money back/i.test(lowerResponse)) {
      return { needsTicket: true, ticketType: 'REFUND', confidence: 0.7 }
    }
    if (/return|send back/i.test(lowerResponse)) {
      return { needsTicket: true, ticketType: 'RETURN', confidence: 0.7 }
    }
    if (/exchange|wrong size|different color/i.test(lowerResponse)) {
      return { needsTicket: true, ticketType: 'EXCHANGE', confidence: 0.7 }
    }
    if (/order|tracking|delivery|shipping/i.test(lowerResponse)) {
      return { needsTicket: true, ticketType: 'ORDER_ISSUE', confidence: 0.7 }
    }
    
    return { needsTicket: true, ticketType: 'GENERAL', confidence: 0.6 }
  }

  return { needsTicket: false, confidence: 0 }
}

/**
 * Extract ticket information from conversation
 */
export function extractTicketData(
  messages: Array<{ role: string; content: string }>,
  customerId?: string,
  customerEmail?: string,
  customerName?: string
): Partial<SupportTicketData> & {
  customerEmail?: string
  customerName?: string
  customerId?: string
  message?: string
} {
  const conversationText = messages
    .map(m => m.content)
    .join(' ')
    .toLowerCase()

  const data: {
    customerId?: string
    customerEmail?: string
    customerName?: string
    orderNumber?: string
    type?: SupportTicketData['type']
    subject?: string
    reason?: string
    message?: string
  } = {
    customerId,
    customerEmail,
    customerName,
  }

  // Extract order number
  const orderMatch = conversationText.match(/#?(\d{6,})|order[:\s]+#?(\d{6,})/i)
  if (orderMatch) {
    data.orderNumber = orderMatch[1] || orderMatch[2]
  }

  // Determine ticket type
  if (/refund|money back|reimburse/i.test(conversationText)) {
    data.type = 'REFUND'
    data.subject = 'Refund Request'
  } else if (/return|send back|send it back/i.test(conversationText)) {
    data.type = 'RETURN'
    data.subject = 'Return Request'
  } else if (/exchange|wrong size|different color|swap/i.test(conversationText)) {
    data.type = 'EXCHANGE'
    data.subject = 'Exchange Request'
  } else if (/damaged|defective|broken|wrong item|didn't receive/i.test(conversationText)) {
    data.type = 'ORDER_ISSUE'
    data.subject = 'Order Issue'
  } else if (/track|shipping|delivery|where.*order/i.test(conversationText)) {
    data.type = 'ORDER_ISSUE'
    data.subject = 'Shipping Inquiry'
  } else {
    data.type = 'GENERAL'
    data.subject = 'Customer Support Request'
  }

  // Extract reason from last user message
  const lastUserMessage = messages
    .filter(m => m.role === 'user')
    .pop()
  
  if (lastUserMessage) {
    data.reason = lastUserMessage.content
  }

  // Build comprehensive message
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
  
  data.message = `Customer inquiry via AI assistant:

${userMessages.join('\n\n')}

---
AI-Assisted Support Request
Type: ${data.type}
${data.orderNumber ? `Order: #${data.orderNumber}` : 'No order number provided yet'}`

  return data
}

/**
 * Create support ticket from AI chat conversation
 */
export async function createTicketFromChat(
  messages: Array<{ role: string; content: string }>,
  customerId?: string,
  customerEmail?: string,
  customerName?: string
): Promise<{ success: boolean; ticketNumber?: string; error?: string }> {
  try {
    const ticketData = extractTicketData(messages, customerId, customerEmail, customerName)

    // Validate required fields
    if (!ticketData.customerEmail || !ticketData.customerName) {
      return {
        success: false,
        error: 'Customer email and name are required. Please provide this information.',
      }
    }

    // Create ticket via API
    const response = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...ticketData,
        aiAssisted: true,
        aiSummary: `Ticket created from AI chat conversation. Customer requested ${ticketData.type?.toLowerCase() || 'support'}.`,
      }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create support ticket',
      }
    }

    return {
      success: true,
      ticketNumber: result.data.ticketNumber,
    }
  } catch (error) {
    console.error('Error creating ticket from chat:', error)
    return {
      success: false,
      error: 'Unable to create support ticket. Please try again.',
    }
  }
}
