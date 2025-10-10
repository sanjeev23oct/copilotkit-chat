/**
 * Test RSSB SQL Generation Fix
 * Tests the corrected schema understanding and SQL generation
 */

const axios = require('axios');

const baseURL = 'http://localhost:3010';

async function testQuery(query, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`Query: "${query}"`);
  
  try {
    const response = await axios.post(`${baseURL}/api/postgres-agent/nl-query`, {
      query: query,
      visualize: false
    });

    if (response.data.success) {
      console.log('✅ SUCCESS');
      console.log(`Generated SQL: ${response.data.sql}`);
      console.log(`Records returned: ${response.data.data?.length || 0}`);
      console.log(`Confidence: ${response.data.confidence}`);
      
      // Check for forbidden patterns
      const sql = response.data.sql.toLowerCase();
      if (sql.includes('a.department_id')) {
        console.log('❌ ERROR: Found forbidden pattern "a.department_id"');
      } else if (sql.includes('c.department_id')) {
        console.log('❌ ERROR: Found forbidden pattern "c.department_id"');
      } else {
        console.log('✅ No forbidden patterns detected');
      }
    } else {
      console.log('❌ FAILED');
      console.log(`Error: ${response.data.error}`);
    }
  } catch (error) {
    console.log('❌ FAILED');
    console.log(`Error: ${error.response?.data?.error || error.message}`);
  }
}

async function testMultiAgentQuery(query, description) {
  console.log(`\n🤖 Testing Multi-Agent: ${description}`);
  console.log(`Query: "${query}"`);
  
  try {
    const response = await axios.post(`${baseURL}/api/multi-agent/query`, {
      query: query,
      visualize: true
    });

    if (response.data.success) {
      console.log('✅ SUCCESS');
      console.log(`Involved agents: ${response.data.involvedAgents?.join(', ')}`);
      console.log(`Records returned: ${response.data.data?.length || 0}`);
      console.log(`Routing: ${response.data.routingDecision}`);
    } else {
      console.log('❌ FAILED');
      console.log(`Error: ${response.data.error}`);
      console.log(`Message: ${response.data.message}`);
    }
  } catch (error) {
    console.log('❌ FAILED');
    console.log(`Error: ${error.response?.data?.error || error.message}`);
  }
}

async function runTests() {
  console.log('🔍 Testing RSSB SQL Generation Fix');
  console.log('=====================================');

  // Test 1: Basic sewadar query
  await testQuery(
    "Show me all active sewadars",
    "Basic sewadar query"
  );

  // Test 2: Department filter (the original failing case)
  await testQuery(
    "get me the list of sewadars in I.T. department",
    "Department filter query (original failing case)"
  );

  // Test 3: Multi-table JOIN query
  await testQuery(
    "Show me sewadars with their area and centre names",
    "Multi-table JOIN query"
  );

  // Test 4: Status-based query
  await testQuery(
    "Find sewadars with active status",
    "Status-based query"
  );

  console.log('\n🤖 Testing Multi-Agent Endpoint');
  console.log('================================');

  // Test 5: Multi-agent query (original failing endpoint)
  await testMultiAgentQuery(
    "get me the list of sewadars in I.T. department",
    "Multi-agent sewadar query"
  );

  // Test 6: Department-specific query
  await testMultiAgentQuery(
    "show me all departments",
    "Department-specific query"
  );

  console.log('\n📊 Test Summary');
  console.log('===============');
  console.log('✅ If all tests pass, the RSSB SQL generation is fixed');
  console.log('❌ If tests fail, check the error messages above');
}

// Run the tests
runTests().catch(console.error);