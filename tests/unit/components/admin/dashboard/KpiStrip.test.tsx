// tests/unit/components/admin/dashboard/KpiStrip.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KpiStrip } from '@/components/admin/dashboard/KpiStrip'

const data = {
  unitsSold: { value: 47, trend: { direction: 'up' as const, text: '↑ 8%' } },
  aov: { value: '$179', trend: { direction: 'up' as const, text: '↑ 3.7%' } },
  newCustomers: { value: 12, trend: { direction: 'flat' as const, text: '— 0%' } },
  cvr: { value: '3.4%', trend: { direction: 'down' as const, text: '↓ 0.2%' } },
}

describe('KpiStrip', () => {
  it('renders all 4 KPI labels + values', () => {
    render(<KpiStrip data={data} />)
    expect(screen.getByText('UNITS SOLD')).toBeInTheDocument()
    expect(screen.getByText('AOV')).toBeInTheDocument()
    expect(screen.getByText('NEW CUSTOMERS')).toBeInTheDocument()
    expect(screen.getByText('CVR')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('$179')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3.4%')).toBeInTheDocument()
  })
})
