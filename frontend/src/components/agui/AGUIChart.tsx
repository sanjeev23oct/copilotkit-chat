import React from 'react';
import type { AGUIChart as AGUIChartInterface } from '../../types/agui';

interface AGUIChartProps {
  element: AGUIChartInterface;
}

export const AGUIChart: React.FC<AGUIChartProps> = ({ element }) => {
  const { chartType, data } = element.props;
  
  // For now, we'll create a simple text-based chart representation
  // In a real implementation, you'd use Chart.js or similar
  const renderSimpleChart = () => {
    if (chartType === 'bar') {
      const maxValue = Math.max(...data.datasets[0].data);
      
      return (
        <div className="space-y-2">
          {data.labels.map((label, index) => {
            const value = data.datasets[0].data[index];
            const percentage = (value / maxValue) * 100;
            
            return (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-20 text-sm text-gray-600 truncate">
                  {label}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                  <div
                    className="bg-blue-500 h-4 rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-12 text-sm text-gray-900 text-right">
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    
    if (chartType === 'pie') {
      const total = data.datasets[0].data.reduce((sum, val) => sum + val, 0);
      
      return (
        <div className="space-y-2">
          {data.labels.map((label, index) => {
            const value = data.datasets[0].data[index];
            const percentage = ((value / total) * 100).toFixed(1);
            
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{
                      backgroundColor: data.datasets[0].backgroundColor?.[index] || '#3B82F6'
                    }}
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <div className="text-sm text-gray-900">
                  {value} ({percentage}%)
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    
    // Default table view for other chart types
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Label
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.labels.map((label, index) => (
              <tr key={index}>
                <td className="px-4 py-2 text-sm text-gray-900">{label}</td>
                <td className="px-4 py-2 text-sm text-gray-900">
                  {data.datasets[0].data[index]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-4">
        <h4 className="text-lg font-medium text-gray-900 capitalize">
          {chartType} Chart
        </h4>
        {data.datasets[0].label && (
          <p className="text-sm text-gray-600">{data.datasets[0].label}</p>
        )}
      </div>
      {renderSimpleChart()}
    </div>
  );
};

export default AGUIChart;