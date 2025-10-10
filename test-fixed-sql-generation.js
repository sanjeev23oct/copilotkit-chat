/**
 * Test script to verify fixed SQL generation for RSSB system
 */

const axios = require('axios');

async function testSQLGeneration() {
  try {
    console.log('🧪 Testing Fixed SQL Generation for RSSB System');
    console.log('='.repeat(60));

    const testQueries = [
      {
        name: 'Simple Sewadar Query',
        query: 'Show me all active sewadars'
      },
      {
        name: 'Sewadar with Department',
        query: 'Show me sewadars from IT department'
      },
      {
        name: 'Sewadar Name Search',
        query: 'Find sewadar named John'
      }
    ];

    for (const test of testQueries) {
      console.log(`\n📋 Test: ${test.name}`);
      console.log(`Query: "${test.query}"`);
      console.log('-'.repeat(40));

      try {
        const response = await axios.post('http://localhost:3010/api/postgres-agent/nl-query', {
          query: test.query
        }, {
          timeout: 65000 // 65 seconds to account for Groq timeout increase
        });

        if (response.data.success) {
          console.log('✅ SQL Generated:', response.data.sql);
          console.log('📝 Explanation:', response.data.explanation);
          console.log('🎯 Confidence:', response.data.confidence);
          console.log('📊 Result Count:', response.data.data?.length || 0);
          
          if (response.data.summary) {
            console.log('📄 Summary:', response.data.summary.substring(0, 100) + '...');
          }
        } else {
          console.log('❌ Failed:', response.data.message);
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('❌ Server not running on port 3010');
          return;
        } else if (error.code === 'ECONNRESET' || error.message.includes('timeout')) {
          console.log('⏰ Request timeout - this is expected with Groq rate limits');
        } else {
          console.log('❌ Error:', error.response?.data?.message || error.message);
        }
      }
    }

    console.log('\n🏁 SQL Generation Tests Complete');
    
  } catch (error) {
    console.error('💥 Test Error:', error.message);
  }
}

// Run the test
testSQLGeneration();