// scripts/load-test.js
const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:7071/api';
const AUTH_TOKEN = process.env.API_BEARER_TOKEN;

if (!AUTH_TOKEN) {
  console.error('API_BEARER_TOKEN environment variable is required to run the load test.');
  process.exit(1);
}

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
});

const testQueries = [
  'My oven has burnt stains',
  'There\'s a hole in my wall',
  'Kitchen benchtop is damaged',
  'Leaky tap in bathroom',
  'Paint peeling on ceiling'
];

async function loadTest() {
  const promises = [];
  
  for (let i = 0; i < 50; i++) {
    const query = testQueries[i % testQueries.length];
    const promise = client.post('/chat-handler', {
      message: query,
      userId: `load-test-user-${i}`
    });
    promises.push(promise);
  }
  
  const startTime = Date.now();
  const results = await Promise.allSettled(promises);
  const endTime = Date.now();
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`Load test results:`);
  console.log(`Total requests: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total time: ${endTime - startTime}ms`);
  console.log(`Average time per request: ${(endTime - startTime) / results.length}ms`);
}

loadTest().catch(console.error);
