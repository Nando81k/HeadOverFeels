// tests/setup.ts
import { beforeAll, afterAll, vi } from 'vitest'

// Mock environment variables
process.env.DATABASE_URL = 'file:./test.db'
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock'
process.env.RESEND_API_KEY = 're_mock'

// Mock fetch for API tests
global.fetch = vi.fn()

// Mock console.error for cleaner test output
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})
