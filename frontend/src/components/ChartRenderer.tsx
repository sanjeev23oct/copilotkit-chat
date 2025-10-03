import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartOptions, ChartData } from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartRendererProps {
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  data: ChartData<any>;
  options?: ChartOptions<any>;
  title?: string;
}

export default function ChartRenderer({ chartType, data, options, title }: ChartRendererProps) {
  const chartRef = useRef<any>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  const defaultOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
          },
          padding: 15,
        },
      },
      title: {
        display: !!title,
        text: title || '',
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: {
          top: 10,
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
        cornerRadius: 4,
      },
    },
    scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
    } : undefined,
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    plugins: {
      ...defaultOptions.plugins,
      ...options?.plugins,
    },
  };

  // Enhance data with better colors if not provided
  const enhancedData = {
    ...data,
    datasets: data.datasets.map((dataset) => ({
      ...dataset,
      backgroundColor: dataset.backgroundColor || generateColors(data.labels?.length || 10, 0.6),
      borderColor: dataset.borderColor || generateColors(data.labels?.length || 10, 1),
      borderWidth: dataset.borderWidth || (chartType === 'line' ? 2 : 1),
      tension: chartType === 'line' || chartType === 'area' ? 0.4 : 0,
      fill: chartType === 'area',
    })),
  };

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return <Bar ref={chartRef} data={enhancedData} options={mergedOptions} />;
      case 'line':
      case 'area':
        return <Line ref={chartRef} data={enhancedData} options={mergedOptions} />;
      case 'pie':
        return <Pie ref={chartRef} data={enhancedData} options={mergedOptions} />;
      case 'doughnut':
        return <Doughnut ref={chartRef} data={enhancedData} options={mergedOptions} />;
      default:
        return <Bar ref={chartRef} data={enhancedData} options={mergedOptions} />;
    }
  };

  return (
    <div className="w-full bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="max-w-full" style={{ height: '400px' }}>
        {renderChart()}
      </div>
    </div>
  );
}

// Helper function to generate colors
function generateColors(count: number, alpha: number = 1): string[] {
  const baseColors = [
    `rgba(54, 162, 235, ${alpha})`,   // Blue
    `rgba(255, 99, 132, ${alpha})`,   // Red
    `rgba(75, 192, 192, ${alpha})`,   // Teal
    `rgba(255, 206, 86, ${alpha})`,   // Yellow
    `rgba(153, 102, 255, ${alpha})`,  // Purple
    `rgba(255, 159, 64, ${alpha})`,   // Orange
    `rgba(46, 204, 113, ${alpha})`,   // Green
    `rgba(231, 76, 60, ${alpha})`,    // Dark Red
    `rgba(52, 152, 219, ${alpha})`,   // Light Blue
    `rgba(155, 89, 182, ${alpha})`,   // Violet
  ];

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}
