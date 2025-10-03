# Chart Visualization Guide

Complete guide for using chart visualizations in the PostgreSQL Agentic Tool.

## Overview

The PostgreSQL Agent supports automatic chart generation from query results with multiple chart types and customization options.

## Supported Chart Types

### 1. Bar Chart
Best for comparing values across categories.

**Use Cases:**
- User count by city
- Product count by category
- Sales by month
- Stock levels by product

**Example Query:**
```
"Count how many users are in each city"
```

### 2. Line Chart
Best for showing trends over time or continuous data.

**Use Cases:**
- Price trends
- Growth over time
- Sequential data
- Performance metrics

**Example Query:**
```
"Show me product prices in order"
```

### 3. Area Chart
Similar to line chart but with filled area, emphasizing volume.

**Use Cases:**
- Cumulative totals
- Volume over time
- Stacked data visualization

**Example Query:**
```
"Show me order totals over time"
```

### 4. Pie Chart
Best for showing proportions of a whole.

**Use Cases:**
- Distribution percentages
- Category breakdowns
- Market share
- Composition analysis

**Example Query:**
```
"Show me the distribution of products by category"
```

### 5. Doughnut Chart
Similar to pie chart with a hollow center.

**Use Cases:**
- Same as pie chart
- Modern aesthetic
- Multiple ring visualizations

**Example Query:**
```
"What percentage of users are in each city?"
```

## How to Enable Charts

### Method 1: Natural Language Query with Visualization

```bash
POST /api/postgres-agent/nl-query
{
  "query": "Count users by city",
  "visualize": true
}
```

### Method 2: Direct Data Pull with Visualization

```bash
POST /api/postgres-agent/pull
{
  "query": "SELECT city, COUNT(*) as count FROM users GROUP BY city",
  "visualize": true
}
```

### Method 3: Custom Chart Creation

```bash
POST /api/postgres-agent/action
{
  "actionId": "create_chart",
  "parameters": {
    "data": [...],
    "chartType": "bar",
    "xField": "city",
    "yFields": ["count"],
    "title": "Users by City"
  }
}
```

## Chart Configuration

### Basic Configuration

```javascript
{
  "chartType": "bar",
  "data": {
    "labels": ["Label1", "Label2", "Label3"],
    "datasets": [{
      "label": "Dataset 1",
      "data": [10, 20, 30]
    }]
  }
}
```

### Multi-Dataset Configuration

```javascript
{
  "chartType": "bar",
  "data": {
    "labels": ["Product1", "Product2"],
    "datasets": [
      {
        "label": "Price",
        "data": [100, 200],
        "backgroundColor": "rgba(54, 162, 235, 0.6)"
      },
      {
        "label": "Stock",
        "data": [50, 75],
        "backgroundColor": "rgba(255, 99, 132, 0.6)"
      }
    ]
  }
}
```

### Advanced Options

```javascript
{
  "chartType": "line",
  "data": { ... },
  "options": {
    "responsive": true,
    "plugins": {
      "title": {
        "display": true,
        "text": "Custom Chart Title"
      },
      "legend": {
        "position": "bottom"
      }
    },
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Value"
        }
      }
    }
  }
}
```

## Best Practices

### 1. Choose the Right Chart Type

- **Bar/Column**: Comparing discrete categories
- **Line/Area**: Showing trends or continuous data
- **Pie/Doughnut**: Showing proportions (max 7-8 slices)

### 2. Optimize Data for Visualization

```sql
-- Good: Aggregated data
SELECT city, COUNT(*) as user_count 
FROM users 
GROUP BY city 
ORDER BY user_count DESC 
LIMIT 10;

-- Avoid: Too many data points
SELECT * FROM users; -- 1000+ rows
```

### 3. Use Meaningful Labels

```sql
-- Good: Clear labels
SELECT 
  category as "Product Category",
  COUNT(*) as "Number of Products"
FROM products 
GROUP BY category;

-- Avoid: Technical column names
SELECT cat_id, cnt FROM prod_cat;
```

### 4. Limit Data Points

- Bar/Line charts: 5-20 data points ideal
- Pie/Doughnut charts: 3-8 slices maximum
- Use LIMIT clause for large datasets

## Example Queries for Charts

### Bar Chart Examples

```sql
-- User distribution
"Count users by city"

-- Product inventory
"Show me stock quantity for each product"

-- Order totals
"Total order amount by user"
```

### Line Chart Examples

```sql
-- Price comparison
"Show me products ordered by price"

-- Trend analysis
"Show me order dates in chronological order"
```

### Pie Chart Examples

```sql
-- Category distribution
"What percentage of products are in each category?"

-- User distribution
"Show me the distribution of users across cities"
```

### Multi-Dataset Examples

```sql
-- Price vs Stock
"Show me product prices and stock quantities"

-- Multiple metrics
"Compare order quantity and total amount by product"
```

## Frontend Integration

### Using ChartRenderer Component

```tsx
import ChartRenderer from './components/ChartRenderer';

function MyComponent() {
  const chartData = {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{
      label: 'Sales',
      data: [100, 200, 150]
    }]
  };

  return (
    <ChartRenderer
      chartType="bar"
      data={chartData}
      title="Monthly Sales"
    />
  );
}
```

### Rendering AGUI Chart Elements

```tsx
const renderChart = (element: AGUIElement) => {
  const { chartType, data, options } = element.props;
  
  return (
    <ChartRenderer
      chartType={chartType}
      data={data}
      options={options}
      title="Data Visualization"
    />
  );
};
```

## HTML/JavaScript Integration

### Using Chart.js Directly

```html
<canvas id="myChart"></canvas>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
  const ctx = document.getElementById('myChart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Red', 'Blue', 'Yellow'],
      datasets: [{
        label: 'Votes',
        data: [12, 19, 3]
      }]
    }
  });
</script>
```

## Automatic Chart Generation

The system automatically generates charts when:

1. **Visualization is enabled**: `visualize: true`
2. **Data has numeric columns**: At least one numeric field
3. **Data is aggregated**: GROUP BY queries work best
4. **Reasonable data size**: < 100 rows recommended

### Auto-Detection Logic

```typescript
// System checks for:
- Numeric columns in result set
- Appropriate data size (< 100 rows)
- Suitable data structure (labels + values)
- Chart type based on query pattern
```

## Customization

### Color Schemes

Default colors are automatically applied, but you can customize:

```javascript
{
  datasets: [{
    backgroundColor: [
      'rgba(54, 162, 235, 0.6)',   // Blue
      'rgba(255, 99, 132, 0.6)',   // Red
      'rgba(75, 192, 192, 0.6)',   // Teal
      'rgba(255, 206, 86, 0.6)',   // Yellow
      'rgba(153, 102, 255, 0.6)',  // Purple
    ]
  }]
}
```

### Chart Dimensions

```javascript
{
  options: {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2  // Width:Height ratio
  }
}
```

### Animations

```javascript
{
  options: {
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    }
  }
}
```

## Troubleshooting

### Chart Not Displaying

**Problem**: Chart doesn't appear after query

**Solutions**:
1. Ensure `visualize: true` is set
2. Check that data has numeric columns
3. Verify data is not empty
4. Check browser console for errors

### Chart Looks Crowded

**Problem**: Too many data points

**Solutions**:
1. Add LIMIT clause to query
2. Aggregate data further
3. Use pagination
4. Consider different chart type

### Colors Not Showing

**Problem**: Chart appears monochrome

**Solutions**:
1. Check backgroundColor in dataset
2. Verify Chart.js is loaded
3. Check CSS conflicts

### Chart Not Responsive

**Problem**: Chart doesn't resize

**Solutions**:
1. Ensure responsive: true in options
2. Check container has defined dimensions
3. Verify Chart.js version compatibility

## Performance Tips

1. **Limit Data Points**: Use SQL LIMIT clause
2. **Aggregate Data**: Use GROUP BY for summaries
3. **Cache Results**: Store frequently used charts
4. **Lazy Loading**: Load charts on demand
5. **Optimize Queries**: Use indexes for faster queries

## Examples Gallery

### Example 1: User Distribution

```bash
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Count users by city",
    "visualize": true
  }'
```

### Example 2: Product Analysis

```bash
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me products with their prices and stock quantities",
    "visualize": true
  }'
```

### Example 3: Order Trends

```bash
curl -X POST http://localhost:3010/api/postgres-agent/nl-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me total order amounts by user",
    "visualize": true
  }'
```

## Resources

- **Chart.js Documentation**: https://www.chartjs.org/docs/
- **React Chart.js 2**: https://react-chartjs-2.js.org/
- **Color Picker**: https://www.chartjs.org/docs/latest/general/colors.html
- **Chart Examples**: Open `http://localhost:5173` and click "📊 Chart Showcase"

## Summary

Charts are automatically generated when:
- ✅ Visualization is enabled
- ✅ Data contains numeric values
- ✅ Data is properly aggregated
- ✅ Result set is reasonable size

Supported chart types:
- ✅ Bar Chart
- ✅ Line Chart
- ✅ Area Chart
- ✅ Pie Chart
- ✅ Doughnut Chart
- ✅ Multi-Dataset Charts

Access the Chart Showcase in the UI to see live examples!
