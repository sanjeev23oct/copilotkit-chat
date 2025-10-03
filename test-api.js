// Test script for PostgreSQL Agent API
const API_URL = 'http://localhost:3010';

async function testAPI() {
  console.log('🧪 Testing PostgreSQL Agent API...\n');

  try {
    // Test 1: List Tables
    console.log('1️⃣ Testing GET /api/postgres-agent/tables');
    const tablesResponse = await fetch(`${API_URL}/api/postgres-agent/tables`);
    const tablesData = await tablesResponse.json();
    console.log('✅ Response:', JSON.stringify(tablesData, null, 2));
    console.log('\n---\n');

    // Test 2: Pull data from users table
    console.log('2️⃣ Testing POST /api/postgres-agent/pull (users table)');
    const pullResponse = await fetch(`${API_URL}/api/postgres-agent/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: 'users',
        limit: 5
      })
    });
    const pullData = await pullResponse.json();
    console.log('✅ Response:', JSON.stringify(pullData, null, 2));
    console.log('\n---\n');

    // Test 3: Custom query with aggregation
    console.log('3️⃣ Testing POST /api/postgres-agent/pull (custom query)');
    const queryResponse = await fetch(`${API_URL}/api/postgres-agent/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'SELECT city, COUNT(*) as user_count FROM users GROUP BY city',
        visualize: true
      })
    });
    const queryData = await queryResponse.json();
    console.log('✅ Response:', JSON.stringify(queryData, null, 2));
    console.log('\n---\n');

    // Test 4: Get available actions
    console.log('4️⃣ Testing GET /api/postgres-agent/actions');
    const actionsResponse = await fetch(`${API_URL}/api/postgres-agent/actions`);
    const actionsData = await actionsResponse.json();
    console.log('✅ Response:', JSON.stringify(actionsData, null, 2));
    console.log('\n---\n');

    // Test 5: Execute action (get sample data)
    console.log('5️⃣ Testing POST /api/postgres-agent/action (get_sample_data)');
    const actionResponse = await fetch(`${API_URL}/api/postgres-agent/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId: 'get_sample_data',
        parameters: {
          tableName: 'products',
          limit: 3
        }
      })
    });
    const actionData = await actionResponse.json();
    console.log('✅ Response:', JSON.stringify(actionData, null, 2));
    console.log('\n---\n');

    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
