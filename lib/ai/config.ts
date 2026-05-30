import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini client
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.warn('GEMINI_API_KEY not set - AI features will be disabled')
}

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

// Helper function to get the Gemini client
export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not configured - AI features are disabled')
  }
  return genAI
}

// Model configuration
export const GEMINI_MODEL = 'gemini-2.5-flash' // Latest flash model with function calling
export const GEMINI_FLASH = 'gemini-2.0-flash' // Fallback

// Generation settings optimized for chat
export const GENERATION_CONFIG = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 2048,
}

// Safety settings - relaxed for e-commerce context
export const SAFETY_SETTINGS = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_ONLY_HIGH',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_ONLY_HIGH',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_ONLY_HIGH',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_ONLY_HIGH',
  },
]

// Context window limits
export const MAX_CONVERSATION_MESSAGES = 50
export const MAX_CONTEXT_TOKENS = 30000

// Rate limiting — per-role chat limits (legacy shape kept for reference)
export const RATE_LIMITS = {
  customer: {
    messagesPerMinute: 20,
    messagesPerHour: 100,
  },
  admin: {
    messagesPerMinute: 50,
    messagesPerHour: 500,
  },
}

// Per-route AI rate limits enforced at the API layer
export const AI_RATE_LIMITS = {
  // Public product review summary (IP-keyed)
  reviewSummary: {
    perMinute: 5,
    perDay: 50,
  },
  // Customer Reggie AI chat (user-ID or IP keyed)
  customerChat: {
    perMinute: 20,
    perDay: 200,
  },
  // Admin Reggie AI chat (admin-ID keyed)
  adminChat: {
    perMinute: 50,
    perDay: 500,
  },
}

// Pending action expiry (5 minutes)
export const PENDING_ACTION_EXPIRY_MS = 5 * 60 * 1000
