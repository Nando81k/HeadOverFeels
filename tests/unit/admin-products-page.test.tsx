/* eslint-disable @next/next/no-img-element */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductsPage from '@/app/admin/products/page'

const { getAllMock, updateMock, deleteMock } = vi.hoisted(() => ({
  getAllMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: (props: ComponentPropsWithoutRef<'img'>) => <img {...props} alt={props.alt || ''} />,
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

vi.mock('@/components/admin/RestockModal', () => ({
  RestockModal: () => null,
}))

vi.mock('@/components/admin/ProductSlideOver', () => ({
  ProductSlideOver: () => null,
}))

vi.mock('@/components/admin/ProductMobileCard', () => ({
  ProductMobileCard: ({ product }: { product: { name: string } }) => <div>{product.name}</div>,
}))

vi.mock('@/lib/toast', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/api/products', () => ({
  productApi: {
    getAll: getAllMock,
    update: updateMock,
    delete: deleteMock,
  },
}))

describe('Admin products page operator toolbar', () => {
  beforeEach(() => {
    getAllMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'prod-1',
            name: 'Navy Hoodie',
            slug: 'navy-hoodie',
            price: 80,
            images: JSON.stringify(['/hoodie.jpg']),
            isActive: true,
            isFeatured: false,
            variants: [
              { id: 'var-1', sku: 'SKU-1', inventory: 4, size: 'M', color: 'Navy', isActive: true },
              { id: 'var-2', sku: 'SKU-2', inventory: 3, size: 'L', color: 'Navy', isActive: true },
            ],
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          {
            id: 'prod-2',
            name: 'Cream Tee',
            slug: 'cream-tee',
            price: 40,
            images: JSON.stringify(['/tee.jpg']),
            isActive: false,
            isFeatured: false,
            variants: [{ id: 'var-3', sku: 'SKU-3', inventory: 30, size: 'M', color: 'Cream', isActive: true }],
            createdAt: '2026-03-02T00:00:00.000Z',
            updatedAt: '2026-03-02T00:00:00.000Z',
          },
        ],
      },
    })

    updateMock.mockResolvedValue({ data: {} })
    deleteMock.mockResolvedValue({ data: {} })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: {
            summary: {
              totalRevenue: 5000,
              totalUnitsSold: 25,
              avgMarginPercent: 35,
              bestSeller: {
                productId: 'prod-1',
                productName: 'Navy Hoodie',
                revenue: 4000,
                unitsSold: 18,
              },
              totalCostOfGoods: 0,
              totalGrossProfit: 0,
              lowMarginCount: 1,
            },
            products: [],
          },
        }),
      })
    )
  })

  it('applies debounced search, quick chip filters, and clear all', async () => {
    render(<ProductsPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Navy Hoodie').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Cream Tee').length).toBeGreaterThan(0)
    })

    fireEvent.change(screen.getByPlaceholderText('Search products or slugs...'), {
      target: { value: 'navy' },
    })

    await waitFor(() => {
      expect(screen.getAllByText('Navy Hoodie').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('Cream Tee')).toHaveLength(0)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Low Stock' }))

    await waitFor(() => {
      expect(screen.getAllByText('Navy Hoodie').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('Cream Tee')).toHaveLength(0)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))

    await waitFor(() => {
      expect(screen.getAllByText('Navy Hoodie').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Cream Tee').length).toBeGreaterThan(0)
    })
  })
})
