const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../middleware/errorHandler');

// Mock the routes (simplified for testing)
const app = express();
app.use(express.json());

// Mock route
app.post('/api/vote', (req, res) => {
  const { userId, proposalId, choice } = req.body;
  if (!userId || !proposalId || !choice) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  res.status(200).json({ success: true, transactionId: 'mock-tx-123' });
});

// Apply error handler
app.use(errorHandler);

describe('API Integration Tests', () => {
  describe('POST /api/vote', () => {
    test('should accept valid vote submission', async () => {
      const response = await request(app)
        .post('/api/vote')
        .send({ userId: 'user123', proposalId: 'prop456', choice: 'yes' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('transactionId');
    });

    test('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/vote')
        .send({ userId: 'user123' }) // Missing proposalId and choice
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });

    test('should handle unexpected errors gracefully', async () => {
      // Simulate an error by mocking the route to throw
      app.post('/api/vote', (req, res, next) => {
        next(new Error('Unexpected error'));
      });

      const response = await request(app)
        .post('/api/vote')
        .send({ userId: 'user123', proposalId: 'prop456', choice: 'yes' })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('An unexpected error occurred');
    });
  });
});