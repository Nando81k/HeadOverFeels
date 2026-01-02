# Reggie AI Rebuild - Complete ✅

## Overview
Reggie AI has been rebuilt as a fully agentic shopping assistant with two versions:
- **Customer Reggie**: Floating widget on shop pages for customer assistance
- **Admin Reggie**: Context-aware assistant in admin panel for operations

## Architecture

### Backend Components

#### API Endpoints
```
POST /api/ai/chat              - Customer chat with streaming
POST /api/ai/admin/chat        - Admin chat with streaming  
POST /api/ai/admin/confirm     - Confirm/reject pending admin actions
```

#### Core Agents
- `lib/ai/agents/customer-agent.ts` - Customer-facing with 14 tools
- `lib/ai/agents/admin-agent.ts` - Admin-facing with 16 tools + confirmation gates
- `lib/ai/agents/customer-tool-executor.ts` - Executes customer tools
- `lib/ai/agents/admin-tool-executor.ts` - Executes admin tools

#### Memory System
- `lib/ai/memory.ts` - Full conversation persistence
- Database models: `AiConversation`, `AiMessage`, `AiPendingAction`

#### Tool Definitions
- `lib/ai/tools/customer-tools.ts` - Product search, orders, support, loyalty
- `lib/ai/tools/admin-tools.ts` - Orders, tickets, customers, analytics

### Frontend Components
- `components/ai/ReggieWidget.tsx` - Customer chat widget
- `components/ai/ReggieProvider.tsx` - Conditional rendering logic
- `components/admin/AdminReggie.tsx` - Admin assistant with confirmations

## Customer Tools (14)

### Shopping
- `searchProducts` - Search products by query, category, price
- `getProductDetails` - Get full product info including variants
- `getRecommendations` - Personalized/similar/trending products
- `getLimitedDrops` - View limited edition drops

### Orders & Cart
- `getOrderStatus` - Track order by number + email
- `getOrderHistory` - View customer's past orders
- `getCart` - Get current cart contents
- `applyCoupon` - Apply reward redemption codes

### Support
- `createSupportTicket` - Create new support ticket
- `getTicketStatus` - Check ticket progress
- `requestLiveAgent` - Request human support

### Loyalty
- `getLoyaltyStatus` - Points, tier, progress
- `getAvailableRewards` - Browse redeemable rewards
- `getReferralCode` - Get/create referral code

## Admin Tools (16)

### Order Management
- `getOrderDetails` - Full order info
- `listOrders` - Filter/search orders
- `updateOrderStatus` ⚠️ - Change status (requires confirmation)
- `processRefund` ⚠️ - Issue refunds (requires confirmation)

### Support Tickets
- `getTicketDetails` - Full ticket info
- `listTickets` - Filter tickets
- `updateTicketStatus` ⚠️ - Change status (requires confirmation)
- `addTicketResponse` - Reply to tickets
- `assignTicket` ⚠️ - Assign to admin (requires confirmation)

### Customer Management
- `getCustomerProfile` - Full customer info
- `listCustomers` - Search/filter customers
- `addCustomerNote` - Add internal notes
- `adjustLoyaltyPoints` ⚠️ - Modify points (requires confirmation)

### Analytics
- `getDashboardMetrics` - Overview stats
- `getProductPerformance` - Product analytics

### AI Assistance
- `draftCustomerEmail` - AI-generated emails

⚠️ = Requires admin confirmation before executing

## Confirmation Gate System

Destructive actions require explicit admin approval:

1. AI detects action requires confirmation
2. Pending action saved to `AiPendingAction` table
3. UI shows confirm/reject buttons
4. Admin clicks confirm → action executes
5. Admin clicks reject → action cancelled

```typescript
// Actions requiring confirmation
- updateOrderStatus
- processRefund
- updateTicketStatus
- assignTicket
- adjustLoyaltyPoints
```

## Streaming Response Format

All responses use Server-Sent Events (SSE):

```typescript
interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_result' | 'confirmation_required' | 'error' | 'done'
  content?: string           // Text content
  toolName?: string          // Tool being called
  toolResult?: unknown       // Tool execution result
  pendingAction?: {          // Action awaiting confirmation
    id: string
    actionType: string
    description: string
    payload: unknown
    expiresAt: Date
  }
  error?: string
}
```

## Database Schema

```prisma
model AiConversation {
  id          String   @id @default(cuid())
  customerId  String?
  adminId     String?
  title       String?
  context     String?  // JSON context
  messages    AiMessage[]
  pendingActions AiPendingAction[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AiMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // 'user' | 'assistant' | 'system'
  content        String
  toolCalls      String?  // JSON
  toolResults    String?  // JSON
  createdAt      DateTime @default(now())
}

model AiPendingAction {
  id             String   @id @default(cuid())
  conversationId String
  actionType     String
  description    String
  actionPayload  String   // JSON
  status         String   @default("pending")
  expiresAt      DateTime
  createdAt      DateTime @default(now())
}
```

## Configuration

Required environment variable:
```bash
GEMINI_API_KEY=your_key_here
```

Get a free key from: https://aistudio.google.com/app/apikey

## Testing

### Customer Widget
1. Navigate to any shop page (e.g., `/products`)
2. Click the "Ask Reggie" button in bottom-right
3. Try: "Show me the latest drops" or "Track my order"

### Admin Assistant
1. Navigate to `/admin` dashboard
2. Click the "Reggie AI" button in bottom-right
3. Try: "Show me pending orders" or "What needs attention today?"
4. For actions requiring confirmation, click Confirm/Reject

## Tech Stack
- **Model**: Google Gemini 2.0 Flash (gemini-2.0-flash-exp)
- **Streaming**: AsyncGenerator with SSE
- **State**: Full persistence via Prisma/SQLite
- **UI**: React components with Framer Motion animations
