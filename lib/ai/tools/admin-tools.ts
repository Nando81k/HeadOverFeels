import { FunctionDeclaration, SchemaType } from '@google/generative-ai'

/**
 * Admin-facing tools for Reggie AI
 * These tools help admins manage orders, support tickets, customers, and analytics
 * Tools marked with requiresConfirmation: true will pause for admin approval
 */

export interface AdminToolConfig {
  declaration: FunctionDeclaration
  requiresConfirmation: boolean
  confirmationMessage?: string // Template for confirmation dialog
}

export const adminTools: AdminToolConfig[] = [
  // ===== ORDER MANAGEMENT =====
  {
    declaration: {
      name: 'getOrderDetails',
      description: 'Get complete details for a specific order including items, customer info, payment, and shipping.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          orderNumber: {
            type: SchemaType.STRING,
            description: 'The order number (e.g., HOF-2024-1234)',
          },
          orderId: {
            type: SchemaType.STRING,
            description: 'The order ID',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'listOrders',
      description: 'List orders with optional filters for status, date range, and customer.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          status: {
            type: SchemaType.STRING,
            description: 'Filter by status',
            format: 'enum', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
          },
          customerEmail: {
            type: SchemaType.STRING,
            description: 'Filter by customer email',
          },
          dateFrom: {
            type: SchemaType.STRING,
            description: 'Start date (ISO format)',
          },
          dateTo: {
            type: SchemaType.STRING,
            description: 'End date (ISO format)',
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'Max results (default: 10)',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'updateOrderStatus',
      description: 'Update the status of an order (e.g., mark as shipped, processing).',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          orderId: {
            type: SchemaType.STRING,
            description: 'The order ID',
          },
          status: {
            type: SchemaType.STRING,
            description: 'New status',
            format: 'enum', enum: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
          },
          trackingNumber: {
            type: SchemaType.STRING,
            description: 'Tracking number (required when shipping)',
          },
          trackingUrl: {
            type: SchemaType.STRING,
            description: 'Tracking URL',
          },
          note: {
            type: SchemaType.STRING,
            description: 'Internal note about the status change',
          },
        },
        required: ['orderId', 'status'],
      },
    },
    requiresConfirmation: true,
    confirmationMessage: 'Update order {{orderNumber}} status to {{status}}?',
  },
  {
    declaration: {
      name: 'processRefund',
      description: 'Process a full or partial refund for an order.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          orderId: {
            type: SchemaType.STRING,
            description: 'The order ID',
          },
          amount: {
            type: SchemaType.NUMBER,
            description: 'Refund amount (leave empty for full refund)',
          },
          reason: {
            type: SchemaType.STRING,
            description: 'Reason for refund',
          },
          restockItems: {
            type: SchemaType.BOOLEAN,
            description: 'Whether to restock the items (default: true)',
          },
        },
        required: ['orderId', 'reason'],
      },
    },
    requiresConfirmation: true,
    confirmationMessage: 'Process {{amount}} refund for order {{orderNumber}}? Reason: {{reason}}',
  },

  // ===== SUPPORT TICKET MANAGEMENT =====
  {
    declaration: {
      name: 'listTickets',
      description: 'List support tickets with filters for status, priority, type, and assignee.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          status: {
            type: SchemaType.STRING,
            description: 'Filter by status',
            format: 'enum', enum: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'],
          },
          priority: {
            type: SchemaType.STRING,
            description: 'Filter by priority',
            format: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          },
          type: {
            type: SchemaType.STRING,
            description: 'Filter by type',
            format: 'enum', enum: ['REFUND', 'RETURN', 'EXCHANGE', 'ORDER_ISSUE', 'PRODUCT_QUESTION', 'SHIPPING_ISSUE', 'PAYMENT_ISSUE', 'GENERAL'],
          },
          assignedToMe: {
            type: SchemaType.BOOLEAN,
            description: 'Show only tickets assigned to current admin',
          },
          unassigned: {
            type: SchemaType.BOOLEAN,
            description: 'Show only unassigned tickets',
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'Max results (default: 10)',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'getTicketDetails',
      description: 'Get complete details for a support ticket including messages and related order.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          ticketId: {
            type: SchemaType.STRING,
            description: 'The ticket ID',
          },
          ticketNumber: {
            type: SchemaType.STRING,
            description: 'The ticket number (e.g., TKT-1234)',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'updateTicketStatus',
      description: 'Update the status of a support ticket.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          ticketId: {
            type: SchemaType.STRING,
            description: 'The ticket ID',
          },
          status: {
            type: SchemaType.STRING,
            description: 'New status',
            format: 'enum', enum: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'],
          },
          internalNote: {
            type: SchemaType.STRING,
            description: 'Internal note (not visible to customer)',
          },
        },
        required: ['ticketId', 'status'],
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'assignTicket',
      description: 'Assign a ticket to yourself or another admin.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          ticketId: {
            type: SchemaType.STRING,
            description: 'The ticket ID',
          },
          assignToSelf: {
            type: SchemaType.BOOLEAN,
            description: 'Assign to current admin',
          },
          adminId: {
            type: SchemaType.STRING,
            description: 'Admin ID to assign to (if not self)',
          },
        },
        required: ['ticketId'],
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'sendTicketResponse',
      description: 'Send a response message to the customer on a ticket.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          ticketId: {
            type: SchemaType.STRING,
            description: 'The ticket ID',
          },
          message: {
            type: SchemaType.STRING,
            description: 'Response message to send',
          },
        },
        required: ['ticketId', 'message'],
      },
    },
    requiresConfirmation: true,
    confirmationMessage: 'Send this response to ticket {{ticketNumber}}?\n\n"{{message}}"',
  },

  // ===== CUSTOMER MANAGEMENT =====
  {
    declaration: {
      name: 'getCustomerProfile',
      description: 'Get detailed customer profile including orders, loyalty status, and notes.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          customerId: {
            type: SchemaType.STRING,
            description: 'Customer ID',
          },
          email: {
            type: SchemaType.STRING,
            description: 'Customer email',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'listCustomers',
      description: 'List customers with filters for segment, loyalty tier, and search.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          search: {
            type: SchemaType.STRING,
            description: 'Search by name or email',
          },
          segment: {
            type: SchemaType.STRING,
            description: 'Filter by segment',
            format: 'enum', enum: ['new', 'returning', 'vip', 'at-risk', 'churned'],
          },
          loyaltyTier: {
            type: SchemaType.STRING,
            description: 'Filter by loyalty tier',
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'Max results (default: 10)',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'adjustLoyaltyPoints',
      description: 'Add or remove loyalty points from a customer account.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          customerId: {
            type: SchemaType.STRING,
            description: 'Customer ID',
          },
          points: {
            type: SchemaType.NUMBER,
            description: 'Points to add (positive) or remove (negative)',
          },
          reason: {
            type: SchemaType.STRING,
            description: 'Reason for adjustment',
          },
        },
        required: ['customerId', 'points', 'reason'],
      },
    },
    requiresConfirmation: true,
    confirmationMessage: 'Adjust {{points}} points for customer {{customerEmail}}? Reason: {{reason}}',
  },
  {
    declaration: {
      name: 'addCustomerNote',
      description: 'Add an internal note to a customer profile.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          customerId: {
            type: SchemaType.STRING,
            description: 'Customer ID',
          },
          note: {
            type: SchemaType.STRING,
            description: 'Note content',
          },
        },
        required: ['customerId', 'note'],
      },
    },
    requiresConfirmation: false,
  },

  // ===== ANALYTICS & REPORTING =====
  {
    declaration: {
      name: 'getDailySummary',
      description: 'Get a summary of today\'s sales, orders, and key metrics.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: {
            type: SchemaType.STRING,
            description: 'Date to summarize (ISO format, defaults to today)',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'getRevenueAnalytics',
      description: 'Get revenue analytics for a date range.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          startDate: {
            type: SchemaType.STRING,
            description: 'Start date (ISO format)',
          },
          endDate: {
            type: SchemaType.STRING,
            description: 'End date (ISO format)',
          },
          groupBy: {
            type: SchemaType.STRING,
            description: 'Group results by',
            format: 'enum', enum: ['day', 'week', 'month'],
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'getTopProducts',
      description: 'Get top selling or trending products.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          metric: {
            type: SchemaType.STRING,
            description: 'Metric to rank by',
            format: 'enum', enum: ['revenue', 'units_sold', 'views', 'conversion_rate'],
          },
          period: {
            type: SchemaType.STRING,
            description: 'Time period',
            format: 'enum', enum: ['today', 'week', 'month', 'quarter', 'year'],
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'Number of products (default: 5)',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'getLowStockAlerts',
      description: 'Get products that are low in stock or out of stock.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          threshold: {
            type: SchemaType.NUMBER,
            description: 'Stock threshold to consider low (default: 10)',
          },
          includeOutOfStock: {
            type: SchemaType.BOOLEAN,
            description: 'Include out of stock items',
          },
        },
      },
    },
    requiresConfirmation: false,
  },

  // ===== INVENTORY MANAGEMENT =====
  {
    declaration: {
      name: 'updateInventory',
      description: 'Update inventory count for a product variant.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          variantId: {
            type: SchemaType.STRING,
            description: 'Product variant ID',
          },
          quantity: {
            type: SchemaType.NUMBER,
            description: 'New inventory quantity',
          },
          reason: {
            type: SchemaType.STRING,
            description: 'Reason for adjustment',
          },
        },
        required: ['variantId', 'quantity', 'reason'],
      },
    },
    requiresConfirmation: true,
    confirmationMessage: 'Update inventory for {{productName}} ({{variantName}}) to {{quantity}} units?',
  },

  // ===== DRAFTING & AI ASSISTANCE =====
  {
    declaration: {
      name: 'draftCustomerEmail',
      description: 'Draft an email response for a customer issue. Does NOT send automatically.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          context: {
            type: SchemaType.STRING,
            description: 'Context about the situation (order issue, refund, etc.)',
          },
          tone: {
            type: SchemaType.STRING,
            description: 'Email tone',
            format: 'enum', enum: ['friendly', 'professional', 'apologetic', 'celebratory'],
          },
          customerName: {
            type: SchemaType.STRING,
            description: 'Customer name for personalization',
          },
          includePoints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'Key points to include in the email',
          },
        },
        required: ['context'],
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'suggestTicketResponse',
      description: 'Suggest a response for a support ticket based on its context.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          ticketId: {
            type: SchemaType.STRING,
            description: 'Ticket to analyze',
          },
        },
        required: ['ticketId'],
      },
    },
    requiresConfirmation: false,
  },
  {
    declaration: {
      name: 'summarizeCustomerIssue',
      description: 'Generate a summary of a customer\'s issue from ticket history.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          customerId: {
            type: SchemaType.STRING,
            description: 'Customer ID',
          },
          ticketId: {
            type: SchemaType.STRING,
            description: 'Specific ticket to summarize',
          },
        },
      },
    },
    requiresConfirmation: false,
  },
]

// Export just the declarations for Gemini
export const adminToolDeclarations = adminTools.map(t => t.declaration)

// Helper to check if a tool requires confirmation
export function toolRequiresConfirmation(toolName: string): boolean {
  const tool = adminTools.find(t => t.declaration.name === toolName)
  return tool?.requiresConfirmation ?? false
}

// Get confirmation message template for a tool
export function getConfirmationTemplate(toolName: string): string | undefined {
  const tool = adminTools.find(t => t.declaration.name === toolName)
  return tool?.confirmationMessage
}

// Tool metadata for UI display
export const adminToolMetadata: Record<string, { icon: string; label: string; color: string; destructive?: boolean }> = {
  getOrderDetails: { icon: '📦', label: 'Loading order', color: 'blue' },
  listOrders: { icon: '📋', label: 'Listing orders', color: 'gray' },
  updateOrderStatus: { icon: '🔄', label: 'Updating status', color: 'yellow', destructive: true },
  processRefund: { icon: '💸', label: 'Processing refund', color: 'red', destructive: true },
  listTickets: { icon: '🎫', label: 'Listing tickets', color: 'gray' },
  getTicketDetails: { icon: '📝', label: 'Loading ticket', color: 'blue' },
  updateTicketStatus: { icon: '✏️', label: 'Updating ticket', color: 'yellow' },
  assignTicket: { icon: '👤', label: 'Assigning ticket', color: 'purple' },
  sendTicketResponse: { icon: '💬', label: 'Sending response', color: 'green', destructive: true },
  getCustomerProfile: { icon: '👤', label: 'Loading customer', color: 'blue' },
  listCustomers: { icon: '👥', label: 'Listing customers', color: 'gray' },
  adjustLoyaltyPoints: { icon: '⭐', label: 'Adjusting points', color: 'yellow', destructive: true },
  addCustomerNote: { icon: '📝', label: 'Adding note', color: 'gray' },
  getDailySummary: { icon: '📊', label: 'Loading summary', color: 'blue' },
  getRevenueAnalytics: { icon: '💰', label: 'Loading analytics', color: 'green' },
  getTopProducts: { icon: '🏆', label: 'Loading top products', color: 'yellow' },
  getLowStockAlerts: { icon: '⚠️', label: 'Checking stock', color: 'orange' },
  updateInventory: { icon: '📦', label: 'Updating inventory', color: 'purple', destructive: true },
  draftCustomerEmail: { icon: '✉️', label: 'Drafting email', color: 'blue' },
  suggestTicketResponse: { icon: '💡', label: 'Generating suggestion', color: 'yellow' },
  summarizeCustomerIssue: { icon: '📋', label: 'Summarizing', color: 'gray' },
}
