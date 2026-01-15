// tests/integration/api/checkout.test.js
const request = require('supertest');
const app = require('../../app'); // Adjust path if needed

describe('POST /api/checkout', () => {
  it('should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/checkout')
      .send({ cart: [] });
    expect(res.statusCode).toBe(401);
  });

  // Add more tests for authenticated checkout, Stripe payment success/failure, etc.
});
