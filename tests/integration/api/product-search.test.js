// tests/integration/api/product-search.test.js
const request = require('supertest');
const app = require('../../app'); // Adjust path if needed

describe('GET /api/products/search', () => {
  it('should return results for a valid query', async () => {
    const res = await request(app)
      .get('/api/products/search')
      .query({ q: 'shirt' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Add more tests for filters, pagination, empty results, etc.
});
