import { loadCustomerRisk } from '@/lib/admin/customers'

export interface CustomerRiskWidgetProps {
  customerId: string
}

export async function CustomerRiskWidget({ customerId }: CustomerRiskWidgetProps) {
  const r = await loadCustomerRisk(customerId)

  // High risk when refund rate exceeds 20% OR any chargebacks exist.
  const isHighRisk = r.refundRate > 20 || r.chargebackCount > 0

  return (
    <section
      className={`border rounded-md ${
        isHighRisk
          ? 'bg-red-500/5 border-red-500/30'
          : 'bg-neutral-900/60 border-white/8'
      }`}
    >
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Risk</h2>
        {isHighRisk && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-200 font-semibold">
            High risk
          </span>
        )}
      </header>
      <div className="p-3 grid grid-cols-2 gap-3 text-xs text-white/60">
        <div>
          <div className="text-white text-base">{r.refundRate.toFixed(1)}%</div>
          <div>Refund rate ({r.refundCount}/{r.totalOrders})</div>
        </div>
        <div>
          <div className="text-white text-base">{r.returnRate.toFixed(1)}%</div>
          <div>Return rate ({r.returnCount}/{r.totalOrders})</div>
        </div>
        <div>
          <div className="text-white text-base">{r.chargebackCount}</div>
          <div>Chargebacks</div>
        </div>
        <div>
          <div className="text-white text-base">{r.avgDaysToReturn.toFixed(0)}d</div>
          <div>Avg days to return</div>
        </div>
      </div>
    </section>
  )
}
