import { loadCustomerAddresses } from '@/lib/admin/customers'
import { CustomerAddressesPanelClient } from './CustomerAddressesPanelClient'

export interface CustomerAddressesPanelProps {
  customerId: string
}

export async function CustomerAddressesPanel({ customerId }: CustomerAddressesPanelProps) {
  const addresses = await loadCustomerAddresses(customerId)
  return <CustomerAddressesPanelClient customerId={customerId} addresses={addresses} />
}
