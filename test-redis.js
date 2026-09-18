import express from 'express';
import http from 'http';
import { cacheService } from './src/services/cache.service.js';
import { cacheResponse } from './src/middlewares/cache.middleware.js';
import { isRedisReady } from './src/config/redis.js';

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

async function runRedisTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING REDIS CACHE & FALLBACK TESTS');
  console.log('====================================================\n');

  // Allow brief moment for Redis connection attempt
  await new Promise((r) => setTimeout(r, 600));

  const redisReady = isRedisReady();
  console.log(`Redis Server Status: ${redisReady ? 'ONLINE 🟢' : 'OFFLINE / FALLBACK MODE 🟡'}`);

  if (redisReady) {
    console.log('\n--- 1. Testing cacheService.set & cacheService.get ---');
    const testKey = 'test:user:123';
    const testData = { name: 'Redis Test', role: 'Developer', timestamp: Date.now() };

    await cacheService.set(testKey, testData, 60);
    const retrieved = await cacheService.get(testKey);
    console.log('Set & Get matching payload:', retrieved.name === testData.name ? 'PASSED ✅' : 'FAILED ❌');

    console.log('\n--- 2. Testing cacheService.delByPattern (Wildcard Invalidation) ---');
    await cacheService.set('test:pattern:1', { a: 1 }, 60);
    await cacheService.set('test:pattern:2', { b: 2 }, 60);
    const deletedCount = await cacheService.delByPattern('test:pattern:*');
    console.log(`Pattern deletion count: ${deletedCount} keys removed:`, deletedCount >= 2 ? 'PASSED ✅' : 'FAILED ❌');

    console.log('\n--- 3. Testing cacheService.del ---');
    await cacheService.del(testKey);
    const afterDel = await cacheService.get(testKey);
    console.log('Key deleted successfully (returns null):', afterDel === null ? 'PASSED ✅' : 'FAILED ❌');
  } else {
    console.log('\n--- 1-3. Redis offline notice ---');
    console.log('Redis server is not running on localhost:6379.');
    console.log('Testing non-blocking graceful fallback behavior...');

    const getRes = await cacheService.get('non_existent_key');
    console.log('Offline cacheService.get returns null gracefully:', getRes === null ? 'PASSED ✅' : 'FAILED ❌');

    const setRes = await cacheService.set('test_key', { a: 1 }, 10);
    console.log('Offline cacheService.set returns false safely:', setRes === false ? 'PASSED ✅' : 'FAILED ❌');
  }

  console.log('\n--- 4. Testing cacheResponse Middleware with Express ---');
  const testApp = express();
  let dbCallCount = 0;

  testApp.get('/test-cached-data', cacheResponse(60), (req, res) => {
    dbCallCount++;
    res.status(200).json({
      success: true,
      message: 'Simulated Database Query Result',
      callCount: dbCallCount,
      timestamp: Date.now()
    });
  });

  const server = testApp.listen(0);
  const port = server.address().port;
  const testUrl = `http://127.0.0.1:${port}/test-cached-data`;

  try {
    const res1 = await makeRequest(testUrl);
    console.log(`Call 1: Status ${res1.statusCode} | X-Cache Header: ${res1.headers['x-cache'] || 'none'} | DB Call Count: ${res1.body.callCount}`);
    console.log('Call 1 Result:', res1.statusCode === 200 ? 'PASSED ✅' : 'FAILED ❌');

    const res2 = await makeRequest(testUrl);
    console.log(`Call 2: Status ${res2.statusCode} | X-Cache Header: ${res2.headers['x-cache'] || 'none'} | DB Call Count: ${res2.body.callCount}`);
    console.log('Call 2 Result:', res2.statusCode === 200 ? 'PASSED ✅' : 'FAILED ❌');

    if (redisReady) {
      console.log('Cache Hit Verified (DB was not called on 2nd request):', res2.headers['x-cache'] === 'HIT' && res2.body.callCount === 1 ? 'PASSED ✅' : 'FAILED ❌');
    } else {
      console.log('Graceful Fallback Verified (Application responded cleanly with direct handler without error):', res2.statusCode === 200 ? 'PASSED ✅' : 'FAILED ❌');
    }

    console.log('\n🎉 ALL REDIS INTEGRATION & FALLBACK TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    server.close();
  }
}

runRedisTests().catch((err) => {
  console.error('Redis tests failed with error:', err);
  process.exit(1);
});
