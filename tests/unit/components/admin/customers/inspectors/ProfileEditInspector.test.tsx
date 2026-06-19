import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateCustomerProfile = vi.fn()
vi.mock('@/app/admin/customers/actions', () => ({
  updateCustomerProfile: (...a: unknown[]) => updateCustomerProfile(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { ProfileEditInspector } from '@/components/admin/customers/inspectors/ProfileEditInspector'
import type { CustomerHeaderData } from '@/lib/admin/customers'

const header: CustomerHeaderData = {
  id: 'c1', email: 'ada@e.com', name: 'Ada', phone: '555',
  profilePictureUrl: null, birthday: null, newsletter: true, smsOptIn: false,
  tierId: null, tierName: null, tierSlug: null, tierColor: null,
  currentPoints: 0, lifetimePoints: 0, totalSpent: 0, totalOrders: 0,
  lastOrderDate: null, createdAt: new Date(), isAnonymized: false, anonymizedAt: null,
}

beforeEach(() => vi.clearAllMocks())

describe('ProfileEditInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ProfileEditInspector open={false} header={header} onClose={() => {}} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders form with current values', () => {
    render(<ProfileEditInspector open header={header} onClose={() => {}} />)
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Ada')
    expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe('555')
  })

  it('email field disabled (not editable v1)', () => {
    render(<ProfileEditInspector open header={header} onClose={() => {}} />)
    const email = screen.getByLabelText(/email/i) as HTMLInputElement
    expect(email.disabled).toBe(true)
  })

  it('submits updateCustomerProfile with changed fields', async () => {
    updateCustomerProfile.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(<ProfileEditInspector open header={header} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada L' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateCustomerProfile).toHaveBeenCalled())
    const [id, input] = updateCustomerProfile.mock.calls[0]
    expect(id).toBe('c1')
    expect(input.name).toBe('Ada L')
  })
})
