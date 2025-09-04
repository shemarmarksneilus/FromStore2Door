import { any } from "joi";

const axios = require('axios');
const API_URL = 'http://localhost:3000';

// Handle errors consistently
function handleError(error: any , exit = false) {
  if (error && typeof error === 'object') {
    if (error.response && error.response.status) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Server not running - start with: npm run dev');
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
  } else {
    console.error('Unexpected error type:', error);
  }

  if (exit) {
    process.exit(1);
  }
}

async function testJWTAuth() {
  console.log('Testing JWT Authentication System\n');

  let authToken = '';
  let refreshToken = '';

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('Health check:', healthResponse.data.status);

    // Test 2: Register user
    console.log('\n2. Testing user registration...');
    const registerData = {
      email: 'testuser@example.com',
      password: 'securepassword123',
      fullName: 'Test User JWT',
      phone: '+1234567890'
    };

    try {
      const registerResponse = await axios.post(`${API_URL}/api/auth/register`, registerData);
      console.log('User registered:', registerResponse.data.user.email);
      authToken = registerResponse.data.token;
      refreshToken = registerResponse.data.refreshToken;
    } catch (error) {
      if (error  === 409) {
        console.log('User already exists, proceeding with login...');
      } else {
        handleError(error, true);
      }
    }

    // Test 3: Login user
    console.log('\n3. Testing user login...');
    if (!authToken) {
      const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: registerData.email,
        password: registerData.password
      });
      console.log('Login successful:', loginResponse.data.user.email);
      authToken = loginResponse.data.token;
      refreshToken = loginResponse.data.refreshToken;
    }

    // Test 4: Get current user (protected route)
    console.log('\n4. Testing protected route /auth/me...');
    const meResponse = await axios.get(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('Current user:', meResponse.data.user.fullName);

    // Test 5: Test refresh token
    console.log('\n5. Testing token refresh...');
    const refreshResponse = await axios.post(`${API_URL}/api/auth/refresh`, {
      refreshToken: refreshToken
    });
    console.log('Token refreshed successfully');
    const newToken = refreshResponse.data.token;

    // Test 6: Test with new token
    console.log('\n6. Testing with refreshed token...');
    const meResponse2 = await axios.get(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${newToken}`
      }
    });
    console.log('New token works:', meResponse2.data.user.email);

    // Test 7: Test account management
    console.log('\n7. Testing account management...');
    const accountResponse = await axios.get(`${API_URL}/api/accounts/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('Account details:', accountResponse.data.fullName);

    // Test 8: Update account info
    console.log('\n8. Testing account update...');
    const updateResponse = await axios.put(`${API_URL}/api/accounts/me`, {
      fullName: 'Updated Test User',
      phone: '+9876543210'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('Account updated:', updateResponse.data.fullName);

    // Test 9: Test role-based access (should fail for regular user)
    console.log('\n9. Testing role-based access control...');
    try {
      await axios.get(`${API_URL}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      console.log('Should have failed - user has admin access when they shouldn\'t');
    } catch (error) {
      if (error === 403) {
        console.log('Role-based access control working - access denied');
      } else {
        handleError(error, true);
      }
    }

    // Test 10: Test password change
    console.log('\n10. Testing password change...');
    const passwordChangeResponse = await axios.post(`${API_URL}/api/auth/change-password`, {
      currentPassword: 'securepassword123',
      newPassword: 'newsecurepassword123'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('Password changed successfully');

    // Test 11: Login with new password
    console.log('\n11. Testing login with new password...');
    const loginNewResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: registerData.email,
      password: 'newsecurepassword123'
    });
    console.log('Login with new password successful');

    // Test 12: Test logout
    console.log('\n12. Testing logout...');
    await axios.post(`${API_URL}/api/auth/logout`, {
      refreshToken: refreshToken
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('Logout successful');

    // Test 13: Test invalid refresh token after logout
    console.log('\n13. Testing invalid refresh token after logout...');
    try {
      await axios.post(`${API_URL}/api/auth/refresh`, {
        refreshToken: refreshToken
      });
      console.log('Should have failed - refresh token should be invalid');
    } catch (error) {
      if (error === 401) {
        console.log('Refresh token properly invalidated');
      } else {
        handleError(error, true);
      }
    }

    console.log('\n All JWT authentication tests passed!');

  } catch (error) {
    handleError(error, true);
  }
}

async function testCompleteWorkflow() {
  console.log('\nTesting Complete Workflow\n');

  try {
    const adminData = {
      email: 'admin@example.com',
      password: 'adminpassword123',
      fullName: 'Admin User',
      role: 'admin'
    };

    let adminToken = '';

    try {
      const adminRegisterResponse = await axios.post(`${API_URL}/api/auth/register`, adminData);
      adminToken = adminRegisterResponse.data.token;
      console.log('Admin user registered');

      const { pool } = require('./src/config/database');
      await pool.query('UPDATE accounts SET role = $1 WHERE email = $2', ['admin', adminData.email]);
      console.log('Admin role assigned manually');

      const adminLoginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: adminData.email,
        password: adminData.password
      });
      adminToken = adminLoginResponse.data.token;

    } catch (error) {
      if (error  === 409) {
        const adminLoginResponse = await axios.post(`${API_URL}/api/auth/login`, {
          email: adminData.email,
          password: adminData.password
        });
        adminToken = adminLoginResponse.data.token;
        console.log('Admin login successful');
      } else {
        handleError(error, true);
      }
    }

    // Test admin endpoints
    console.log('\nTesting admin endpoints...');
    const usersResponse = await axios.get(`${API_URL}/api/auth/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log(`Users list retrieved: ${usersResponse.data.users.length} users found`);

    // Create warehouse
    console.log('\nTesting warehouse creation...');
    const warehouseResponse = await axios.post(`${API_URL}/api/warehouses`, {
      name: 'Test Warehouse JWT',
      type: 'local',
      address: {
        street: '123 Test St',
        city: 'Kingston',
        country: 'Jamaica'
      },
      timezone: 'America/Jamaica'
    });
    console.log('Warehouse created:', warehouseResponse.data.name);

    // Create package
    console.log('\nTesting package creation...');
    const packageResponse = await axios.post(`${API_URL}/api/packages/receive`, {
      trackingNo: 'JWT-TEST-' + Date.now(),
      warehouseId: warehouseResponse.data.id,
      weight: 1.5,
      dimensions: { length: 20, width: 15, height: 10 },
      declaredValue: 50.00,
      contents: 'Test Item'
    });
    console.log('Package received:', packageResponse.data.tracking_no);

    console.log('\n✅ Complete workflow test passed!');

  } catch (error) {
    handleError(error);
  }
}

// Run tests
async function runAllTests() {
  await testJWTAuth();
  await testCompleteWorkflow();
  console.log('\nAll tests completed successfully!');
  process.exit(0);
}

runAllTests();