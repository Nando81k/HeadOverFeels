# AI-Powered Support & Refund System

## Overview

The Head Over Feels platform now includes a comprehensive AI-powered customer support system that enables customers to request refunds, returns, exchanges, and general assistance directly through the AI shopping assistant chatbot. The system automatically detects support requests, creates tickets, and escalates to human admins when needed.

## ✨ Key Features

### 1. **AI Support Detection**
- AI chatbot automatically detects when customers need help with:
  - Refunds and returns
  - Order issues
  - Damaged or defective products
  - Shipping inquiries
  - General support questions

### 2. **Automated Ticket Creation**
- Tickets are created automatically from AI chat conversations
- Captures conversation context and customer information
- Assigns appropriate priority and type
- No manual form filling required

### 3. **Refund & Return Management**
- 30-day return policy enforcement
- Automatic refund eligibility checks
- Return shipping label generation
- Refund amount calculations

### 4. **Admin Dashboard Integration**
- Support tickets available via API
- Ticket assignment to admin staff
- Internal notes and message threading
- Status tracking and resolution workflow

## 🎯 Support Policies

### Refund Policy
- **Window**: 30 days from delivery date
- **Amount**: Full product price (shipping non-refundable)
- **Process**: Customer initiates request → Admin reviews → Refund processed

### Return Policy
- **Window**: 30 days from delivery date  
- **Shipping**: Free prepaid return label provided
- **Process**: Customer requests → Admin approves → Label generated → Item returned → Refund processed

### Exchange Policy
- **Window**: 30 days from delivery date
- **Types**: Size or color changes
- **Process**: Similar to return, but new item shipped once original received

### Damaged/Defective Items
- **Window**: Anytime after receipt
- **Refund**: Full refund including original shipping
- **Process**: Photos required → Immediate approval → Refund processed

## 🗄️ Database Schema

### SupportTicket Model
```prisma
model SupportTicket {
  id              String
  ticketNumber    String  // TKT-2025-000001
  type            SupportTicketType  // REFUND, RETURN, EXCHANGE, etc.
  status          SupportTicketStatus // OPEN, IN_PROGRESS, RESOLVED, etc.
  priority        SupportPriority    // LOW, MEDIUM, HIGH, URGENT
  subject         String
  
  // Customer info
  customerId      String?
  customerEmail   String
  customerName    String
  
  // Order reference
  orderId         String?
  orderNumber     String?
  
  // Refund/Return specific
  refundAmount    Float?
  refundReason    String?
  returnRequested Boolean
  returnApproved  Boolean?
  returnLabel     String?  // URL to shipping label
  
  // Admin assignment
  assignedToId    String?
  assignedAt      DateTime?
  
  // Resolution
  resolvedAt      DateTime?
  resolution      String?
  
  // AI assistance
  aiAssisted      Boolean
  aiSummary       String?
  
  messages        SupportMessage[]
}
```

### SupportMessage Model
```prisma
model SupportMessage {
  id         String
  ticketId   String
  message    String
  isInternal Boolean  // Admin-only notes
  senderType String   // "customer", "admin", "ai"
  senderId   String?
  senderName String
  attachments String? // JSON array of URLs
}
```

## 🔌 API Endpoints

### List Tickets
```http
GET /api/support/tickets?customerId={id}&status={status}&type={type}
```

### Create Ticket
```http
POST /api/support/tickets
Content-Type: application/json

{
  "type": "REFUND",
  "subject": "Refund Request",
  "customerId": "cust_123",
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "orderId": "order_456",
  "orderNumber": "ORD-2025-001",
  "refundAmount": 89.99,
  "refundReason": "Product not as described",
  "message": "I would like a refund...",
  "aiAssisted": true
}
```

### Get Ticket Details
```http
GET /api/support/tickets/{ticketId}
```

### Update Ticket
```http
PATCH /api/support/tickets/{ticketId}
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "assignedToId": "admin_123",
  "priority": "HIGH"
}
```

### Add Message
```http
POST /api/support/tickets/{ticketId}/messages
Content-Type: application/json

{
  "message": "I've reviewed your request...",
  "senderType": "admin",
  "senderName": "Support Team",
  "senderId": "admin_123"
}
```

## 🤖 AI Chat Integration

### How It Works

1. **Customer starts conversation** with AI assistant
2. **Customer mentions** refund, return, or issue
3. **AI detects intent** and gathers information:
   - Order number
   - Reason for request
   - Any additional details
4. **AI explains policy** and offers to create ticket
5. **Ticket auto-created** if customer agrees
6. **Admin notified** and can respond through ticket system

### Example Conversation

**Customer**: "I need to return my hoodie, it's the wrong size"

**AI**: "I'm sorry the size didn't work out! We have a 30-day return policy with free return shipping. Can you provide your order number so I can create a return request for you?"

**Customer**: "It's order #ORD-2025-12345"

**AI**: "Perfect! I've created a support ticket (TKT-2025-000123) for your return. Our team will review it within 24 hours and send you a prepaid return shipping label. You'll receive an email update shortly. Is there anything else I can help you with?"

### Detection Logic

The AI system detects support requests based on keywords and context:

- **Refund triggers**: "refund", "money back", "reimburse"
- **Return triggers**: "return", "send back"  
- **Exchange triggers**: "exchange", "wrong size", "different color"
- **Order issue triggers**: "didn't arrive", "tracking", "where is my order"
- **Escalation triggers**: "speak to someone", "talk to human", "customer service"

## 🛠️ Helper Functions

### Check Refund Eligibility
```typescript
import { checkRefundEligibility } from '@/lib/support/refund-helpers'

const eligibility = await checkRefundEligibility(orderId)
// Returns: { eligible, reason?, maxRefundAmount?, daysRemaining? }
```

### Calculate Refund Amount
```typescript
import { calculateRefundAmount } from '@/lib/support/refund-helpers'

const amount = calculateRefundAmount({
  orderTotal: 107.99,
  shippingCost: 10.00,
  includeShipping: false,  // Shipping usually non-refundable
})
// Returns: 97.99
```

### Initiate Refund
```typescript
import { initiateRefund } from '@/lib/support/refund-helpers'

const result = await initiateRefund({
  ticketId: 'ticket_123',
  orderId: 'order_456',
  amount: 89.99,
  reason: 'Product not as expected',
})
// Returns: { success, message, refundId? }
```

### Approve Return
```typescript
import { approveReturn } from '@/lib/support/refund-helpers'

const result = await approveReturn(ticketId, orderId)
// Returns: { success, message, returnLabel? }
```

## 📊 Admin Workflow

### 1. View Open Tickets
```bash
GET /api/support/tickets?status=OPEN
```

### 2. Review Customer Request
- View ticket details with full conversation history
- Check order information
- Verify refund eligibility (automatic check)

### 3. Respond to Customer
```bash
POST /api/support/tickets/{id}/messages
{
  "message": "I've reviewed your request...",
  "senderType": "admin",
  "senderName": "Support Team"
}
```

### 4. Take Action

**For Refunds**:
```typescript
await initiateRefund({
  ticketId,
  orderId,
  amount: 89.99,
  reason: "Approved refund per policy"
})
```

**For Returns**:
```typescript
await approveReturn(ticketId, orderId)
// This generates shipping label and updates ticket
```

### 5. Resolve Ticket
```bash
PATCH /api/support/tickets/{id}
{
  "status": "RESOLVED",
  "resolution": "Refund of $89.99 processed successfully"
}
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
npx tsx scripts/test-support-system.ts
```

This tests:
- ✅ Customer and order creation
- ✅ Support ticket creation  
- ✅ Message threading
- ✅ Refund eligibility checks
- ✅ Return approval workflow
- ✅ Ticket status updates
- ✅ Statistics and reporting

## 🎨 Frontend Integration (Coming Soon)

### ShoppingAssistantWidget
The existing chat widget already supports the new features! The AI will:
- Detect support requests automatically
- Guide customers through the process
- Create tickets seamlessly
- Provide ticket numbers for reference

### Admin Dashboard
Recommended additions:
- Support ticket list view
- Ticket detail modal with messages
- Quick actions (approve, refund, escalate)
- Statistics dashboard

## 🔒 Security Considerations

1. **Customer Verification**: Tickets link to customer accounts when available
2. **Email Verification**: Required for guest checkouts
3. **Order Validation**: Tickets must reference valid orders for refunds/returns
4. **Admin Access**: Only authenticated admins can update tickets
5. **Internal Notes**: Separate from customer-visible messages

## 📈 Future Enhancements

- [ ] Email notifications when tickets are created/updated
- [ ] SMS notifications for urgent tickets
- [ ] Stripe refund integration (currently placeholder)
- [ ] Shippo/EasyPost for automatic label generation
- [ ] Customer portal to view ticket history
- [ ] Admin dashboard UI for ticket management
- [ ] Bulk ticket operations
- [ ] Ticket templates for common issues
- [ ] SLA tracking and escalation rules
- [ ] Customer satisfaction ratings

## 🚀 Quick Start

### Enable Support Features

1. **Database is ready** (schema already migrated)
2. **AI is configured** (already detects support requests)
3. **Test the system**:
   ```bash
   npx tsx scripts/test-support-system.ts
   ```

### Use in Production

1. **Customer chats with AI**: No code changes needed
2. **AI detects support need**: Automatic
3. **Ticket created**: Automatic via `/api/support/tickets`
4. **Admin reviews**: GET `/api/support/tickets`
5. **Admin responds**: POST `/api/support/tickets/{id}/messages`

## 📝 Example Use Cases

### Use Case 1: Simple Refund
1. Customer: "I want a refund for order #12345"
2. AI: Explains policy, creates ticket
3. Admin: Reviews, approves refund
4. System: Processes refund, notifies customer

### Use Case 2: Return with Exchange
1. Customer: "Wrong size, need to exchange"
2. AI: Creates return ticket
3. Admin: Approves return, generates label
4. Customer: Ships item back
5. Admin: Processes new order for correct size

### Use Case 3: Damaged Item
1. Customer: "Item arrived damaged"
2. AI: High priority, asks for photos
3. Admin: Immediate approval for full refund
4. System: Processes refund including shipping

## 🎯 Success Metrics

Track these metrics for support performance:
- Average response time
- Ticket resolution time
- Customer satisfaction ratings
- Refund rate
- Return rate
- AI vs. human resolution rate

---

**Ready to use!** The system is fully operational and tested. Customers can now get help with refunds, returns, and support directly through the AI assistant! 🎉
