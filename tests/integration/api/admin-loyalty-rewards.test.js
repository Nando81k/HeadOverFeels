// tests/integration/api/admin-loyalty-rewards.test.js
const request = require('supertest');
const app = require('../../app'); // Adjust path if needed

describe('GET /api/admin/loyalty/rewards', () => {
  it('should require authentication', async () => {
    const res = await request(app).get('/api/admin/loyalty/rewards');
    expect(res.statusCode).toBe(401);
  });

  // Add more integration tests for authenticated requests, pagination, etc.
});
