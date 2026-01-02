import Link from "next/link";
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const [tiers, totalCustomers, totalTransactions] = await Promise.all([
    prisma.loyaltyTier.findMany({
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    }),
    prisma.customer.count({
      where: {
        loyaltyTierId: { not: null },
      },
    }),
    prisma.pointsTransaction.count(),
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={24} weight="bold" className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Loyalty Program</h1>
          <p className="text-gray-600">
            Manage loyalty tiers, rewards, and customer point balances
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Active Members</h3>
            <p className="text-3xl font-bold text-gray-900">{totalCustomers}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Loyalty Tiers</h3>
            <p className="text-3xl font-bold text-gray-900">{tiers.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Points Transactions</h3>
            <p className="text-3xl font-bold text-gray-900">
              {totalTransactions.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Loyalty Tiers */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Loyalty Tiers</h2>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {tiers.map((tier) => {
                const pointsPercent =
                  tier.pointMultiplier > 1
                    ? Math.round((tier.pointMultiplier - 1) * 100)
                    : 0;

                const perks =
                  tier.perks && typeof tier.perks === "string"
                    ? JSON.parse(tier.perks)
                    : {};

                return (
                  <div
                    key={tier.id}
                    className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                        {tier.description && (
                          <p className="text-sm text-gray-600">{tier.description}</p>
                        )}
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                        {tier._count.customers} members
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-xs text-gray-600 mb-1">Min Annual Spend</div>
                        <div className="text-lg font-semibold text-gray-900">
                          {formatCurrency(tier.minAnnualSpend)}
                        </div>
                      </div>

                      {pointsPercent > 0 && (
                        <div className="bg-blue-50 rounded-lg p-4">
                          <div className="text-xs text-blue-600 mb-1">Points Bonus</div>
                          <div className="text-lg font-semibold text-blue-900">
                            +{pointsPercent}%
                          </div>
                        </div>
                      )}

                      {tier.isInviteOnly && (
                        <div className="bg-purple-50 rounded-lg p-4">
                          <div className="text-xs text-purple-600 mb-1">Status</div>
                          <div className="text-lg font-semibold text-purple-900">
                            Invite Only
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-2">Benefits:</div>
                      <ul className="space-y-1">
                        {tier.freeShipping && (
                          <li className="flex items-start text-sm text-gray-700">
                            <span className="text-green-500 mr-2">✓</span>
                            Free Shipping
                          </li>
                        )}
                        {tier.earlyDropAccess && (
                          <li className="flex items-start text-sm text-gray-700">
                            <span className="text-green-500 mr-2">✓</span>
                            Early Drop Access
                          </li>
                        )}
                        {perks.careBox && (
                          <li className="flex items-start text-sm text-gray-700">
                            <span className="text-green-500 mr-2">✓</span>
                            Seasonal Care Box
                          </li>
                        )}
                        {perks.engravedItem && (
                          <li className="flex items-start text-sm text-gray-700">
                            <span className="text-green-500 mr-2">✓</span>
                            Engraved Item
                          </li>
                        )}
                        {perks.customItem && (
                          <li className="flex items-start text-sm text-gray-700">
                            <span className="text-green-500 mr-2">✓</span>
                            Custom Design Item
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

