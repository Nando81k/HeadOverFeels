// tests/unit/scripts/shopify-poll-product-operation.test.ts
import { describe, it, expect, vi } from 'vitest'

import {
  pollProductOperation,
  PRODUCT_OPERATION_QUERY,
  type ProductOperationResponse,
} from '@/scripts/shopify/lib/poll-product-operation'

const OPERATION_ID = 'gid://shopify/ProductSetOperation/1'

function completeResponse(): ProductOperationResponse {
  return {
    productOperation: {
      status: 'COMPLETE',
      product: {
        id: 'gid://shopify/Product/1',
        handle: 'tokyo-nights-hoodie',
        variants: {
          nodes: [
            { id: 'gid://shopify/ProductVariant/1', sku: 'HOF-1' },
            { id: 'gid://shopify/ProductVariant/2', sku: 'HOF-2' },
          ],
        },
      },
      userErrors: [],
    },
  }
}

function createdResponse(): ProductOperationResponse {
  return { productOperation: { status: 'CREATED', product: null, userErrors: [] } }
}

describe('pollProductOperation', () => {
  it('polls until COMPLETE and returns the product + variant ids', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(createdResponse())
      .mockResolvedValueOnce(createdResponse())
      .mockResolvedValueOnce(completeResponse())
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await pollProductOperation(OPERATION_ID, { request, sleep, intervalMs: 1500 })

    expect(request).toHaveBeenCalledTimes(3)
    expect(request).toHaveBeenLastCalledWith(PRODUCT_OPERATION_QUERY, { id: OPERATION_ID })
    expect(sleep).toHaveBeenCalledWith(1500)
    expect(result).toEqual({
      productId: 'gid://shopify/Product/1',
      handle: 'tokyo-nights-hoodie',
      variants: [
        { id: 'gid://shopify/ProductVariant/1', sku: 'HOF-1' },
        { id: 'gid://shopify/ProductVariant/2', sku: 'HOF-2' },
      ],
    })
  })

  it('returns immediately when the first poll is already COMPLETE', async () => {
    const request = vi.fn().mockResolvedValue(completeResponse())
    const sleep = vi.fn().mockResolvedValue(undefined)

    await pollProductOperation(OPERATION_ID, { request, sleep })

    expect(request).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('throws with the userErrors when the operation FAILED', async () => {
    const request = vi.fn().mockResolvedValue({
      productOperation: {
        status: 'FAILED',
        product: null,
        userErrors: [{ field: ['input', 'handle'], message: 'Handle is taken', code: 'TAKEN' }],
      },
    } satisfies ProductOperationResponse)

    await expect(
      pollProductOperation(OPERATION_ID, { request, sleep: vi.fn().mockResolvedValue(undefined) })
    ).rejects.toThrow(/Handle is taken/)
  })

  it('throws when the operation cannot be found', async () => {
    const request = vi.fn().mockResolvedValue({ productOperation: null })

    await expect(
      pollProductOperation(OPERATION_ID, { request, sleep: vi.fn().mockResolvedValue(undefined) })
    ).rejects.toThrow(/not found/i)
  })

  it('throws once the timeout elapses', async () => {
    const request = vi.fn().mockResolvedValue(createdResponse())
    const sleep = vi.fn().mockResolvedValue(undefined)
    let now = 0
    const clock = () => {
      now += 1000
      return now
    }

    await expect(
      pollProductOperation(OPERATION_ID, {
        request,
        sleep,
        intervalMs: 10,
        timeoutMs: 3000,
        now: clock,
      })
    ).rejects.toThrow(/timed out/i)
    expect(request.mock.calls.length).toBeGreaterThan(0)
  })
})
