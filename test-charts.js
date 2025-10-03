// Test script for Chart Visualization
const API_URL = 'http://localhost:3010';

async function testCharts() {
  console.log('📊 Testing Chart Visualization...\n');

  const tests = [
    {
      name: 'Bar Chart - User Count by City',
      query: 'Count how many users are in each city',
      visualize: true
    },
    {
      name: 'Pie Chart - Products by Category',
      query: 'Show me the count of products in each category',
      visualize: true
    },
    {
      name: 'Line Chart - Product Prices',
      query: 'Show me all products with their prices ordered by price',
      visualize: true
    },
    {
      name: 'Complex Query - Order Totals by User',
      query: 'Show me the total order amount for each user',
      visualize: true
    },
    {
      name: 'Multi-Dataset - Stock Quantity by Category',
      query: 'Show me products with their stock quantities grouped by category',
      visualize: true
    }
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📈 ${test.name}`);
    console.log(`💬 Query: "${test.query}"`);
    console.log('='.repeat(70));

    try {
      const response = await fetch(`${API_URL}/api/postgres-agent/nl-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: test.query,
          visualize: test.visualize
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('\n✅ SUCCESS');
        console.log(`\n📊 Generated SQL:\n${data.sql}`);
        console.log(`\n📈 Results: ${data.data.length} row(s)`);
        
        if (data.agui && data.agui.length > 0) {
          console.log(`\n🎨 AGUI Elements Generated:`);
          data.agui.forEach((element, index) => {
            console.log(`  ${index + 1}. ${element.type.toUpperCase()} (id: ${element.id})`);
            
            if (element.type === 'chart') {
              const chartData = element.props.data;
              console.log(`     - Chart Type: ${element.props.chartType}`);
              console.log(`     - Labels: ${chartData.labels.length} items`);
              console.log(`     - Datasets: ${chartData.datasets.length}`);
              chartData.datasets.forEach((dataset, idx) => {
                console.log(`       Dataset ${idx + 1}: ${dataset.label} (${dataset.data.length} values)`);
                console.log(`       Sample values: [${dataset.data.slice(0, 5).join(', ')}${dataset.data.length > 5 ? '...' : ''}]`);
              });
            }
          });
        }

        // Show sample data
        if (data.data.length > 0) {
          console.log('\n🔍 Sample Data (first 3 rows):');
          console.log(JSON.stringify(data.data.slice(0, 3), null, 2));
        }
      } else {
        console.log('\n❌ FAILED');
        console.log(`Error: ${data.error}`);
      }

      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.log('\n❌ ERROR');
      console.error(error.message);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 Chart visualization tests completed!');
  console.log('='.repeat(70));
  console.log('\n💡 Open the frontend UI to see the charts rendered visually!');
}

// Test custom chart creation
async function testCustomChart() {
  console.log('\n\n📊 Testing Custom Chart Creation...\n');

  try {
    // First, get some data
    const dataResponse = await fetch(`${API_URL}/api/postgres-agent/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'SELECT name, price, stock_quantity FROM products ORDER BY price DESC',
        limit: 10
      })
    });

    const dataResult = await dataResponse.json();

    if (dataResult.success && dataResult.data.length > 0) {
      console.log('✅ Retrieved product data');
      
      // Create a custom chart
      const chartResponse = await fetch(`${API_URL}/api/postgres-agent/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: 'create_chart',
          parameters: {
            data: dataResult.data,
            chartType: 'bar',
            xField: 'name',
            yFields: ['price', 'stock_quantity'],
            title: 'Product Prices and Stock Levels'
          }
        })
      });

      const chartResult = await chartResponse.json();

      if (chartResult.success) {
        console.log('\n✅ Custom Chart Created Successfully!');
        console.log(`Message: ${chartResult.message}`);
        
        if (chartResult.agui && chartResult.agui.length > 0) {
          const chart = chartResult.agui[0];
          console.log(`\n📊 Chart Details:`);
          console.log(`  - Type: ${chart.props.chartType}`);
          console.log(`  - Labels: ${chart.props.data.labels.length}`);
          console.log(`  - Datasets: ${chart.props.data.datasets.length}`);
          chart.props.data.datasets.forEach((dataset, idx) => {
            console.log(`    Dataset ${idx + 1}: ${dataset.label}`);
          });
        }
      } else {
        console.log('\n❌ Failed to create custom chart');
        console.log(`Error: ${chartResult.error}`);
      }
    }
  } catch (error) {
    console.log('\n❌ ERROR');
    console.error(error.message);
  }
}

// Run all tests
async function runAllTests() {
  await testCharts();
  await testCustomChart();
  
  console.log('\n\n🎯 All chart tests completed!');
  console.log('📱 Open http://localhost:5173 to see the charts in the UI');
}

runAllTests();
