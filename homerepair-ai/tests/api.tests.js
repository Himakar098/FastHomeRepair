// tests/api.tests.js
const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:7071/api';
const AUTH_TOKEN = process.env.API_BEARER_TOKEN;

if (!AUTH_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn('Skipping API tests because API_BEARER_TOKEN is not set.');
}

const maybeTest = AUTH_TOKEN ? test : test.skip;

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}
});

describe('Home Repair AI API Tests', () => {
  maybeTest('Chat handler responds to simple query', async () => {
    const response = await client.post('/chat-handler', {
      message: 'My oven has stains, how can I clean it?'
    });

    expect(response.status).toBe(200);
    expect(response.data.response).toBeDefined();
    expect(response.data.conversationId).toBeDefined();
  });

  maybeTest('Product matcher finds relevant products', async () => {
    const response = await client.post('/product-matcher', {
      problem: 'oven cleaning',
      location: 'Perth'
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.products)).toBe(true);
  });

  maybeTest('Image analyzer processes uploaded image', async () => {
    const response = await client.post('/image-analyzer', {
      imageUrl: 'https://via.placeholder.com/600x400.png',
      problemContext: 'oven cleaning'
    });

    expect(response.status).toBe(200);
    expect(response.data.analysis).toBeDefined();
  });
});
