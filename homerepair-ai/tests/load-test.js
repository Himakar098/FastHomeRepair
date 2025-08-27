// scripts/load-test.js
const axios = require('axios');

const API_BASE = 'https://homerepair-api.azurewebsites.net/api';

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
    const promise = axios.post(`${API_BASE}/chat-handler`, {
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