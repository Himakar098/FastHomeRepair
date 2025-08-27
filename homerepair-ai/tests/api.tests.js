// tests/api.test.js
const axios = require('axios');

const API_BASE = 'https://homerepair-api.azurewebsites.net/api'; // Adjust based on your environment

describe('Home Repair AI API Tests', () => {
  test('Chat handler responds to simple query', async () => {
    const response = await axios.post(`${API_BASE}/chat-handler`, {
      message: 'My oven has stains, how can I clean it?',
      userId: 'test-user-123'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.response).toBeDefined();
    expect(response.data.conversationId).toBeDefined();
  });
  
  test('Product matcher finds relevant products', async () => {
    const response = await axios.post(`${API_BASE}/product-matcher`, {
      problem: 'oven cleaning',
      location: 'Perth'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.products).toBeInstanceOf(Array);
    expect(response.data.products.length).toBeGreaterThan(0);
  });
  
  test('Image analyzer processes uploaded image', async () => {
    // Note: This would require a test image
    const response = await axios.post(`${API_BASE}/image-analyzer`, {
      imageUrl: 'https://example.com/test-oven-stain.jpg',
      problemContext: 'oven cleaning'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.analysis).toBeDefined();
  });
});