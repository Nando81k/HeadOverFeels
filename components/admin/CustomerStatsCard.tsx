/**
 * Customer Stats Card Component
 * 
 * Displays key customer metrics in a card format
 */

interface CustomerStatsCardProps {
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate: Date | null;
  memberSince: Date;
}

export function CustomerStatsCard({
  totalOrders,
  totalSpent,
  avgOrderValue,
  lastOrderDate,
  memberSince
}: CustomerStatsCardProps) {
  const daysSinceLastOrder = lastOrderDate
    ? Math.floor((new Date().getTime() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const membershipDays = Math.floor(
    (new Date().getTime() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Lifetime Value */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
        <div className="text-sm text-purple-700 font-medium mb-1">Lifetime Value</div>
        <div className="text-2xl font-bold text-purple-900">${totalSpent.toFixed(2)}</div>
        <div className="text-xs text-purple-600 mt-1">
          {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
        </div>
      </div>

      {/* Average Order Value */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-700 font-medium mb-1">Avg Order Value</div>
        <div className="text-2xl font-bold text-blue-900">
          ${avgOrderValue > 0 ? avgOrderValue.toFixed(2) : '0.00'}
        </div>
        <div className="text-xs text-blue-600 mt-1">Per transaction</div>
      </div>

      {/* Last Order */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
        <div className="text-sm text-green-700 font-medium mb-1">Last Order</div>
        <div className="text-lg font-bold text-green-900">
          {lastOrderDate ? new Date(lastOrderDate).toLocaleDateString() : 'Never'}
        </div>
        {daysSinceLastOrder !== null && (
          <div className="text-xs text-green-600 mt-1">
            {daysSinceLastOrder === 0
              ? 'Today'
              : daysSinceLastOrder === 1
              ? 'Yesterday'
              : `${daysSinceLastOrder} days ago`}
          </div>
        )}
      </div>

      {/* Member Since */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-700 font-medium mb-1">Member Since</div>
        <div className="text-lg font-bold text-gray-900">
          {new Date(memberSince).toLocaleDateString()}
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {membershipDays === 0
            ? 'Today'
            : membershipDays === 1
            ? '1 day'
            : `${membershipDays} days`}
        </div>
      </div>
    </div>
  );
}
