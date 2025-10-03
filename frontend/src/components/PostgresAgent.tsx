import { useState } from 'react';

interface AGUIElement {
  type: string;
  id: string;
  props: any;
  children?: AGUIElement[];
}

interface ActionResult {
  success: boolean;
  data?: any;
  message?: string;
  agui?: AGUIElement[];
  error?: string;
}

export default function PostgresAgent() {
  const [query, setQuery] = useState('');
  const [tableName, setTableName] = useState('');
  const [limit, setLimit] = useState(100);
  const [visualize, setVisualize] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'query' | 'table'>('table');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/postgres-agent/tables`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setTables(data.data);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const pullData = async () => {
    try {
      setLoading(true);
      setResult(null);

      const payload: any = {
        limit,
        visualize
      };

      if (activeTab === 'query' && query.trim()) {
        payload.query = query.trim();
      } else if (activeTab === 'table' && tableName.trim()) {
        payload.tableName = tableName.trim();
      } else {
        alert('Please provide either a query or table name');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/postgres-agent/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error pulling data:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pull data'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (element: AGUIElement) => {
    const { headers, rows } = element.props;
    
    return (
      <div className="overflow-x-auto mt-4">
        <table className="min-w-full bg-white border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              {headers.map((header: string, idx: number) => (
                <th key={idx} className="px-4 py-2 border-b text-left text-sm font-semibold text-gray-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any[], rowIdx: number) => (
              <tr key={rowIdx} className="hover:bg-gray-50">
                {row.map((cell: any, cellIdx: number) => (
                  <td key={cellIdx} className="px-4 py-2 border-b text-sm text-gray-600">
                    {cell !== null && cell !== undefined ? String(cell) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCard = (element: AGUIElement) => {
    const { title, subtitle, content } = element.props;
    
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
        {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        {content && <p className="mt-2 text-gray-700 whitespace-pre-wrap">{content}</p>}
      </div>
    );
  };

  const renderAGUI = (elements: AGUIElement[]) => {
    return elements.map((element) => {
      switch (element.type) {
        case 'table':
          return <div key={element.id}>{renderTable(element)}</div>;
        case 'card':
          return <div key={element.id}>{renderCard(element)}</div>;
        default:
          return <div key={element.id}>Unsupported element type: {element.type}</div>;
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">PostgreSQL Agentic Tool</h1>
        
        <div className="mb-6">
          <button
            onClick={fetchTables}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'List Available Tables'}
          </button>
          
          {tables.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Available Tables:</h3>
              <div className="flex flex-wrap gap-2">
                {tables.map((table) => (
                  <span
                    key={table}
                    onClick={() => {
                      setTableName(table);
                      setActiveTab('table');
                    }}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200"
                  >
                    {table}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setActiveTab('table')}
              className={`px-4 py-2 rounded ${
                activeTab === 'table'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Query by Table
            </button>
            <button
              onClick={() => setActiveTab('query')}
              className={`px-4 py-2 rounded ${
                activeTab === 'query'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Custom SQL Query
            </button>
          </div>

          {activeTab === 'table' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table Name
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="e.g., users, conversations, messages"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SQL Query (SELECT only)
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SELECT * FROM users WHERE created_at > '2024-01-01'"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="mt-4 flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limit
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                min="1"
                max="1000"
                className="w-32 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                id="visualize"
                checked={visualize}
                onChange={(e) => setVisualize(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="visualize" className="text-sm text-gray-700">
                Create visualization
              </label>
            </div>
          </div>

          <button
            onClick={pullData}
            disabled={loading}
            className="mt-4 bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Pulling Data...' : 'Pull Data'}
          </button>
        </div>

        {result && (
          <div className="mt-6">
            {result.success ? (
              <div>
                <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                  <p className="text-green-800 font-semibold">✓ {result.message}</p>
                </div>
                
                {result.agui && result.agui.length > 0 && (
                  <div className="mt-4">
                    {renderAGUI(result.agui)}
                  </div>
                )}

                {result.data && Array.isArray(result.data) && result.data.length > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      View Raw JSON Data ({result.data.length} rows)
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-100 rounded overflow-x-auto text-sm">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-800 font-semibold">✗ Error</p>
                <p className="text-red-600 mt-2">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
