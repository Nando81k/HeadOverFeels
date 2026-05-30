// tests/setup.ts
import '@testing-library/jest-dom/vitest'
import { beforeAll, afterAll, vi } from 'vitest'

// Mock environment variables
process.env.DATABASE_URL = 'file:./test.db'
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock'
process.env.RESEND_API_KEY = 're_mock'

// Mock fetch for API tests
global.fetch = vi.fn()

// IntersectionObserver is not implemented in jsdom (used by framer-motion whileInView)
// Must be a real class so `new IntersectionObserver()` works
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = () => []
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.IntersectionObserver = MockIntersectionObserver as any

// Mock console.error for cleaner test output
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})
