import { useState } from 'react';
import ChartRenderer from './ChartRenderer';

export default function ChartShowcase() {
  const [activeChart, setActiveChart] = useState<string>('bar');

  const sampleData = {
    labels: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
    datasets: [
      {
        label: 'User Count',
        data: [12, 19, 8, 15, 10],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
      },
    ],
  };

  const multiDatasetData = {
    labels: ['Laptop', 'Smartphone', 'Coffee Mug', 'Desk Chair', 'Notebook'],
    datasets: [
      {
        label: 'Price ($)',
        data: [999, 699, 13, 200, 6],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
      },
      {
        label: 'Stock Quantity',
        data: [50, 100, 200, 25, 500],
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
      },
    ],
  };

  const pieData = {
    labels: ['Electronics', 'Furniture', 'Home', 'Office'],
    datasets: [
      {
        label: 'Products by Category',
        data: [2, 1, 1, 1],
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 206, 86, 0.6)',
        ],
      },
    ],
  };

  const chartTypes = [
    { id: 'bar', name: 'Bar Chart', data: sampleData },
    { id: 'line', name: 'Line Chart', data: sampleData },
    { id: 'area', name: 'Area Chart', data: sampleData },
    { id: 'pie', name: 'Pie Chart', data: pieData },
    { id: 'doughnut', name: 'Doughnut Chart', data: pieData },
    { id: 'multi', name: 'Multi-Dataset Bar', data: multiDatasetData },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 Chart Showcase</h1>
        <p className="text-gray-600 mb-6">
          Explore different chart types available in the PostgreSQL Agent
        </p>

        {/* Chart Type Selector */}
        <div className="flex flex-wrap gap-3 mb-6">
          {chartTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveChart(type.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeChart === type.id
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type.name}
            </button>
          ))}
        </div>

        {/* Chart Display */}
        <div className="bg-gray-50 rounded-lg p-6">
          {chartTypes.map((type) => (
            <div
              key={type.id}
              className={activeChart === type.id ? 'block' : 'hidden'}
            >
              <ChartRenderer
                chartType={type.id === 'multi' ? 'bar' : type.id as any}
                data={type.data}
                title={type.name}
              />
            </div>
          ))}
        </div>

        {/* Chart Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">💡 How to Use Charts</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Charts are automatically generated when you enable "Create visualization"</li>
            <li>• Natural language queries with aggregations work best for charts</li>
            <li>• Try queries like: "Count users by city", "Show product prices", "Total orders by user"</li>
            <li>• Multi-dataset charts show multiple metrics on the same chart</li>
          </ul>
        </div>

        {/* Example Queries */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">📈 Good for Bar/Line Charts</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• "Count users by city"</li>
              <li>• "Show product prices"</li>
              <li>• "Total orders by user"</li>
              <li>• "Stock quantity by product"</li>
            </ul>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-purple-900 mb-2">🥧 Good for Pie/Doughnut Charts</h4>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• "Count products by category"</li>
              <li>• "Distribution of users by city"</li>
              <li>• "Order count by product"</li>
              <li>• "Percentage breakdown of categories"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
