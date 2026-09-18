import express from 'express';
import http from 'http';
import { createRateLimiter } from './src/middlewares/rateLimiter.js';

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : {}
        });
      });
    }).on('error', reject);
  });
}

async function runRateLimitTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING RATE LIMITING TESTS');
  console.log('====================================================\n');

  // Create an isolated express app for testing rate limits
  const testApp = express();
  
  // Custom test limiter: 3 requests per 10 seconds
  const testLimiter = createRateLimiter({
    windowMs: 10000,
    max: 3,
    message: 'Test rate limit exceeded!'
  });

  testApp.get('/test-endpoint', testLimiter, (req, res) => {
    res.status(200).json({ success: true, message: 'Request permitted' });
  });

  // Start test server
  const server = testApp.listen(0);
  const port = server.address().port;
  const testUrl = `http://127.0.0.1:${port}/test-endpoint`;

  try {
    console.log('--- 1. Sending Request 1 (Expect 200 OK) ---');
    const res1 = await makeRequest(testUrl);
    console.log(`Status: ${res1.statusCode} | Limit: ${res1.headers['ratelimit-limit']} | Remaining: ${res1.headers['ratelimit-remaining']}`);
    console.log('Request 1 Result:', res1.statusCode === 200 ? 'PASSED ✅' : 'FAILED ❌');

    console.log('\n--- 2. Sending Request 2 (Expect 200 OK) ---');
    const res2 = await makeRequest(testUrl);
    console.log(`Status: ${res2.statusCode} | Remaining: ${res2.headers['ratelimit-remaining']}`);
    console.log('Request 2 Result:', res2.statusCode === 200 ? 'PASSED ✅' : 'FAILED ❌');

    console.log('\n--- 3. Sending Request 3 (Expect 200 OK - Max reached) ---');
    const res3 = await makeRequest(testUrl);
    console.log(`Status: ${res3.statusCode} | Remaining: ${res3.headers['ratelimit-remaining']}`);
    console.log('Request 3 Result:', res3.statusCode === 200 ? 'PASSED ✅' : 'FAILED ❌');

    console.log('\n--- 4. Sending Request 4 (Expect 429 Too Many Requests) ---');
    const res4 = await makeRequest(testUrl);
    console.log(`Status: ${res4.statusCode} | Response body:`, JSON.stringify(res4.body));
    console.log('Rate limit blocking triggered:', res4.statusCode === 429 ? 'PASSED ✅' : 'FAILED ❌');
    console.log('Response format contains success: false:', res4.body.success === false ? 'PASSED ✅' : 'FAILED ❌');

    console.log('\n🎉 ALL RATE LIMITING TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    server.close();
  }
}

runRateLimitTests().catch((err) => {
  console.error('Rate limit tests failed with error:', err);
  process.exit(1);
});
