# Reggie AI → Live Chat: Visual Walkthrough

## 🎬 Complete User Journey

### Scene 1: Customer Opens Reggie AI

```
┌─────────────────────────────────────┐
│  💬 REGGIE AI ✨          [✕]       │
│  Your Street Style Guide            │
├─────────────────────────────────────┤
│                                     │
│  👋 Reggie:                         │
│  "Yo, I'm Reggie. Need help finding│
│   something or got questions about │
│   an order? I gotchu."              │
│                                     │
│  ┌─────────────┬─────────────┐     │
│  │ Get Support │ Find Outfit  │     │
│  ├─────────────┼─────────────┤     │
│  │  New Drops  │  Sale Items  │     │
│  └─────────────┴─────────────┘     │
│                                     │
├─────────────────────────────────────┤
│ Ask Reggie anything... [Send ▶]    │
└─────────────────────────────────────┘
```

**State**: AI Mode  
**Border**: Red (#FF3131)  
**Icon**: ChatCircle with Sparkle

---

### Scene 2: Customer Requests Support

```
┌─────────────────────────────────────┐
│  💬 REGGIE AI ✨          [✕]       │
│  Your Street Style Guide            │
├─────────────────────────────────────┤
│                                     │
│  👋 Reggie:                         │
│  "Yo, I'm Reggie. Need help..."    │
│                                     │
│  Customer:                      👤 │
│  "I need help with an order"    ◀─┘│
│                                     │
│  👋 Reggie:                         │
│  "No problem! Let me help you with │
│   your order. What type of support │
│   do you need?"                    │
│                                     │
│  ┌──────────┬──────────┬─────────┐ │
│  │  REFUND  │  RETURN  │ EXCHANGE│ │
│  ├──────────┴──────────┴─────────┤ │
│  │ ORDER ISSUE │ PRODUCT QUESTION │ │
│  └──────────────┴─────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ Ask Reggie anything... [Send ▶]    │
└─────────────────────────────────────┘
```

**Action**: Customer clicks "Get Support"  
**Result**: Reggie shows support type buttons

---

### Scene 3: Ticket Created - Live Agent Button Appears

```
┌─────────────────────────────────────┐
│  💬 REGGIE AI ✨          [✕]       │
│  Your Street Style Guide            │
├─────────────────────────────────────┤
│                                     │
│  Customer:                      👤 │
│  "Refund"                       ◀─┘│
│                                     │
│  👋 Reggie:                         │
│  "I've created a support ticket for│
│   your refund request. Our team    │
│   will contact you within 24 hours"│
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ✓ Support Ticket Created      │ │
│  │   #TKT123456                   │ │
│  │   Our team will contact you    │ │
│  │   within 24 hours              │ │
│  │                                │ │
│  │   [REFUND]                     │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👤 TALK TO LIVE AGENT          │ │ ⬅ NEW!
│  │ Get help from a real person    │ │
│  └───────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ Ask Reggie anything... [Send ▶]    │
└─────────────────────────────────────┘
```

**Trigger**: Ticket created OR Reggie says "can't help"  
**New Element**: Blue "TALK TO LIVE AGENT" button

---

### Scene 4: Customer Clicks Live Agent - Waiting State

```
┌─────────────────────────────────────┐
│  👤 LIVE CHAT               [✕]     │  ⬅ CHANGED!
│  Connecting...                      │  ⬅ CHANGED!
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │     🔄                         │ │
│  │  Waiting for an agent...       │ │
│  │                                │ │
│  │  You're in the queue. An agent │ │
│  │  will be with you shortly.     │ │
│  └───────────────────────────────┘ │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ Type your message... [Send ▶]      │  ⬅ DISABLED
└─────────────────────────────────────┘
```

**Changes**:
- Header: "REGGIE AI" → "LIVE CHAT"
- Icon: ChatCircle → User icon
- Border: Red → Blue (#3B82F6)
- Subtitle: "Your Street Style Guide" → "Connecting..."
- Status: Waiting spinner with message
- Input: Disabled (can't send while waiting)

**Backend**: Socket.IO connected, session created (status: WAITING)

---

### Scene 5: Admin Accepts Chat - Active State

```
┌─────────────────────────────────────┐
│  👤 LIVE CHAT               [✕]     │
│  Sarah M.  ● Online                 │  ⬅ CHANGED!
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👤 Sarah M.  ● Online          │ │  ⬅ NEW!
│  │                                │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Previous conversation visible]   │
│                                     │
│  👋 Sarah M:                        │  ⬅ ADMIN MESSAGE
│  "Hi! I'm Sarah from support. I    │
│   see you need help with a refund. │
│   How can I assist you today?"     │
│  10:45 AM                           │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ Type your message... [Send ▶]      │  ⬅ ENABLED!
└─────────────────────────────────────┘
```

**Changes**:
- Subtitle: "Connecting..." → "Sarah M."
- Status box: Shows admin info with green online dot
- Admin message appears (left-aligned, dark background)
- Input: Now enabled for customer to reply

**Backend**: Admin accepted (status: ACTIVE), Socket.IO events flowing

---

### Scene 6: Real-Time Conversation

```
┌─────────────────────────────────────┐
│  👤 LIVE CHAT               [✕]     │
│  Sarah M.  ● Online                 │
├─────────────────────────────────────┤
│                                     │
│  👋 Sarah M:                        │
│  "Hi! I'm Sarah from support. I    │
│   see you need help with a refund. │
│   How can I assist you today?"     │
│  10:45 AM                           │
│                                     │
│  Customer:                      👤 │
│  "I received the wrong size and    │
│   would like a refund please"   ◀─┘│
│  10:46 AM                       ✓  │  ⬅ READ RECEIPT
│                                     │
│  👋 Sarah M:                        │
│  "I understand. I can definitely   │
│   help you with that..."           │
│  10:47 AM                           │
│                                     │
│  [⚪ Sarah M. is typing...]         │  ⬅ TYPING INDICATOR
│                                     │
├─────────────────────────────────────┤
│ Type your message... [Send ▶]      │
└─────────────────────────────────────┘
```

**Features Visible**:
- ✓ Customer messages: Right-aligned, red background (#FF3131)
- ✓ Admin messages: Left-aligned, dark background
- ✓ Timestamps: HH:MM format
- ✓ Read receipts: Blue checkmark (✓) when admin reads
- ✓ Typing indicator: Shows when admin is typing
- ✓ Auto-scroll: Latest message always visible

---

### Scene 7: Chat Closed

```
┌─────────────────────────────────────┐
│  👤 LIVE CHAT               [✕]     │
│  Sarah M.  ● Online                 │
├─────────────────────────────────────┤
│                                     │
│  [Previous messages...]             │
│                                     │
│  👋 Sarah M:                        │
│  "Your refund has been processed.  │
│   You'll receive it in 3-5 business│
│   days. Is there anything else I   │
│   can help with?"                  │
│  10:52 AM                           │
│                                     │
│  Customer:                      👤 │
│  "No, that's all. Thank you!"   ◀─┘│
│  10:53 AM                       ✓  │
│                                     │
│  ┌───────────────────────────────┐ │
│  │     ✓                          │ │
│  │  Chat ended                    │ │  ⬅ CLOSED STATE
│  │                                │ │
│  │  Thank you for chatting with   │ │
│  │  us!                           │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  BACK TO REGGIE AI             │ │  ⬅ RETURN BUTTON
│  └───────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ Type your message... [Send ▶]      │  ⬅ DISABLED
└─────────────────────────────────────┘
```

**Changes**:
- Status: "Chat ended" with green checkmark
- Input: Disabled (can't send after close)
- New button: "BACK TO REGGIE AI"

**Backend**: Session status = CLOSED, duration calculated

---

### Scene 8: Return to AI Mode

```
┌─────────────────────────────────────┐
│  💬 REGGIE AI ✨          [✕]       │  ⬅ BACK TO RED!
│  Your Street Style Guide            │  ⬅ BACK TO AI!
├─────────────────────────────────────┤
│                                     │
│  👋 Reggie:                         │
│  "Yo, I'm Reggie. Need help finding│
│   something or got questions about │
│   an order? I gotchu."              │
│                                     │
│  ┌─────────────┬─────────────┐     │
│  │ Get Support │ Find Outfit  │     │
│  ├─────────────┼─────────────┤     │
│  │  New Drops  │  Sale Items  │     │
│  └─────────────┴─────────────┘     │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ Ask Reggie anything... [Send ▶]    │  ⬅ ENABLED
└─────────────────────────────────────┘
```

**Result**: Full reset to AI mode
- Conversation history cleared
- Presets visible again
- Red theme restored
- Ready for new interaction

---

## 🎨 Visual Elements Comparison

### Header States

| State | Icon | Title | Subtitle | Stroke Color |
|-------|------|-------|----------|--------------|
| **AI Mode** | ChatCircle + Sparkle | REGGIE AI | Your Street Style Guide | Red (#FF3131) |
| **Connecting** | User | LIVE CHAT | Connecting... | Blue (#3B82F6) |
| **Waiting** | User | LIVE CHAT | Connecting... | Blue (#3B82F6) |
| **Active** | User | LIVE CHAT | Sarah M. ● Online | Blue (#3B82F6) |
| **Closed** | User | LIVE CHAT | Sarah M. | Blue (#3B82F6) |

### Message Bubble Styles

**Customer Messages** (Both AI & Live Chat):
```
                        ┌─────────────────────┐
                        │  Message text here  │
                        │  10:45 AM        ✓  │
                        └─────────────────────┘
                                            👤
```
- Alignment: Right
- Background: Red (#FF3131)
- Text: White
- Read receipt: Blue checkmark (live chat only)

**AI Messages** (Reggie):
```
👋 
┌─────────────────────┐
│  Message text here  │
│                     │
└─────────────────────┘
```
- Alignment: Left
- Background: Dark (#1A1A1A) with border
- Text: White
- Icon: Waving hand emoji

**Admin Messages** (Live Chat):
```
👤 
┌─────────────────────┐
│  Message text here  │
│  10:46 AM           │
└─────────────────────┘
```
- Alignment: Left  
- Background: Dark (#1A1A1A) with border (#2A2A2A)
- Text: White
- Timestamp: Gray

### Button Styles

**Live Agent Button**:
```
┌─────────────────────────────────┐
│  👤 TALK TO LIVE AGENT           │
│  Get help from a real person     │
└─────────────────────────────────┘
```
- Background: Blue gradient (blue-900/30 to blue-800/20)
- Border: 2px solid blue-500/50
- Icon: User (18px, blue-400)
- Hover: Border brightens to blue-400

**Back to AI Button**:
```
┌─────────────────────────────────┐
│  BACK TO REGGIE AI               │
└─────────────────────────────────┘
```
- Background: Purple gradient
- Border: purple-500/50
- Hover: Scale 1.02

### Status Displays

**Waiting State**:
```
┌─────────────────────────────────┐
│         🔄                       │
│  Waiting for an agent...         │
│                                  │
│  You're in the queue. An agent   │
│  will be with you shortly.       │
└─────────────────────────────────┘
```
- Background: blue-900/20
- Border: blue-500/30
- Icon: CircleNotch (spinning)
- Text: blue-400 (heading), gray-400 (body)

**Active State**:
```
┌─────────────────────────────────┐
│  👤  Sarah M.                    │
│      ● Online                    │
└─────────────────────────────────┘
```
- Background: blue-900/20
- Border: blue-500/30
- Avatar: Blue circle with User icon
- Online dot: Green (w-2 h-2, bg-green-500, animate-pulse)

**Closed State**:
```
┌─────────────────────────────────┐
│         ✓                        │
│  Chat ended                      │
│                                  │
│  Thank you for chatting with us! │
└─────────────────────────────────┘
```
- Background: blue-900/20 (or green tint)
- Icon: CheckCircle (green-400)
- Text: green-400 (heading), gray-400 (body)

---

## 📱 Mobile View

### Collapsed (Floating Button)

```
                           ┌───────────────┐
                           │ 💬  REGGIE AI │
                           └───────────────┘
```
- Position: Fixed bottom-right
- Size: Compact with icon + text
- Border: 2px red (AI) or blue (Live)

### Expanded (Full Screen on Mobile)

```
┌─────────────────────────────────────┐
│  💬 REGGIE AI ✨          [✕]       │
│  Your Street Style Guide            │
├─────────────────────────────────────┤
│                                     │
│  [Messages fill viewport]           │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ Ask Reggie anything... [Send ▶]    │
└─────────────────────────────────────┘
```
- Width: 100vw (fills screen width)
- Height: 100vh (fills screen height)
- Input: Fixed at bottom (iOS safe area aware)

---

## 🎭 Animation Timeline

### Opening Widget

```
Frame 1: Button (scale: 0.8, opacity: 0, y: 20)
         │
         │ 400ms ease-out
         ▼
Frame 2: Widget (scale: 1, opacity: 1, y: 0)
```

### Switching to Live Chat

```
Before:  💬 REGGIE AI ✨  (red border)
         │
         │ Instant state change
         │
After:   👤 LIVE CHAT     (blue border)
         │
         │ 200ms fade-in
         ▼
Status:  "Waiting for an agent..." appears
```

### Message Arrival

```
New message added to state
  │
  │ Instant append to DOM
  ▼
Auto-scroll animation (smooth)
  │
  │ 300ms
  ▼
Message fully visible at bottom
```

### Typing Indicator

```
Admin starts typing
  │
  │ Socket event received
  ▼
┌───────────────────────┐
│ ⚪ Sarah M. is typing...│ ← Fade in (200ms)
└───────────────────────┘
  │
  │ Admin sends message
  ▼
Typing indicator removed ← Fade out (200ms)
New message appears
```

---

## 🔄 State Diagram

```
┌─────────────┐
│   AI MODE   │ ──────────────────────┐
└─────────────┘                       │
       │                              │
       │ Click "Talk to Live Agent"   │
       ▼                              │
┌─────────────┐                       │
│ CONNECTING  │ (brief transition)    │
└─────────────┘                       │
       │                              │
       │ Socket.IO connects           │
       ▼                              │
┌─────────────┐                       │
│   WAITING   │ ◄────────┐            │
└─────────────┘          │            │
       │                 │ Timeout    │
       │ Admin accepts   │ (optional) │
       ▼                 │            │
┌─────────────┐          │            │
│   ACTIVE    │ ─────────┘            │
└─────────────┘                       │
       │                              │
       │ Chat closed                  │
       ▼                              │
┌─────────────┐                       │
│   CLOSED    │                       │
└─────────────┘                       │
       │                              │
       │ Click "Back to Reggie AI"    │
       └──────────────────────────────┘
```

**Transitions**:
- AI → CONNECTING: Instant (button click)
- CONNECTING → WAITING: ~100ms (Socket.IO connect + API response)
- WAITING → ACTIVE: Varies (depends on admin response time)
- ACTIVE → CLOSED: Instant (close button click)
- CLOSED → AI: Instant (back button click)

---

## 🎯 Key Visual Cues for Users

### Mode Identification

| Element | AI Mode | Live Chat Mode |
|---------|---------|----------------|
| **Primary Color** | Red | Blue |
| **Header Icon** | ChatCircle + Sparkle | User |
| **Title** | REGGIE AI | LIVE CHAT |
| **Subtitle** | Static text | Dynamic (admin name or status) |
| **Message Sender** | Reggie emoji 👋 | Admin name + avatar |

### Status Recognition

| Status | Visual Cue | User Action |
|--------|------------|-------------|
| **Waiting** | 🔄 Spinning + "Waiting..." | None (passive) |
| **Active** | ● Green dot + admin name | Can chat freely |
| **Closed** | ✓ Checkmark + "Chat ended" | Click "Back to Reggie AI" |

### Interaction Affordances

**Clickable Elements**:
- Preset buttons (AI mode)
- Support type buttons
- Order selection buttons
- Reason buttons
- "Talk to Live Agent" button (blue, prominent)
- "Back to Reggie AI" button (purple)
- Send button (always visible when input enabled)

**Disabled States**:
- Input grayed out when waiting or closed
- Send button opacity 50% when input empty
- All buttons show disabled cursor when not interactive

---

## 💡 Design Decisions

### Why Blue for Live Chat?

- **Differentiation**: Red = AI (automated), Blue = Human (real person)
- **Trust**: Blue conveys professionalism and trustworthiness
- **Calmness**: Customers in support mode may be frustrated; blue is calming

### Why Keep Customer Messages Red?

- **Consistency**: Customer always sees their messages in same color
- **Identity**: Red is brand color; maintains visual connection
- **Clarity**: Easy to distinguish customer (red) vs admin (dark)

### Why User Icon Instead of Avatar Photo?

- **Simplicity**: Generic icon works for all admins
- **Privacy**: No need to expose admin photos
- **Scalability**: No image loading, instant render
- **Flexibility**: Can add real avatars later if needed

### Why In-Widget Instead of Separate Modal?

- **Context**: Customer already engaged with widget
- **Familiarity**: Same UI, just different mode
- **Simplicity**: No new window to manage
- **Mobile**: Better experience on small screens

---

**Walkthrough Created**: November 8, 2025  
**Feature**: Customer Live Chat Integration  
**Component**: ShoppingAssistantWidget  
**Project**: Head Over Feels
