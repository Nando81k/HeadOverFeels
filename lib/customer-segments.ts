/**
 * Customer Segmentation Logic
 * 
 * Defines customer segments for CRM management:
 * - VIP: High-value customers (>$500 spent OR >5 orders)
 * - New: Recently registered (<30 days)
 * - At-Risk: No orders in 90+ days
 * - Active: Has orders and not at-risk
 * - Inactive: No orders ever
 */

export type CustomerSegment = 'VIP' | 'New' | 'At-Risk' | 'Active' | 'Inactive';

export interface CustomerSegmentConfig {
  vip: {
    minSpent: number;     // Minimum lifetime value
    minOrders: number;    // OR minimum order count
  };
  new: {
    daysThreshold: number; // Days since registration
  };
  atRisk: {
    daysThreshold: number; // Days since last order
  };
}

// Default segment thresholds (can be customized)
export const DEFAULT_SEGMENT_CONFIG: CustomerSegmentConfig = {
  vip: {
    minSpent: 500,
    minOrders: 5
  },
  new: {
    daysThreshold: 30
  },
  atRisk: {
    daysThreshold: 90
  }
};

/**
 * Calculate customer segment based on their data
 */
export function calculateCustomerSegment(
  customer: {
    totalSpent: number;
    totalOrders: number;
    lastOrderDate: Date | null;
    createdAt: Date;
  },
  config: CustomerSegmentConfig = DEFAULT_SEGMENT_CONFIG
): CustomerSegment {
  const now = new Date();
  
  // Check if VIP (high value or high frequency)
  if (
    customer.totalSpent >= config.vip.minSpent ||
    customer.totalOrders >= config.vip.minOrders
  ) {
    return 'VIP';
  }
  
  // Check if New (recently registered)
  const daysSinceRegistration = Math.floor(
    (now.getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceRegistration <= config.new.daysThreshold) {
    return 'New';
  }
  
  // Check if has any orders
  if (customer.totalOrders === 0) {
    return 'Inactive';
  }
  
  // Check if At-Risk (no recent orders)
  if (customer.lastOrderDate) {
    const daysSinceLastOrder = Math.floor(
      (now.getTime() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastOrder >= config.atRisk.daysThreshold) {
      return 'At-Risk';
    }
  }
  
  // Default: Active customer
  return 'Active';
}

/**
 * Get all segments for a customer (can have multiple)
 */
export function getCustomerSegments(
  customer: {
    totalSpent: number;
    totalOrders: number;
    lastOrderDate: Date | null;
    createdAt: Date;
  },
  config: CustomerSegmentConfig = DEFAULT_SEGMENT_CONFIG
): CustomerSegment[] {
  const segments: CustomerSegment[] = [];
  const now = new Date();
  
  // Check VIP
  if (
    customer.totalSpent >= config.vip.minSpent ||
    customer.totalOrders >= config.vip.minOrders
  ) {
    segments.push('VIP');
  }
  
  // Check New
  const daysSinceRegistration = Math.floor(
    (now.getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceRegistration <= config.new.daysThreshold) {
    segments.push('New');
  }
  
  // Check At-Risk (only if has orders)
  if (customer.totalOrders > 0 && customer.lastOrderDate) {
    const daysSinceLastOrder = Math.floor(
      (now.getTime() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastOrder >= config.atRisk.daysThreshold) {
      segments.push('At-Risk');
    }
  }
  
  // If has orders but no special segments, add Active
  if (customer.totalOrders > 0 && segments.length === 0) {
    segments.push('Active');
  }
  
  // If no orders and not new, add Inactive
  if (customer.totalOrders === 0 && !segments.includes('New')) {
    segments.push('Inactive');
  }
  
  return segments;
}

/**
 * Get segment display info (for UI badges)
 */
export function getSegmentInfo(segment: CustomerSegment): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  switch (segment) {
    case 'VIP':
      return {
        label: 'VIP',
        color: 'text-purple-700',
        bgColor: 'bg-purple-100',
        description: 'High-value customer (>$500 spent or >5 orders)'
      };
    case 'New':
      return {
        label: 'New',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        description: 'Recently registered (<30 days)'
      };
    case 'At-Risk':
      return {
        label: 'At-Risk',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        description: 'No orders in 90+ days'
      };
    case 'Active':
      return {
        label: 'Active',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        description: 'Regular customer with recent orders'
      };
    case 'Inactive':
      return {
        label: 'Inactive',
        color: 'text-gray-700',
        bgColor: 'bg-gray-100',
        description: 'No orders yet'
      };
  }
}

/**
 * Filter customers by segment
 */
export function filterCustomersBySegment(
  customers: Array<{
    totalSpent: number;
    totalOrders: number;
    lastOrderDate: Date | null;
    createdAt: Date;
  }>,
  segment: CustomerSegment,
  config: CustomerSegmentConfig = DEFAULT_SEGMENT_CONFIG
) {
  return customers.filter(customer => {
    const primarySegment = calculateCustomerSegment(customer, config);
    return primarySegment === segment;
  });
}

/**
 * Get segment statistics
 */
export function getSegmentStats(
  customers: Array<{
    totalSpent: number;
    totalOrders: number;
    lastOrderDate: Date | null;
    createdAt: Date;
  }>,
  config: CustomerSegmentConfig = DEFAULT_SEGMENT_CONFIG
) {
  const stats = {
    VIP: 0,
    New: 0,
    'At-Risk': 0,
    Active: 0,
    Inactive: 0,
    total: customers.length
  };
  
  customers.forEach(customer => {
    const segment = calculateCustomerSegment(customer, config);
    stats[segment]++;
  });
  
  return stats;
}
