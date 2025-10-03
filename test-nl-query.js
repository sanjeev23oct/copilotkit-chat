// Test script for Natural Language Query API
const API_URL = 'http://localhost:3010';

async function testNaturalLanguageQueries() {
  console.log('🤖 Testing Natural Language Query API...\n');

  const testQueries = [
    {
      name: 'Simple query',
      query: 'Show me all users from New York'
    },
    {
      name: 'Aggregation query',
      query: 'Count how many users are in each city',
      visualize: true
    },
    {
      name: 'Filtering query',
      query: 'Find users older than 30 years'
    },
    {
      name: 'Product query',
      query: 'Show me the top 3 most expensive products'
    },
    {
      name: 'Join query',
      query: 'Show me all orders with user names and product names'
    }
  ];

  for (const test of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📝 Test: ${test.name}`);
    console.log(`💬 Query: "${test.query}"`);
    console.log('='.repeat(60));

    try {
      const response = await fetch(`${API_URL}/api/postgres-agent/nl-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: test.query,
          visualize: test.visualize || false
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('\n✅ SUCCESS');
        console.log(`\n📊 Generated SQL:\n${data.sql}`);
        console.log(`\n💡 Explanation: ${data.explanation}`);
        console.log(`\n🎯 Confidence: ${Math.round(data.confidence * 100)}%`);
        console.log(`\n📈 Results: ${data.data.length} row(s)`);
        
        if (data.data.length > 0) {
          console.log('\n🔍 Sample Data (first 3 rows):');
          console.log(JSON.stringify(data.data.slice(0, 3), null, 2));
        }

        if (data.agui && data.agui.length > 0) {
          console.log(`\n🎨 AGUI Elements: ${data.agui.length}`);
          data.agui.forEach(element => {
            console.log(`  - ${element.type} (id: ${element.id})`);
          });
        }
      } else {
        console.log('\n❌ FAILED');
        console.log(`Error: ${data.error}`);
      }

      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log('\n❌ ERROR');
      console.error(error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All natural language query tests completed!');
  console.log('='.repeat(60));
}

testNaturalLanguageQueries();
