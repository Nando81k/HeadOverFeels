import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/admin/customers/inspectors/ProfileEditInspector', () => ({
  ProfileEditInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="profile-inspector" /> : null,
}))
vi.mock('@/components/admin/customers/inspectors/AnonymizeConfirmDialog', () => ({
  AnonymizeConfirmDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="anonymize-dialog" /> : null,
}))

import { CustomerHeader } from '@/components/admin/customers/detail/CustomerHeader'
import type { CustomerHeaderData } from '@/lib/admin/customers'

const baseHeader: CustomerHeaderData = {
  id: 'c1', email: 'ada@e.com', name: 'Ada Lovelace', phone: '555',
  profilePictureUrl: null, birthday: null, newsletter: true, smsOptIn: false,
  tierId: 't1', tierName: 'Silver', tierSlug: 'silver', tierColor: '#aaa',
  currentPoints: 250, lifetimePoints: 1500,
  totalSpent: 450, totalOrders: 3,
  lastOrderDate: new Date('2026-05-20'), createdAt: new Date('2026-01-15'),
  isAnonymized: false, anonymizedAt: null,
}

beforeEach(() => vi.clearAllMocks())

describe('CustomerHeader', () => {
  it('renders email + name + tier badge + points', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin={false} />)
    expect(screen.getByText('ada@e.com')).toBeTruthy()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText('Silver')).toBeTruthy()
    expect(screen.getByText('250')).toBeTruthy()
  })

  it('renders Anonymized pill when isAnonymized is true', () => {
    render(
      <CustomerHeader
        header={{ ...baseHeader, isAnonymized: true, anonymizedAt: new Date() }}
        isSuperAdmin
      />,
    )
    expect(screen.getByText(/anonymized/i)).toBeTruthy()
  })

  it('renders Active pill when isAnonymized is false', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin={false} />)
    expect(screen.getByText(/active/i)).toBeTruthy()
  })

  it('opens ProfileEditInspector on Edit Profile click', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /edit profile/i }))
    expect(screen.getByTestId('profile-inspector')).toBeTruthy()
  })

  it('Anonymize menuitem hidden when not SUPER_ADMIN', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(screen.queryByRole('menuitem', { name: /anonymize/i })).toBeNull()
  })

  it('opens AnonymizeConfirmDialog when SUPER_ADMIN clicks Anonymize', () => {
    render(<CustomerHeader header={baseHeader} isSuperAdmin />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /anonymize/i }))
    expect(screen.getByTestId('anonymize-dialog')).toBeTruthy()
  })
})
