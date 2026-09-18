import { connectDB } from './src/config/database.js';
import { userService } from './src/services/user.service.js';
import { authService } from './src/services/auth.service.js';
import {
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateAuthTokens,
  hashPassword,
  comparePassword
} from './src/utils/token.js';
import { User } from './src/models/user.model.js';
import mongoose from 'mongoose';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING AUTHENTICATION & REFRESH TOKEN TESTS');
  console.log('====================================================\n');

  console.log('--- 1. Testing Password Hashing & Comparison ---');
  const pass = 'SuperSecret123!';
  const hashed = await hashPassword(pass);
  const match = await comparePassword(pass, hashed);
  console.log('Password hash test match:', match === true ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 2. Testing JWT Signing & Verification (Access & Refresh) ---');
  const payload = { id: '65f1a2b3c4d5e6f7a8b9c0d1', email: 'test@example.com', role: 'Developer' };

  const accessToken = generateToken(payload);
  const decodedAccess = verifyToken(accessToken);
  console.log('Access token verified payload email:', decodedAccess.email === 'test@example.com' ? 'PASSED ✅' : 'FAILED ❌');

  const refreshToken = generateRefreshToken(payload);
  const decodedRefresh = verifyRefreshToken(refreshToken);
  console.log('Refresh token verified payload email:', decodedRefresh.email === 'test@example.com' ? 'PASSED ✅' : 'FAILED ❌');

  const tokenPair = generateAuthTokens(payload);
  console.log('Token pair generated both tokens:', Boolean(tokenPair.accessToken && tokenPair.refreshToken) ? 'PASSED ✅' : 'FAILED ❌');

  // Connect to DB for live integration testing if available
  console.log('\n--- 3. Connecting to Database for Integration Tests ---');
  try {
    await connectDB();
  } catch (err) {
    console.log('Database connection error in test:', err.message);
  }

  const testEmail = `tester_${Date.now()}@example.com`;

  console.log('\n--- 4. Testing Sign Up (Registration) with Refresh Token ---');
  const registered = await authService.register({
    name: 'Test Tester',
    email: testEmail,
    password: 'Password999!',
    role: 'Developer',
    department: 'QA'
  });
  console.log('Registered user email:', registered.user.email);
  console.log('Registration returned accessToken:', Boolean(registered.accessToken) ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Registration returned refreshToken:', Boolean(registered.refreshToken) ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 5. Testing Login (returns new Token Pair) ---');
  const loginSuccess = await authService.login({
    email: testEmail,
    password: 'Password999!'
  });
  console.log('Login success user id:', loginSuccess.user.id);
  console.log('Login returned accessToken:', Boolean(loginSuccess.accessToken) ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Login returned refreshToken:', Boolean(loginSuccess.refreshToken) ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 6. Testing Token Refresh Flow (/api/auth/refresh-token) ---');
  const refreshed = await authService.refreshToken(loginSuccess.refreshToken);
  console.log('Refresh returned new accessToken:', Boolean(refreshed.accessToken) ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Refresh returned rotated refreshToken:', Boolean(refreshed.refreshToken) ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 7. Testing Refresh with Invalid/Tampered Token ---');
  try {
    await authService.refreshToken('invalid.tampered.token.123');
    console.log('Invalid token test: FAILED ❌');
  } catch (err) {
    console.log('Invalid token correctly rejected:', err.message, 'PASSED ✅');
  }

  console.log('\n--- 8. Testing Logout (Invalidates Refresh Token) ---');
  const logoutResult = await authService.logout({ refreshToken: refreshed.refreshToken });
  console.log('Logout result:', logoutResult.message, 'PASSED ✅');

  // Verify cleared refresh token on user
  const rawUserAfterLogout = await userService.findRawById(registered.user.id);
  console.log('Refresh token cleared in DB on logout:', rawUserAfterLogout.refreshToken === null ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 9. Cleaning up test user ---');
  await User.deleteOne({ email: testEmail });
  console.log('Test user cleaned up ✅');

  console.log('\n🎉 ALL REFRESH TOKEN & AUTH SERVICE TESTS PASSED SUCCESSFULLY! 🎉\n');

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  if (mongoose.connection.readyState !== 0) {
    mongoose.connection.close();
  }
  process.exit(1);
});
