// tests/unit/shopify/customer-queries.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/customer/client', () => ({ customerFetch: vi.fn() }))

import { customerFetch } from '@/lib/shopify/customer/client'
import { CustomerAccountError } from '@/lib/shopify/customer/errors'
import {
  CUSTOMER_ADDRESS_CREATE_MUTATION,
  CUSTOMER_ADDRESS_DELETE_MUTATION,
  CUSTOMER_ADDRESS_UPDATE_MUTATION,
  CUSTOMER_ADDRESSES_QUERY,
  CUSTOMER_ORDER_QUERY,
  CUSTOMER_ORDERS_QUERY,
  CUSTOMER_SUMMARY_QUERY,
  CUSTOMER_UPDATE_MUTATION,
  createAddress,
  deleteAddress,
  getCustomerAddresses,
  getCustomerOrder,
  getCustomerOrders,
  getCustomerSummary,
  normalizeAddresses,
  normalizeCustomerSummary,
  normalizeOrder,
  normalizeOrdersPage,
  toFulfillmentStatus,
  updateAddress,
  updateCustomer,
  type RawAddressesResponse,
  type RawCustomerSummary,
  type RawOrder,
  type RawOrdersResponse,
} from '@/lib/shopify/customer/queries'
import customerFixture from '@/tests/fixtures/shopify/customer/customer.json'
import addressesFixture from '@/tests/fixtures/shopify/customer/addresses.json'
import orderFixture from '@/tests/fixtures/shopify/customer/order.json'
import ordersFixture from '@/tests/fixtures/shopify/customer/orders.json'

const TOKEN = 'atkn'
const DEFAULT_ADDRESS_ID = 'gid://shopify/CustomerAddress/9312345678?model_name=CustomerAddress'
const OTHER_ADDRESS_ID = 'gid://shopify/CustomerAddress/9312345690?model_name=CustomerAddress'

const fetchMock = () => vi.mocked(customerFetch)

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

beforeEach(() => {
  fetchMock().mockReset()
})

describe('documents', () => {
  it('are the validated Customer Account documents, verbatim', () => {
    expect(CUSTOMER_SUMMARY_QUERY).toBe(
      'query CustomerSummary { customer { id emailAddress { emailAddress } firstName lastName displayName phoneNumber { phoneNumber } defaultAddress { id formatted } } }'
    )
    expect(CUSTOMER_ORDERS_QUERY).toBe(
      'query CustomerOrders($first: Int!, $after: String) { customer { orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) { pageInfo { hasNextPage endCursor } nodes { id name number processedAt financialStatus statusPageUrl fulfillments(first: 1) { nodes { status } } totalPrice { amount currencyCode } lineItems(first: 3) { nodes { id title quantity image { url altText } } } } } } }'
    )
    expect(CUSTOMER_ORDER_QUERY).toBe(
      'query CustomerOrder($id: ID!) { order(id: $id) { id name number processedAt financialStatus cancelledAt statusPageUrl totalPrice { amount currencyCode } subtotal { amount currencyCode } totalShipping { amount currencyCode } totalTax { amount currencyCode } shippingAddress { formatted } lineItems(first: 50) { nodes { id title quantity variantTitle image { url altText } price { amount currencyCode } totalPrice { amount currencyCode } } } fulfillments(first: 10) { nodes { id status createdAt trackingInformation { number company url } } } discountApplications(first: 10) { nodes { value { ... on MoneyV2 { amount currencyCode } ... on PricingPercentageValue { percentage } } } } } }'
    )
    expect(CUSTOMER_ADDRESSES_QUERY).toBe(
      'query CustomerAddresses { customer { defaultAddress { id } addresses(first: 20) { nodes { id firstName lastName company address1 address2 city province zoneCode territoryCode zip phoneNumber formatted } } } }'
    )
    expect(CUSTOMER_ADDRESS_CREATE_MUTATION).toBe(
      'mutation CustomerAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) { customerAddressCreate(address: $address, defaultAddress: $defaultAddress) { customerAddress { id } userErrors { field message code } } }'
    )
    expect(CUSTOMER_ADDRESS_UPDATE_MUTATION).toBe(
      'mutation CustomerAddressUpdate($addressId: ID!, $address: CustomerAddressInput, $defaultAddress: Boolean) { customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) { customerAddress { id } userErrors { field message code } } }'
    )
    expect(CUSTOMER_ADDRESS_DELETE_MUTATION).toBe(
      'mutation CustomerAddressDelete($addressId: ID!) { customerAddressDelete(addressId: $addressId) { deletedAddressId userErrors { field message code } } }'
    )
    expect(CUSTOMER_UPDATE_MUTATION).toBe(
      'mutation CustomerUpdate($input: CustomerUpdateInput!) { customerUpdate(input: $input) { customer { id firstName lastName } userErrors { field message code } } }'
    )
  })
})

describe('customer summary', () => {
  const raw = customerFixture as RawCustomerSummary

  it('normalises the fixture', () => {
    expect(normalizeCustomerSummary(raw)).toEqual({
      id: 'gid://shopify/Customer/8123456789',
      email: 'nando@example.com',
      firstName: 'Nando',
      lastName: 'Alvarez',
      displayName: 'Nando Alvarez',
      phone: '+12125550123',
      defaultAddress: {
        id: DEFAULT_ADDRESS_ID,
        firstName: null,
        lastName: null,
        company: null,
        address1: null,
        address2: null,
        city: null,
        zoneCode: null,
        territoryCode: null,
        zip: null,
        phone: null,
        formatted: ['Nando Alvarez', '221 Bowery', 'Apt 4B', 'New York NY 10012', 'United States'],
        isDefault: true,
      },
    })
  })

  it('tolerates missing email, phone, names and default address', () => {
    const bare = clone(raw)
    const customer = bare.customer!
    customer.emailAddress = null
    customer.phoneNumber = null
    customer.defaultAddress = null
    customer.firstName = null
    customer.lastName = null
    customer.displayName = ''

    expect(normalizeCustomerSummary(bare)).toMatchObject({
      email: '',
      phone: null,
      defaultAddress: null,
      firstName: null,
      lastName: null,
      displayName: '',
    })
  })

  it('getCustomerSummary runs the summary document with the token', async () => {
    fetchMock().mockResolvedValueOnce(clone(raw))

    const summary = await getCustomerSummary(TOKEN)

    expect(summary.email).toBe('nando@example.com')
    expect(fetchMock()).toHaveBeenCalledWith(CUSTOMER_SUMMARY_QUERY, { accessToken: TOKEN })
  })

  it('throws when the customer is null (token not for a customer)', async () => {
    fetchMock().mockResolvedValueOnce({ customer: null })
    await expect(getCustomerSummary(TOKEN)).rejects.toBeInstanceOf(CustomerAccountError)
  })

  it('updateCustomer sends the names, then returns the refreshed summary', async () => {
    fetchMock()
      .mockResolvedValueOnce({
        customerUpdate: {
          customer: { id: 'gid://shopify/Customer/8123456789', firstName: 'Fernando', lastName: 'Alvarez' },
          userErrors: [],
        },
      })
      .mockResolvedValueOnce({
        ...clone(raw),
        customer: { ...clone(raw).customer, firstName: 'Fernando', displayName: 'Fernando Alvarez' },
      })

    const summary = await updateCustomer(TOKEN, { firstName: 'Fernando', lastName: 'Alvarez' })

    expect(fetchMock().mock.calls[0]).toEqual([
      CUSTOMER_UPDATE_MUTATION,
      { accessToken: TOKEN, variables: { input: { firstName: 'Fernando', lastName: 'Alvarez' } } },
    ])
    expect(fetchMock().mock.calls[1]).toEqual([CUSTOMER_SUMMARY_QUERY, { accessToken: TOKEN }])
    expect(summary.firstName).toBe('Fernando')
    expect(summary.displayName).toBe('Fernando Alvarez')
  })

  it('updateCustomer throws CustomerAccountError carrying userErrors and the first code', async () => {
    fetchMock().mockResolvedValueOnce({
      customerUpdate: {
        customer: null,
        userErrors: [{ field: ['input', 'firstName'], message: 'First name is too long', code: 'TOO_LONG' }],
      },
    })

    const error = await updateCustomer(TOKEN, { firstName: 'x'.repeat(300), lastName: 'A' }).catch(
      (e: unknown) => e
    )

    expect(error).toBeInstanceOf(CustomerAccountError)
    expect((error as CustomerAccountError).message).toBe('First name is too long')
    expect((error as CustomerAccountError).code).toBe('TOO_LONG')
    expect((error as CustomerAccountError).userErrors).toEqual([
      { field: ['input', 'firstName'], message: 'First name is too long', code: 'TOO_LONG' },
    ])
    expect(fetchMock()).toHaveBeenCalledTimes(1)
  })
})

describe('orders', () => {
  const raw = ordersFixture as RawOrdersResponse

  it('normalises the list fixture into order cards', () => {
    const page = normalizeOrdersPage(raw)

    expect(page.hasNextPage).toBe(false)
    expect(page.endCursor).toBe('eyJsYXN0X2lkIjo2MTIzNDUwMDA3LCJsYXN0X3ZhbHVlIjoiMjAyNi0wOS0xMiAxNDowMzoxMSJ9')
    expect(page.orders).toHaveLength(2)
    expect(page.orders[0]).toEqual({
      id: 'gid://shopify/Order/6123456789',
      name: '#1012',
      number: 1012,
      processedAt: '2026-10-06T15:42:10Z',
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      total: { amount: '162.88', currencyCode: 'USD' },
      lineItems: [
        {
          id: 'gid://shopify/LineItem/15123456789',
          title: 'Core Hoodie',
          quantity: 2,
          image: {
            url: 'https://cdn.shopify.com/s/files/1/0852/1518/3073/files/core-hoodie-taupe-front.jpg?v=1757188800',
            altText: 'Core Hoodie in Taupe, front',
            width: null,
            height: null,
          },
        },
      ],
      statusPageUrl:
        'https://tgqucm-qg.myshopify.com/85215183073/orders/8d3f0b1c2e4a5f6b7c8d9e0f1a2b3c4d/authenticate?key=0a1b2c3d4e5f60718293a4b5c6d7e8f9',
    })
    expect(page.orders[1]).toMatchObject({ name: '#1007', number: 1007, fulfillmentStatus: 'FULFILLED' })
  })

  it('maps Customer Account fulfillment statuses to the card status', () => {
    expect(toFulfillmentStatus([])).toBe('UNFULFILLED')
    expect(toFulfillmentStatus(null)).toBe('UNFULFILLED')
    expect(toFulfillmentStatus([{ status: 'SUCCESS' }])).toBe('FULFILLED')
    expect(toFulfillmentStatus([{ status: 'OPEN' }])).toBe('IN_PROGRESS')
    expect(toFulfillmentStatus([{ status: 'PENDING' }])).toBe('IN_PROGRESS')
    expect(toFulfillmentStatus([{ status: 'CANCELLED' }])).toBe('CANCELLED')
    expect(toFulfillmentStatus([{ status: 'FAILURE' }])).toBe('UNKNOWN')
    expect(toFulfillmentStatus([{ status: 'ERROR' }])).toBe('UNKNOWN')
    expect(toFulfillmentStatus([{ status: 'SOMETHING_NEW' }])).toBe('UNKNOWN')
  })

  it('handles an empty orders list and missing optional fields', () => {
    const bare = clone(raw)
    const orders = bare.customer!.orders
    orders.nodes = [
      {
        ...orders.nodes[0],
        financialStatus: null,
        statusPageUrl: null,
        fulfillments: { nodes: [] },
        lineItems: { nodes: [{ id: 'gid://shopify/LineItem/1', title: 'x', quantity: 1, image: null }] },
      },
    ]
    orders.pageInfo = { hasNextPage: true, endCursor: 'c' }

    const page = normalizeOrdersPage(bare)
    expect(page).toMatchObject({ hasNextPage: true, endCursor: 'c' })
    expect(page.orders[0]).toMatchObject({
      financialStatus: null,
      statusPageUrl: null,
      fulfillmentStatus: 'UNFULFILLED',
      lineItems: [{ image: null }],
    })

    expect(normalizeOrdersPage({ customer: null })).toEqual({ orders: [], hasNextPage: false, endCursor: null })
  })

  it('getCustomerOrders defaults to first: 10 and forwards the cursor', async () => {
    fetchMock().mockResolvedValue(clone(raw))

    await getCustomerOrders(TOKEN, {})
    expect(fetchMock().mock.calls[0]).toEqual([
      CUSTOMER_ORDERS_QUERY,
      { accessToken: TOKEN, variables: { first: 10, after: null } },
    ])

    const page = await getCustomerOrders(TOKEN, { first: 5, after: 'cursor-1' })
    expect(fetchMock().mock.calls[1]).toEqual([
      CUSTOMER_ORDERS_QUERY,
      { accessToken: TOKEN, variables: { first: 5, after: 'cursor-1' } },
    ])
    expect(page.orders).toHaveLength(2)
  })

  it('normalises the order detail fixture', () => {
    const order = normalizeOrder((orderFixture as { order: RawOrder }).order)

    expect(order).toEqual({
      id: 'gid://shopify/Order/6123456789',
      name: '#1012',
      number: 1012,
      processedAt: '2026-10-06T15:42:10Z',
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      total: { amount: '162.88', currencyCode: 'USD' },
      lineItems: [
        {
          id: 'gid://shopify/LineItem/15123456789',
          title: 'Core Hoodie',
          quantity: 2,
          image: {
            url: 'https://cdn.shopify.com/s/files/1/0852/1518/3073/files/core-hoodie-taupe-front.jpg?v=1757188800',
            altText: 'Core Hoodie in Taupe, front',
            width: null,
            height: null,
          },
        },
      ],
      statusPageUrl:
        'https://tgqucm-qg.myshopify.com/85215183073/orders/8d3f0b1c2e4a5f6b7c8d9e0f1a2b3c4d/authenticate?key=0a1b2c3d4e5f60718293a4b5c6d7e8f9',
      subtotal: { amount: '149.6', currencyCode: 'USD' },
      shipping: { amount: '0.0', currencyCode: 'USD' },
      tax: { amount: '13.28', currencyCode: 'USD' },
      cancelledAt: null,
      shippingAddress: ['Nando Alvarez', '221 Bowery', 'Apt 4B', 'New York NY 10012', 'United States'],
      discounts: [{ amount: null, percentage: 15 }],
      lines: [
        {
          id: 'gid://shopify/LineItem/15123456789',
          title: 'Core Hoodie',
          variantTitle: 'Taupe / M',
          quantity: 2,
          image: {
            url: 'https://cdn.shopify.com/s/files/1/0852/1518/3073/files/core-hoodie-taupe-front.jpg?v=1757188800',
            altText: 'Core Hoodie in Taupe, front',
            width: null,
            height: null,
          },
          unitPrice: { amount: '88.0', currencyCode: 'USD' },
          total: { amount: '176.0', currencyCode: 'USD' },
        },
      ],
      fulfillments: [
        {
          id: 'gid://shopify/Fulfillment/5123456789',
          status: 'SUCCESS',
          createdAt: '2026-10-07T18:20:00Z',
          tracking: [
            {
              number: '1Z999AA10123456784',
              company: 'UPS',
              url: 'https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784',
            },
          ],
        },
      ],
    })
  })

  it('normalises amount discounts, missing money fields and a cancelled order', () => {
    const detail = clone((orderFixture as { order: RawOrder }).order)
    detail.cancelledAt = '2026-10-08T09:00:00Z'
    detail.subtotal = null
    detail.totalShipping = null
    detail.totalTax = null
    detail.shippingAddress = null
    detail.discountApplications = { nodes: [{ value: { amount: '10.0', currencyCode: 'USD' } }, { value: {} }] }
    detail.fulfillments = { nodes: [{ id: 'f', status: 'CANCELLED', createdAt: 'c', trackingInformation: [] }] }
    const [line] = detail.lineItems!.nodes
    line.price = null
    line.totalPrice = null
    line.variantTitle = null

    const order = normalizeOrder(detail)
    expect(order).toMatchObject({
      cancelledAt: '2026-10-08T09:00:00Z',
      subtotal: null,
      shipping: null,
      tax: null,
      shippingAddress: null,
      fulfillmentStatus: 'CANCELLED',
      discounts: [
        { amount: { amount: '10.0', currencyCode: 'USD' }, percentage: null },
        { amount: null, percentage: null },
      ],
      lines: [{ unitPrice: null, total: null, variantTitle: null }],
      fulfillments: [{ tracking: [] }],
    })
  })

  it('getCustomerOrder returns the order or null when Shopify returns order: null', async () => {
    fetchMock().mockResolvedValueOnce(clone(orderFixture))
    const order = await getCustomerOrder(TOKEN, 'gid://shopify/Order/6123456789')
    expect(order?.name).toBe('#1012')
    expect(fetchMock()).toHaveBeenCalledWith(CUSTOMER_ORDER_QUERY, {
      accessToken: TOKEN,
      variables: { id: 'gid://shopify/Order/6123456789' },
    })

    fetchMock().mockResolvedValueOnce({ order: null })
    await expect(getCustomerOrder(TOKEN, 'gid://shopify/Order/0')).resolves.toBeNull()
  })
})

describe('addresses', () => {
  const raw = addressesFixture as RawAddressesResponse

  it('normalises the fixture and flags the default address', () => {
    const addresses = normalizeAddresses(raw)

    expect(addresses).toHaveLength(2)
    expect(addresses[0]).toEqual({
      id: DEFAULT_ADDRESS_ID,
      firstName: 'Nando',
      lastName: 'Alvarez',
      company: null,
      address1: '221 Bowery',
      address2: 'Apt 4B',
      city: 'New York',
      zoneCode: 'NY',
      territoryCode: 'US',
      zip: '10012',
      phone: '+12125550123',
      formatted: ['Nando Alvarez', '221 Bowery', 'Apt 4B', 'New York NY 10012', 'United States'],
      isDefault: true,
    })
    expect(addresses[1]).toMatchObject({
      id: OTHER_ADDRESS_ID,
      company: 'Head Over Feels Studio',
      address2: null,
      phone: null,
      isDefault: false,
    })
  })

  it('returns an empty list when the customer has no addresses', () => {
    expect(normalizeAddresses({ customer: { defaultAddress: null, addresses: { nodes: [] } } })).toEqual([])
    expect(normalizeAddresses({ customer: null })).toEqual([])
  })

  it('getCustomerAddresses runs the addresses document', async () => {
    fetchMock().mockResolvedValueOnce(clone(raw))
    const addresses = await getCustomerAddresses(TOKEN)
    expect(addresses.map((a) => a.isDefault)).toEqual([true, false])
    expect(fetchMock()).toHaveBeenCalledWith(CUSTOMER_ADDRESSES_QUERY, { accessToken: TOKEN })
  })

  it('createAddress maps the input to CustomerAddressInput (phone → phoneNumber) and returns the fresh list', async () => {
    fetchMock()
      .mockResolvedValueOnce({
        customerAddressCreate: { customerAddress: { id: 'gid://shopify/CustomerAddress/1' }, userErrors: [] },
      })
      .mockResolvedValueOnce(clone(raw))

    const addresses = await createAddress(TOKEN, {
      firstName: 'Nando',
      lastName: 'Alvarez',
      company: null,
      address1: '47 Greenpoint Ave',
      address2: null,
      city: 'Brooklyn',
      zoneCode: 'NY',
      territoryCode: 'US',
      zip: '11222',
      phone: '+17185550199',
      defaultAddress: true,
    })

    expect(fetchMock().mock.calls[0]).toEqual([
      CUSTOMER_ADDRESS_CREATE_MUTATION,
      {
        accessToken: TOKEN,
        variables: {
          address: {
            firstName: 'Nando',
            lastName: 'Alvarez',
            company: null,
            address1: '47 Greenpoint Ave',
            address2: null,
            city: 'Brooklyn',
            zoneCode: 'NY',
            territoryCode: 'US',
            zip: '11222',
            phoneNumber: '+17185550199',
          },
          defaultAddress: true,
        },
      },
    ])
    expect(fetchMock().mock.calls[1][0]).toBe(CUSTOMER_ADDRESSES_QUERY)
    expect(addresses).toHaveLength(2)
  })

  it('createAddress omits defaultAddress when not given and surfaces userErrors', async () => {
    fetchMock().mockResolvedValueOnce({
      customerAddressCreate: {
        customerAddress: null,
        userErrors: [{ field: ['address', 'zip'], message: 'Zip is invalid', code: 'INVALID' }],
      },
    })

    const error = await createAddress(TOKEN, {
      firstName: null,
      lastName: null,
      company: null,
      address1: null,
      address2: null,
      city: null,
      zoneCode: null,
      territoryCode: 'US',
      zip: 'nope',
      phone: null,
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CustomerAccountError)
    expect((error as CustomerAccountError).code).toBe('INVALID')
    expect((error as Error).message).toBe('Zip is invalid')
    expect(fetchMock().mock.calls[0][1]).toEqual({
      accessToken: TOKEN,
      variables: {
        address: {
          firstName: null,
          lastName: null,
          company: null,
          address1: null,
          address2: null,
          city: null,
          zoneCode: null,
          territoryCode: 'US',
          zip: 'nope',
          phoneNumber: null,
        },
      },
    })
    expect(fetchMock()).toHaveBeenCalledTimes(1)
  })

  it('updateAddress sends addressId + address (+ defaultAddress) and returns the fresh list', async () => {
    fetchMock()
      .mockResolvedValueOnce({
        customerAddressUpdate: { customerAddress: { id: OTHER_ADDRESS_ID }, userErrors: [] },
      })
      .mockResolvedValueOnce(clone(raw))

    const addresses = await updateAddress(TOKEN, OTHER_ADDRESS_ID, {
      firstName: 'Nando',
      lastName: 'Alvarez',
      company: 'HOF',
      address1: '47 Greenpoint Ave',
      address2: 'Unit 2',
      city: 'Brooklyn',
      zoneCode: 'NY',
      territoryCode: 'US',
      zip: '11222',
      phone: null,
      defaultAddress: false,
    })

    expect(fetchMock().mock.calls[0]).toEqual([
      CUSTOMER_ADDRESS_UPDATE_MUTATION,
      {
        accessToken: TOKEN,
        variables: {
          addressId: OTHER_ADDRESS_ID,
          address: {
            firstName: 'Nando',
            lastName: 'Alvarez',
            company: 'HOF',
            address1: '47 Greenpoint Ave',
            address2: 'Unit 2',
            city: 'Brooklyn',
            zoneCode: 'NY',
            territoryCode: 'US',
            zip: '11222',
            phoneNumber: null,
          },
          defaultAddress: false,
        },
      },
    ])
    expect(addresses).toHaveLength(2)
  })

  it('deleteAddress returns the deleted id and surfaces userErrors', async () => {
    fetchMock().mockResolvedValueOnce({
      customerAddressDelete: { deletedAddressId: OTHER_ADDRESS_ID, userErrors: [] },
    })
    await expect(deleteAddress(TOKEN, OTHER_ADDRESS_ID)).resolves.toBe(OTHER_ADDRESS_ID)
    expect(fetchMock()).toHaveBeenCalledWith(CUSTOMER_ADDRESS_DELETE_MUTATION, {
      accessToken: TOKEN,
      variables: { addressId: OTHER_ADDRESS_ID },
    })

    fetchMock().mockResolvedValueOnce({
      customerAddressDelete: {
        deletedAddressId: null,
        userErrors: [{ field: null, message: "Can't delete the default address", code: 'INVALID' }],
      },
    })
    await expect(deleteAddress(TOKEN, DEFAULT_ADDRESS_ID)).rejects.toThrow("Can't delete the default address")
  })

  it('throws when a mutation payload is missing', async () => {
    fetchMock().mockResolvedValueOnce({ customerAddressDelete: null })
    await expect(deleteAddress(TOKEN, OTHER_ADDRESS_ID)).rejects.toBeInstanceOf(CustomerAccountError)
  })
})
