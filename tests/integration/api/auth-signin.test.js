// tests/integration/api/auth-signin.test.js
const request = require('supertest');
const app = require('../../app'); // Adjust path if needed

describe('POST /api/auth/signin', () => {
  it('should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'wrong@example.com', password: 'badpass' });
    expect(res.statusCode).toBe(401);
  });

  // Add more tests for valid credentials, session creation, etc.
});
