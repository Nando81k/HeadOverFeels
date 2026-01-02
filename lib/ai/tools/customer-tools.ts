import { FunctionDeclaration, SchemaType } from '@google/generative-ai'

/**
 * Customer-facing tools for Reggie AI
 * These tools help customers shop, track orders, and get support
 */

export const customerTools: FunctionDeclaration[] = [
  // ===== SHOPPING TOOLS =====
  {
    name: 'searchProducts',
    description: 'Search for products by keyword, category, price range, or other criteria. Use this when the customer asks about products, wants recommendations, or is browsing.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'Search query - can be product name, description, style, color, etc.',
        },
        category: {
          type: SchemaType.STRING,
          description: 'Filter by category: hoodies, tees, pants, accessories, hats, outerwear',
        },
        minPrice: {
          type: SchemaType.NUMBER,
          description: 'Minimum price filter',
        },
        maxPrice: {
          type: SchemaType.NUMBER,
          description: 'Maximum price filter',
        },
        isLimitedEdition: {
          type: SchemaType.BOOLEAN,
          description: 'Filter to show only limited edition drops',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Maximum number of results to return (default: 5)',
        },
      },
    },
  },
  {
    name: 'getProductDetails',
    description: 'Get detailed information about a specific product including variants, sizes, availability, and reviews.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: {
          type: SchemaType.STRING,
          description: 'The product ID',
        },
        productSlug: {
          type: SchemaType.STRING,
          description: 'The product slug (URL-friendly name)',
        },
      },
    },
  },
  {
    name: 'getRecommendations',
    description: 'Get personalized product recommendations based on browsing history, purchases, or current context.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          description: 'Type of recommendations: personalized, similar, trending, frequently_bought_together',
          format: 'enum', enum: ['personalized', 'similar', 'trending', 'frequently_bought_together'],
        },
        productId: {
          type: SchemaType.STRING,
          description: 'Product ID for similar/frequently_bought_together recommendations',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Number of recommendations (default: 4)',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'getLimitedDrops',
    description: 'Get information about current and upcoming limited edition drops with release dates and availability.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description: 'Filter by drop status: live, upcoming, past',
          format: 'enum', enum: ['live', 'upcoming', 'past', 'all'],
        },
      },
    },
  },
  {
    name: 'checkProductAvailability',
    description: 'Check if a specific product variant is in stock.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: {
          type: SchemaType.STRING,
          description: 'The product ID',
        },
        size: {
          type: SchemaType.STRING,
          description: 'Size to check (S, M, L, XL, etc.)',
        },
        color: {
          type: SchemaType.STRING,
          description: 'Color to check',
        },
      },
      required: ['productId'],
    },
  },

  // ===== ORDER TOOLS =====
  {
    name: 'getOrderStatus',
    description: 'Get the current status and tracking information for an order. Requires customer to be logged in or provide order number + email.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: {
          type: SchemaType.STRING,
          description: 'The order number (e.g., HOF-2024-1234)',
        },
        email: {
          type: SchemaType.STRING,
          description: 'Email address associated with the order (for guest orders)',
        },
      },
    },
  },
  {
    name: 'getOrderHistory',
    description: 'Get the customer\'s order history. Customer must be logged in.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.NUMBER,
          description: 'Number of orders to return (default: 5)',
        },
        status: {
          type: SchemaType.STRING,
          description: 'Filter by order status',
          format: 'enum', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
        },
      },
    },
  },

  // ===== CART TOOLS =====
  {
    name: 'addToCart',
    description: 'Add a product to the customer\'s cart.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: {
          type: SchemaType.STRING,
          description: 'The product ID to add',
        },
        variantId: {
          type: SchemaType.STRING,
          description: 'The specific variant ID (size/color combination)',
        },
        quantity: {
          type: SchemaType.NUMBER,
          description: 'Quantity to add (default: 1)',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'getCartSummary',
    description: 'Get the current contents of the customer\'s shopping cart.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'applyCoupon',
    description: 'Apply a coupon code to get a discount.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        code: {
          type: SchemaType.STRING,
          description: 'The coupon code to apply',
        },
      },
      required: ['code'],
    },
  },

  // ===== SUPPORT TOOLS =====
  {
    name: 'createSupportTicket',
    description: 'Create a support ticket for issues like refunds, returns, exchanges, or general questions.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          description: 'Type of support request',
          format: 'enum', enum: ['REFUND', 'RETURN', 'EXCHANGE', 'ORDER_ISSUE', 'PRODUCT_QUESTION', 'SHIPPING_ISSUE', 'PAYMENT_ISSUE', 'GENERAL'],
        },
        subject: {
          type: SchemaType.STRING,
          description: 'Brief subject line for the ticket',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Detailed description of the issue',
        },
        orderId: {
          type: SchemaType.STRING,
          description: 'Related order ID if applicable',
        },
        priority: {
          type: SchemaType.STRING,
          description: 'Priority level',
          format: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        },
      },
      required: ['type', 'subject', 'description'],
    },
  },
  {
    name: 'getTicketStatus',
    description: 'Check the status of an existing support ticket.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        ticketNumber: {
          type: SchemaType.STRING,
          description: 'The ticket number (e.g., TKT-1234)',
        },
      },
      required: ['ticketNumber'],
    },
  },
  {
    name: 'requestLiveAgent',
    description: 'Request to speak with a live customer service agent. Use when the customer explicitly asks for human help or when the issue is too complex.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        reason: {
          type: SchemaType.STRING,
          description: 'Brief reason for requesting live agent',
        },
        ticketId: {
          type: SchemaType.STRING,
          description: 'Related ticket ID if escalating an existing issue',
        },
      },
    },
  },

  // ===== LOYALTY TOOLS =====
  {
    name: 'getLoyaltyStatus',
    description: 'Get the customer\'s loyalty program status including points, tier, and available rewards.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'getAvailableRewards',
    description: 'Get list of rewards the customer can redeem with their points.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'getReferralCode',
    description: 'Get or generate the customer\'s referral code for sharing with friends.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
]

// Tool metadata for UI display
export const customerToolMetadata: Record<string, { icon: string; label: string; color: string }> = {
  searchProducts: { icon: '🔍', label: 'Searching products', color: 'blue' },
  getProductDetails: { icon: '📦', label: 'Getting product info', color: 'purple' },
  getRecommendations: { icon: '✨', label: 'Finding recommendations', color: 'yellow' },
  getLimitedDrops: { icon: '🔥', label: 'Checking drops', color: 'red' },
  checkProductAvailability: { icon: '📊', label: 'Checking stock', color: 'green' },
  getOrderStatus: { icon: '📍', label: 'Tracking order', color: 'blue' },
  getOrderHistory: { icon: '📜', label: 'Loading orders', color: 'gray' },
  addToCart: { icon: '🛒', label: 'Adding to cart', color: 'green' },
  getCartSummary: { icon: '🛍️', label: 'Loading cart', color: 'purple' },
  applyCoupon: { icon: '🎟️', label: 'Applying coupon', color: 'yellow' },
  createSupportTicket: { icon: '🎫', label: 'Creating ticket', color: 'orange' },
  getTicketStatus: { icon: '📋', label: 'Checking ticket', color: 'blue' },
  requestLiveAgent: { icon: '👤', label: 'Connecting to agent', color: 'green' },
  getLoyaltyStatus: { icon: '⭐', label: 'Loading loyalty', color: 'yellow' },
  getAvailableRewards: { icon: '🎁', label: 'Loading rewards', color: 'purple' },
  getReferralCode: { icon: '🔗', label: 'Getting referral', color: 'blue' },
}
