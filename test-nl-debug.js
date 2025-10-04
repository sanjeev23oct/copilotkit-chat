const API_URL = 'http://localhost:3010';

async function testNLQuery() {
  try {
    console.log('Testing natural language query...\n');
    
    const response = await fetch(`${API_URL}/api/postgres-agent/nl-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Show me products with their total sales, revenue, average rating, and current stock',
        visualize: true
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✓ Success!');
      console.log('SQL:', data.sql);
      console.log('Explanation:', data.explanation);
      console.log('Confidence:', data.confidence);
      console.log('Rows:', data.data?.length || 0);
    } else {
      console.log('✗ Error:', data.error);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testNLQuery();
