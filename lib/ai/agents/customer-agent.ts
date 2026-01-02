import { genAI, GEMINI_MODEL, GENERATION_CONFIG } from '../config'
import { customerTools } from '../tools/customer-tools'
import { executeCustomerTool } from './customer-tool-executor'
import type { Content, Part, FunctionCall } from '@google/generative-ai'

/**
 * Reggie - Customer-Facing AI Shopping Assistant
 * Personality: New York streetwear expert, direct but friendly, knows his stuff
 */

export const CUSTOMER_SYSTEM_PROMPT = `You are Reggie, the AI shopping assistant for Head Over Feels, a premium streetwear e-commerce brand. You're a New Yorker through and through - direct, authentic, and always real with customers.

## Your Personality
- You're knowledgeable about streetwear, fashion trends, and the Head Over Feels brand
- You speak casually but professionally - think "cool older brother who works in fashion"
- You use light slang naturally (not forced): "bet", "gotchu", "no cap", "fire", "clean"
- You're helpful and patient, but you get to the point
- You show genuine enthusiasm for products you recommend
- You never pressure customers - you help them find what's right for them

## Your Capabilities
1. **Shopping Help**: Search products, find sizes, check stock, give recommendations
2. **Order Support**: Track orders, check delivery status, view order history
3. **Support Issues**: Create tickets for refunds, returns, exchanges, and other issues
4. **Loyalty Program**: Check points, explain tiers, show rewards, share referral codes
5. **Live Agent**: Connect customers to human support when needed

## Guidelines
- Always greet returning customers warmly if you know their name
- If a customer seems frustrated, acknowledge it and offer to help or escalate
- For support issues (refunds, returns), gather necessary info before creating tickets
- Be honest about stock availability and delivery times
- If you don't know something, say so and offer to find out or connect with support
- Keep responses concise but complete - don't ramble
- Use product cards/buttons when showing products (the UI will render them)
- NEVER make up order numbers, tracking info, or prices - always use the tools

## Response Format
- For product recommendations, describe briefly then use searchProducts tool
- For order questions, use getOrderStatus or getOrderHistory tools
- For support issues, gather info then use createSupportTicket tool
- Always offer next steps or ask if they need anything else
- If authentication is required (order history, loyalty), let them know they need to sign in

## Formatting Rules (IMPORTANT)
- NEVER use markdown asterisks (*) or bullet points in your responses
- When listing items (products, rewards, orders), use a clean numbered format or natural flowing sentences
- For lists, use this format:
  "1. Item Name - Description (details)"
  "2. Another Item - Description (details)"
- Or describe items conversationally: "You've got a few options: the first is..."
- Keep it readable and organized, but make it feel like a real conversation, not a formatted document
- Use line breaks between items for clarity, but no special characters for bullets

## Examples of Your Voice
- "Yo, what's good! Looking for something specific or just browsing?"
- "Bet, let me pull that up for you real quick."
- "That hoodie is fire - super comfortable and the fit is clean."
- "No cap, that's one of our best sellers. People love it."
- "I gotchu - let me check the stock on that size."
- "Aight, I see the issue. Let me create a ticket for you."
- "My bad, I can't access order history without you being signed in."

Remember: You're here to help customers have a great shopping experience. Be genuine, be helpful, be Reggie.`

interface CustomerAgentOptions {
  customerId?: string
  customerName?: string
  customerEmail?: string
  conversationHistory: Content[]
  message: string
}

interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_result' | 'error' | 'done'
  content?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  toolResult?: unknown
}

/**
 * Process a customer message and stream the response
 */
export async function* streamCustomerResponse(
  options: CustomerAgentOptions
): AsyncGenerator<StreamChunk> {
  if (!genAI) {
    yield { type: 'error', content: 'AI service is not configured' }
    return
  }

  const { customerId, customerName, customerEmail, conversationHistory, message } = options

  // Build context-aware system prompt
  let contextualPrompt = CUSTOMER_SYSTEM_PROMPT
  if (customerName) {
    contextualPrompt += `\n\n## Current Customer\nName: ${customerName}\nEmail: ${customerEmail || 'Not provided'}\nCustomer ID: ${customerId || 'Guest'}`
  }

  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: GENERATION_CONFIG,
      tools: [{ functionDeclarations: customerTools }],
      systemInstruction: contextualPrompt,
    })

    // Build messages array
    const contents: Content[] = [
      ...conversationHistory,
      { role: 'user', parts: [{ text: message }] },
    ]

    // Start chat with streaming
    const chat = model.startChat({ history: contents.slice(0, -1) })
    const result = await chat.sendMessageStream(message)

    let fullResponse = ''
    let functionCalls: FunctionCall[] = []

    // Stream the response
    for await (const chunk of result.stream) {
      const candidate = chunk.candidates?.[0]
      if (!candidate) continue

      for (const part of candidate.content?.parts || []) {
        if ('text' in part && part.text) {
          fullResponse += part.text
          yield { type: 'text', content: part.text }
        }
        if ('functionCall' in part && part.functionCall) {
          functionCalls.push(part.functionCall)
        }
      }
    }

    // Process function calls if any
    if (functionCalls.length > 0) {
      for (const functionCall of functionCalls) {
        yield { 
          type: 'tool_start', 
          toolName: functionCall.name, 
          toolArgs: functionCall.args as Record<string, unknown>
        }

        // Execute the tool
        const toolResult = await executeCustomerTool(
          functionCall.name,
          functionCall.args as Record<string, unknown>,
          { customerId, customerEmail }
        )

        yield { 
          type: 'tool_result', 
          toolName: functionCall.name, 
          toolResult 
        }

        // Send tool result back to get final response
        const functionResponse = await chat.sendMessageStream([
          {
            functionResponse: {
              name: functionCall.name,
              response: toolResult,
            },
          } as Part,
        ])

        for await (const chunk of functionResponse.stream) {
          const candidate = chunk.candidates?.[0]
          if (!candidate) continue

          for (const part of candidate.content?.parts || []) {
            if ('text' in part && part.text) {
              fullResponse += part.text
              yield { type: 'text', content: part.text }
            }
          }
        }
      }
    }

    yield { type: 'done' }
  } catch (error) {
    console.error('Customer agent error:', error)
    
    // Handle specific error types with user-friendly messages
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    let userFriendlyMessage = errorMessage
    
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
      userFriendlyMessage = "Yo, I'm getting a lot of questions right now! Give me like 30 seconds and try again. 🙏"
    } else if (errorMessage.includes('API key') || errorMessage.includes('401')) {
      userFriendlyMessage = "My bad, there's a technical issue on my end. The team's been notified!"
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      userFriendlyMessage = "Looks like we're having connection issues. Check your internet and try again?"
    }
    
    yield { 
      type: 'error', 
      content: userFriendlyMessage
    }
  }
}

/**
 * Non-streaming version for testing or simple use cases
 */
export async function getCustomerResponse(options: CustomerAgentOptions): Promise<string> {
  let response = ''
  for await (const chunk of streamCustomerResponse(options)) {
    if (chunk.type === 'text' && chunk.content) {
      response += chunk.content
    }
    if (chunk.type === 'error') {
      throw new Error(chunk.content)
    }
  }
  return response
}
