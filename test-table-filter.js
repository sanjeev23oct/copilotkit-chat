const API_URL = 'http://localhost:3010';

async function testTableFilter() {
  console.log('Testing table filter (sewadar/department only)...\n');
  
  try {
    const response = await fetch(`${API_URL}/api/postgres-agent/tables`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✓ Success!');
      console.log(`Found ${data.data.length} tables:\n`);
      
      data.data.forEach(table => {
        const hasSewadar = table.toLowerCase().includes('sewadar');
        const hasDepartment = table.toLowerCase().includes('department');
        const marker = hasSewadar ? '👤' : hasDepartment ? '🏢' : '❓';
        console.log(`  ${marker} ${table}`);
      });
      
      // Verify all tables match the filter
      const allMatch = data.data.every(table => 
        table.toLowerCase().includes('sewadar') || 
        table.toLowerCase().includes('department')
      );
      
      if (allMatch) {
        console.log('\n✅ All tables match the filter!');
      } else {
        console.log('\n⚠️ Some tables do not match the filter');
      }
      
      if (data.data.length === 0) {
        console.log('\n⚠️ No tables found. Make sure you have tables with "sewadar" or "department" in their names.');
        console.log('\nExample table names that would match:');
        console.log('  - sewadar_info');
        console.log('  - department_master');
        console.log('  - sewadar_attendance');
        console.log('  - department_hierarchy');
      }
    } else {
      console.log('✗ Error:', data.error);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testTableFilter();
