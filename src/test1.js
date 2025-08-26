const axios = require('axios');

const API_URL = 'http://localhost:3000';

// Simple test runner
async function runTests() {
  console.log('Starting API tests...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('Health check:', healthResponse.data);
    
    // Test 2: Database connection
    console.log('\n2. Testing database connection...');
    const dbResponse = await axios.get(`${API_URL}/test-db`);
    console.log(' Database test:', dbResponse.data);

    // Test 3: Register user
    console.log('\n3. User Registration...');
    const user = await axios.post(`${API_URL}/api/auth/register`, {
      email: 'test123@example.com',
      fullName: 'Test User'
    });
    console.log('Registered:', user.data.email);

    // Test 4: List users
    console.log('\n4. List Users...');
    const users = await axios.get(`${API_URL}/api/auth/users`);
    console.log('Found', users.data.length, 'users');
    
    console.log('\n All tests passed!');
    
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(' Server not running - start with: npm run dev');
    } else {
      console.error('Error:', error.message);
    }
  }
}


runTests();