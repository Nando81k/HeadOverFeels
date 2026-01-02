# Live Admin Chat Architecture

## Overview
Enable real-time chat between customers and admin support agents through the Reggie AI interface. When a support ticket is created, customers can opt to connect with a live admin for immediate assistance.

## System Architecture

### Technology Stack
- **Real-time Communication**: Socket.IO (WebSocket-based)
- **Backend**: Next.js API Routes + Socket.IO Server
- **Database**: PostgreSQL/SQLite with Prisma ORM
- **Frontend**: React with Socket.IO Client
- **State Management**: Zustand for chat state

### High-Level Flow
```
1. Customer creates ticket via Reggie AI → Ticket created (status: OPEN)
2. Customer sees "Connect to Live Admin" button
3. Customer clicks → LiveChatSession created (status: WAITING)
4. Admin receives notification (WebSocket broadcast + UI alert)
5. Admin accepts chat → Session status: ACTIVE
6. Real-time messaging via Socket.IO
7. Admin closes/resolves → Session status: CLOSED, Ticket status: RESOLVED
```

## Database Schema

### New Models

#### LiveChatSession
```prisma
model LiveChatSession {
  id              String              @id @default(cuid())
  sessionId       String              @unique // Socket room identifier
  
  // Relations
  ticketId        String              @unique
  ticket          SupportTicket       @relation(fields: [ticketId], references: [id])
  
  customerId      String?
  customer        Customer?           @relation(fields: [customerId], references: [id])
  
  adminId         String?
  admin           AdminUser?          @relation(fields: [adminId], references: [id])
  
  // Status tracking
  status          ChatSessionStatus   @default(WAITING) // WAITING, ACTIVE, CLOSED
  
  // Timestamps
  requestedAt     DateTime            @default(now())
  acceptedAt      DateTime?           // When admin joined
  closedAt        DateTime?
  
  // Metadata
  customerName    String
  customerEmail   String
  waitTime        Int?                // Seconds waited before admin joined
  duration        Int?                // Total chat duration in seconds
  
  messages        LiveChatMessage[]
  
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  
  @@index([status])
  @@index([adminId])
  @@index([requestedAt])
  @@map("live_chat_sessions")
}

enum ChatSessionStatus {
  WAITING   // Customer waiting for admin
  ACTIVE    // Admin connected, chat in progress
  CLOSED    // Session ended
}
```

#### LiveChatMessage
```prisma
model LiveChatMessage {
  id              String            @id @default(cuid())
  
  sessionId       String
  session         LiveChatSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  // Message details
  message         String
  senderType      String            // 'customer' | 'admin' | 'system'
  senderId        String?           // Customer or Admin ID
  senderName      String
  
  // Read receipts
  isRead          Boolean           @default(false)
  readAt          DateTime?
  
  createdAt       DateTime          @default(now())
  
  @@index([sessionId])
  @@index([createdAt])
  @@map("live_chat_messages")
}
```

#### AdminAvailability
```prisma
model AdminAvailability {
  id              String      @id @default(cuid())
  
  adminId         String      @unique
  admin           AdminUser   @relation(fields: [adminId], references: [id])
  
  // Status
  isOnline        Boolean     @default(false)
  status          String      @default("offline") // offline, available, busy, away
  
  // Capacity
  maxChats        Int         @default(3) // Max simultaneous chats
  activeChats     Int         @default(0) // Current active chats
  
  // Last activity
  lastSeenAt      DateTime?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  @@map("admin_availability")
}
```

## API Endpoints

### Customer Endpoints

#### POST /api/chat/live/request
Request live chat session after ticket creation
```typescript
Request:
{
  ticketId: string
  customerId?: string
  customerName: string
  customerEmail: string
}

Response:
{
  success: boolean
  sessionId: string
  status: 'WAITING' | 'ACTIVE'
  estimatedWaitTime?: number // seconds
}
```

#### GET /api/chat/live/[sessionId]/status
Check session status and wait time
```typescript
Response:
{
  status: ChatSessionStatus
  waitTime: number // seconds waiting
  adminName?: string // if accepted
  queuePosition?: number // if waiting
}
```

### Admin Endpoints

#### GET /api/chat/live/admin/queue
Get waiting chat requests
```typescript
Response:
{
  sessions: [{
    id: string
    sessionId: string
    customerName: string
    ticketNumber: string
    ticketType: string
    waitTime: number
    requestedAt: Date
  }]
}
```

#### POST /api/chat/live/admin/accept
Accept a waiting chat session
```typescript
Request:
{
  sessionId: string
  adminId: string
}

Response:
{
  success: boolean
  session: LiveChatSession
}
```

#### POST /api/chat/live/admin/close
Close a chat session
```typescript
Request:
{
  sessionId: string
  resolveTicket: boolean // also mark ticket as resolved
  resolution?: string
}

Response:
{
  success: boolean
}
```

#### POST /api/chat/live/admin/availability
Update admin online status
```typescript
Request:
{
  adminId: string
  isOnline: boolean
  status: 'available' | 'busy' | 'away'
  maxChats?: number
}

Response:
{
  success: boolean
  availability: AdminAvailability
}
```

## Socket.IO Events

### Server → Client Events

#### `chat:message` - New message in session
```typescript
{
  sessionId: string
  messageId: string
  message: string
  senderType: 'customer' | 'admin' | 'system'
  senderName: string
  timestamp: Date
}
```

#### `chat:admin-joined` - Admin accepted session
```typescript
{
  sessionId: string
  adminName: string
  adminId: string
}
```

#### `chat:admin-left` - Admin disconnected
```typescript
{
  sessionId: string
  reason: string
}
```

#### `chat:session-closed` - Session ended
```typescript
{
  sessionId: string
  closedBy: 'customer' | 'admin'
  duration: number
}
```

#### `chat:typing` - Typing indicator
```typescript
{
  sessionId: string
  senderType: 'customer' | 'admin'
  isTyping: boolean
}
```

#### `admin:new-request` - New chat request notification (admin only)
```typescript
{
  sessionId: string
  ticketNumber: string
  customerName: string
  waitTime: number
}
```

#### `admin:availability-changed` - Admin status update
```typescript
{
  adminId: string
  isOnline: boolean
  activeChats: number
}
```

### Client → Server Events

#### `chat:join` - Join a chat session
```typescript
{
  sessionId: string
  userId: string
  userType: 'customer' | 'admin'
}
```

#### `chat:send-message` - Send a message
```typescript
{
  sessionId: string
  message: string
  senderType: 'customer' | 'admin'
  senderId: string
  senderName: string
}
```

#### `chat:typing` - Send typing indicator
```typescript
{
  sessionId: string
  isTyping: boolean
}
```

#### `chat:mark-read` - Mark messages as read
```typescript
{
  sessionId: string
  lastMessageId: string
}
```

## UI Components

### Customer Interface

#### Component: LiveChatButton (in Reggie widget)
Location: After ticket creation confirmation
```typescript
// Shows after ticket created
{ticketCreated && (
  <LiveChatButton 
    ticketId={ticketCreated.ticketId}
    ticketNumber={ticketCreated.ticketNumber}
  />
)}
```

Features:
- Green glowing "Connect to Live Admin" button
- Shows estimated wait time
- Opens in-widget chat interface
- Unread message badges

#### Component: LiveChatInterface
Replaces Reggie chat interface when live chat active
```typescript
<LiveChatInterface
  sessionId={sessionId}
  onClose={() => setActiveSession(null)}
/>
```

Features:
- Real-time message display
- Typing indicators
- Admin name/avatar
- Connection status badge
- Message timestamps
- End chat button

### Admin Interface

#### Component: AdminChatQueue
Location: `/admin/live-chats` page
```typescript
<AdminChatQueue
  onAccept={(sessionId) => openChat(sessionId)}
/>
```

Features:
- List of waiting customers
- Wait time for each
- Ticket type/priority badges
- Quick accept buttons
- Auto-refresh every 3 seconds

#### Component: AdminActiveChatsList
Shows currently active chats for logged-in admin
```typescript
<AdminActiveChatsList
  adminId={adminId}
  onOpenChat={(sessionId) => openChat(sessionId)}
/>
```

Features:
- Thumbnail of each active chat
- Unread message count
- Customer name/ticket #
- Quick switch between chats
- Max 3 simultaneous chats

#### Component: AdminChatPanel
Full chat interface for admin
```typescript
<AdminChatPanel
  sessionId={sessionId}
  adminId={adminId}
  onClose={() => closeSession(sessionId)}
/>
```

Features:
- Message history with timestamps
- Real-time message updates
- Typing indicators
- Customer info sidebar (ticket details, order history)
- Quick actions (assign ticket, close chat, mark resolved)
- Internal notes (not visible to customer)

#### Component: AdminAvailabilityToggle
Header component for admins
```typescript
<AdminAvailabilityToggle
  adminId={adminId}
  onStatusChange={(status) => updateStatus(status)}
/>
```

Features:
- Online/Offline toggle
- Status selector (Available, Busy, Away)
- Active chat counter (2/3)
- Notification badge for new requests

## Implementation Plan

### Phase 1: Database & API Setup
1. Add new Prisma models (LiveChatSession, LiveChatMessage, AdminAvailability)
2. Run migration
3. Create API routes for session management
4. Create API routes for admin operations

### Phase 2: Socket.IO Server
1. Set up Socket.IO server in `/lib/socket.ts`
2. Implement room-based messaging
3. Implement event handlers
4. Add authentication middleware

### Phase 3: Customer UI
1. Create LiveChatButton component
2. Create LiveChatInterface component
3. Integrate Socket.IO client
4. Add to ShoppingAssistantWidget after ticket creation
5. Handle reconnection logic

### Phase 4: Admin UI
1. Create /admin/live-chats page
2. Build AdminChatQueue component
3. Build AdminActiveChatsList component
4. Build AdminChatPanel component
5. Add AdminAvailabilityToggle to admin header
6. Implement notification system

### Phase 5: Testing & Polish
1. Test concurrent chat sessions
2. Test reconnection scenarios
3. Test admin switching between chats
4. Add loading states and error handling
5. Add typing indicators
6. Add sound notifications

## Security Considerations

### Authentication
- Customer sessions validated by ticketId ownership
- Admin sessions require valid admin JWT
- Socket.IO middleware validates tokens

### Rate Limiting
- Max 1 live chat request per ticket
- Max 3 active chats per admin
- Message rate limiting (prevent spam)

### Data Privacy
- Messages stored encrypted at rest (future)
- Customer data only shown to assigned admin
- Chat history accessible through ticket

## Performance Optimizations

### Scaling
- Socket.IO with Redis adapter for multi-server
- Message pagination (load 50 at a time)
- Lazy loading of chat history

### Caching
- Admin availability cached (Redis)
- Queue positions calculated on-demand
- Session states cached in memory

## Monitoring & Analytics

### Metrics to Track
- Average wait time
- Average chat duration
- Customer satisfaction (post-chat survey)
- Admin response time
- Peak chat hours
- Abandonment rate (customers who leave queue)

### Logging
- All messages logged to database
- Session events logged (join, leave, accept, close)
- Error tracking for failed connections

## Future Enhancements

### Phase 2 Features
- File sharing in chat (images, screenshots)
- Canned responses for admins
- Chat transfer between admins
- Multi-language support
- Voice/video chat option
- Chat bot escalation to human
- Mobile app support

### Advanced Features
- Co-browsing (admin can see customer screen)
- Screen annotation
- Customer feedback/rating system
- AI-suggested responses for admins
- Integration with CRM systems
- Analytics dashboard for support metrics

## Testing Strategy

### Unit Tests
- API route handlers
- Socket event handlers
- Message validation
- Session state transitions

### Integration Tests
- Customer request flow
- Admin accept flow
- Message delivery
- Session closure
- Reconnection handling

### E2E Tests
- Complete customer journey
- Complete admin workflow
- Multiple concurrent sessions
- Network interruption scenarios

## Deployment Checklist

- [ ] Run Prisma migrations
- [ ] Configure Socket.IO server
- [ ] Set up Redis for Socket.IO adapter (production)
- [ ] Configure CORS for WebSocket connections
- [ ] Set up monitoring alerts
- [ ] Train admin staff on new interface
- [ ] Create admin documentation
- [ ] Set up fallback for Socket.IO failures
- [ ] Configure load balancer for WebSocket support
- [ ] Test on staging environment

## Success Metrics

### Initial Launch
- < 30 seconds average wait time
- > 90% customer satisfaction
- < 5% connection failures
- Admins handling 2-3 chats simultaneously

### 3 Months Post-Launch
- 30% of tickets resolved via live chat
- 50% reduction in ticket resolution time
- 80% of chats resolved in first interaction
- Positive impact on customer retention

---

**Status**: Architecture Complete ✅  
**Next Step**: Begin Phase 1 - Database & API Setup
