# Quick Start - Testing Admin Live Chat UI

## Prerequisites

⚠️ **IMPORTANT**: Before testing the admin UI, you need to run the database migration to create the LiveChat tables.

### Step 1: Run Database Migration

```bash
# Create and apply the migration
npx prisma migrate dev --name add-live-chat-tables
```

This will create:
- `LiveChatSession` table
- `LiveChatMessage` table  
- `AdminAvailability` table

### Step 2: Generate Prisma Client

```bash
npx prisma generate
```

## Quick Testing (Without Migration)

If you want to test the UI components without the full backend:

### 1. Start Dev Server

```bash
npm run dev
```

### 2. Navigate to Admin Tickets Page

Open: `http://localhost:3000/admin/support/tickets`

### 3. Verify UI Components

You should see:
- ✅ Two tabs: "Support Tickets" | "Live Chat Queue"
- ✅ Tab switcher with proper styling
- ✅ Active tab highlighted in blue
- ✅ Queue tab shows "Live Chat Queue" with chat icon

### 4. Test Tab Switching

- Click "Live Chat Queue" tab
  * Should switch to queue view
  * Will show "No customers waiting" (empty state)
  * Shows chat icon and refresh button

- Click "Support Tickets" tab
  * Should switch back to ticket table
  * Filters and pagination still work

### 5. Check Browser Console

- Open DevTools (F12)
- Check Console tab
- Should see no errors (queue API will return empty array)

## Full Testing (With Migration)

After running the migration in Step 1:

### 1. Create Test Data

```bash
npx tsx scripts/create-limited-drop.ts  # If you need test customer/order
```

### 2. Create Test Chat Request via API

```bash
# First, get a ticket ID
curl http://localhost:3000/api/support/tickets | jq '.tickets[0].id'

# Then create chat request (replace <ticket-id>)
curl -X POST http://localhost:3000/api/chat/live/request \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "<ticket-id>",
    "customerName": "Test Customer",
    "customerEmail": "test@example.com",
    "priority": "HIGH"
  }'
```

### 3. View Queue

- Refresh admin tickets page
- Click "Live Chat Queue" tab
- Should see:
  * Red badge with count (1)
  * Customer card with details
  * Priority badge (HIGH = orange)
  * Wait time display
  * Accept button

### 4. Test Accept Chat

- Click "Accept Chat" button
- Chat panel slides in from right
- Customer info in header
- Message input available

### 5. Test Messaging

- Type message: "Hello! How can I help?"
- Click Send
- Message appears as blue bubble on right
- Has timestamp and read receipt

### 6. Test Close Chat

- Optional: Check "Resolve ticket"
- Optional: Enter notes
- Click "Close Chat"
- Panel closes
- Queue count decrements

## UI-Only Testing Tips

You can test the UI components in isolation:

### Test AdminLiveChatQueue

```tsx
// Create a test page: app/test/chat-queue/page.tsx
'use client'

import { AdminLiveChatQueue } from '@/components/admin/support/AdminLiveChatQueue'

export default function TestPage() {
  return (
    <div className="p-8">
      <AdminLiveChatQueue 
        onAcceptChat={(sessionId) => console.log('Accepted:', sessionId)}
      />
    </div>
  )
}
```

Navigate to: `http://localhost:3000/test/chat-queue`

### Test AdminLiveChatPanel

```tsx
// Create a test page: app/test/chat-panel/page.tsx
'use client'

import { useState } from 'react'
import { AdminLiveChatPanel } from '@/components/admin/support/AdminLiveChatPanel'

export default function TestPage() {
  const [open, setOpen] = useState(true)
  
  return (
    <div className="p-8">
      <button onClick={() => setOpen(true)}>Open Chat Panel</button>
      {open && (
        <AdminLiveChatPanel 
          sessionId="test-session-123"
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
```

Navigate to: `http://localhost:3000/test/chat-panel`

## What Works Without Migration

✅ Tab switcher UI
✅ Tab navigation (Tickets ↔ Queue)
✅ Queue empty state display
✅ Component rendering
✅ Styling and layout
✅ Loading states
✅ Error handling UI

## What Requires Migration

⏸️ Queue data loading (needs LiveChatSession table)
⏸️ Accept chat functionality (needs database)
⏸️ Real-time messaging (needs Socket.IO + database)
⏸️ Chat history (needs LiveChatMessage table)
⏸️ Admin availability tracking (needs AdminAvailability table)

## Next Steps

1. **Run migration**: `npx prisma migrate dev --name add-live-chat-tables`
2. **Generate client**: `npx prisma generate`
3. **Create test data**: Use API or Prisma Studio
4. **Test full flow**: Queue → Accept → Chat → Close

## Troubleshooting

### "Property 'liveChatSession' does not exist"
→ Run `npx prisma generate` after creating migration

### "Table 'LiveChatSession' doesn't exist"
→ Run `npx prisma migrate dev` to apply migration

### Socket.IO not connecting
→ Check `/app/api/socket/route.ts` exists
→ Verify Socket.IO server is running

### Queue shows empty but data exists
→ Check API endpoint: `curl http://localhost:3000/api/chat/live/admin/queue`
→ Verify sessions have status = 'WAITING'

## Visual Verification Checklist

When testing the UI, verify these visual elements:

### Tab Switcher:
- [ ] Two tabs visible
- [ ] Active tab has blue underline
- [ ] Inactive tab is gray
- [ ] Hover effect on inactive tab
- [ ] Queue tab has chat icon
- [ ] Badge appears when queue count > 0
- [ ] Badge is red with white text

### Queue View:
- [ ] Empty state shows icon and message
- [ ] Customer cards have border and shadow
- [ ] Priority badges color-coded correctly
- [ ] Wait time formats properly (seconds/minutes)
- [ ] Queue position numbers display (#1, #2, etc.)
- [ ] Accept button is blue
- [ ] Warning appears for waits >3 minutes
- [ ] Refresh button visible

### Chat Panel:
- [ ] Slides in from right side
- [ ] Header has customer info and avatar
- [ ] Ticket context displays
- [ ] Duration counter updates
- [ ] Messages section scrollable
- [ ] Admin messages blue, right-aligned
- [ ] Customer messages white with border, left-aligned
- [ ] Timestamps display correctly
- [ ] Read receipts show checkmarks
- [ ] Input field at bottom
- [ ] Send button functional
- [ ] Close chat section at bottom

## Success Criteria

✅ All UI components render without errors
✅ Tab switching works smoothly
✅ No console errors
✅ Responsive design works (test mobile view)
✅ Loading states display properly
✅ Empty states show helpful messages
✅ Hover effects work
✅ Colors match design system

---

**Ready to proceed?** 

Choose your path:
- **Quick UI Test**: Just check components render (no migration needed)
- **Full Integration Test**: Complete workflow with database (migration required)

**Recommended**: Start with quick UI test, then run migration for full testing.
