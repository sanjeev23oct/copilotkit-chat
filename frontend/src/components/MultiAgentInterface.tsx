import { useState, useEffect } from 'react';
import ChartRenderer from './ChartRenderer';

interface AGUIElement {
  type: string;
  id: string;
  props: any;
  children?: AGUIElement[];
}

interface AgentInfo {
  agentId: string;
  domain: string;
  status: string;
  resources: number;
  capabilities?: string[];
}

interface MultiAgentResult {
  success: boolean;
  data?: any[];
  message?: string;
  agui?: AGUIElement[];
  error?: string;
  summary?: string;
  sql?: string;
  explanation?: string;
  confidence?: number;
  model?: {
    provider: string;
    name: string;
  };
  involvedAgents?: string[];
  executionTime?: number;
  executionStrategy?: {
    type: string;
    resource: string;
    confidence: number;
    reasoning: string;
  };
}

interface OrchestratedResult {
  success: boolean;
  results: { [agentId: string]: MultiAgentResult };
  combinedSummary?: string;
  executionPlan?: {
    strategy: 'single' | 'parallel' | 'sequential';
    involvedAgents: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
  };
  totalExecutionTime?: number;
  error?: string;
}

export default function MultiAgentInterface() {
  const [query, setQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('auto');
  const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([]);
  const [result, setResult] = useState<MultiAgentResult | OrchestratedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [visualize, setVisualize] = useState(true);
  const [activeTab, setActiveTab] = useState<'query' | 'agents' | 'orchestrate'>('query');
  const [resultViewTab, setResultViewTab] = useState<'summary' | 'records' | 'chart' | 'execution'>('summary');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

  // Fetch available agents on component mount
  useEffect(() => {
    fetchAvailableAgents();
  }, []);

  const fetchAvailableAgents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/multi-agent/agents`);
      const data = await response.json();
      
      if (data.success && data.agents) {
        setAvailableAgents(data.agents);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      // Fallback to mock data for demonstration
      setAvailableAgents([
        { agentId: 'sewadar', domain: 'sewadar', status: 'active', resources: 12, capabilities: ['profile_management', 'badge_verification', 'eligibility_check'] },
        { agentId: 'department', domain: 'department', status: 'active', resources: 8, capabilities: ['org_structure', 'assignments', 'transfers'] },
        { agentId: 'attendance', domain: 'attendance', status: 'active', resources: 6, capabilities: ['time_tracking', 'leave_management', 'reporting'] },
      ]);
    }
  };

  const executeQuery = async () => {
    if (!query.trim()) {
      alert('Please enter a query');
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      let endpoint = '';
      let payload: any = {
        query: query.trim(),
        visualize
      };

      if (activeTab === 'orchestrate') {
        // Multi-agent orchestration
        endpoint = `${API_URL}/api/multi-agent/orchestrate`;
        payload.strategy = 'auto'; // Let orchestrator decide
      } else if (selectedAgent === 'auto') {
        // Auto-route to best agent
        endpoint = `${API_URL}/api/multi-agent/query`;
      } else {
        // Specific agent
        endpoint = `${API_URL}/api/multi-agent/agents/${selectedAgent}/query`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error executing query:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute query'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderAgentCard = (agent: AgentInfo) => {
    const isSelected = selectedAgent === agent.agentId;
    const statusColor = agent.status === 'active' ? 'green' : 'gray';
    
    return (
      <div
        key={agent.agentId}
        onClick={() => setSelectedAgent(agent.agentId)}
        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
          isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800 capitalize">
            {agent.agentId} Agent
          </h3>
          <span className={`px-2 py-1 text-xs rounded-full bg-${statusColor}-100 text-${statusColor}-800`}>
            {agent.status}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 mb-2">
          Domain: <span className="font-medium">{agent.domain}</span>
        </p>
        
        <p className="text-sm text-gray-600 mb-3">
          Resources: <span className="font-medium">{agent.resources}</span>
        </p>
        
        {agent.capabilities && (
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 3).map((capability) => (
              <span
                key={capability}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
              >
                {capability.replace(/_/g, ' ')}
              </span>
            ))}
            {agent.capabilities.length > 3 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                +{agent.capabilities.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    );
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

  const renderChart = (element: AGUIElement) => {
    const { chartType, data, options } = element.props;
    
    return (
      <div className="mt-4">
        <ChartRenderer
          chartType={chartType}
          data={data}
          options={options}
          title={`Data Visualization - ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`}
        />
      </div>
    );
  };

  const renderAGUI = (elements: AGUIElement[]) => {
    return elements.map((element) => {
      switch (element.type) {
        case 'table':
          return <div key={element.id}>{renderTable(element)}</div>;
        case 'chart':
          return <div key={element.id}>{renderChart(element)}</div>;
        default:
          return <div key={element.id}>Unsupported element type: {element.type}</div>;
      }
    });
  };

  const renderSingleAgentResult = (result: MultiAgentResult) => (
    <div>
      <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
        <p className="text-green-800 font-semibold">✓ {result.message}</p>
        {result.model && (
          <p className="mt-1 text-xs text-gray-500">
            🤖 Model: {result.model.provider} / {result.model.name}
          </p>
        )}
        {result.involvedAgents && result.involvedAgents.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            👥 Agents: {result.involvedAgents.join(', ')}
          </p>
        )}
        {result.executionTime && (
          <p className="mt-1 text-xs text-gray-500">
            ⏱️ Execution Time: {result.executionTime}ms
          </p>
        )}
      </div>

      {/* Result View Tabs */}
      {result.data && Array.isArray(result.data) && result.data.length > 0 && (
        <div>
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {result.summary && (
              <button
                onClick={() => setResultViewTab('summary')}
                className={`px-4 py-2 font-medium transition-colors ${
                  resultViewTab === 'summary'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📝 Summary
              </button>
            )}
            <button
              onClick={() => setResultViewTab('records')}
              className={`px-4 py-2 font-medium transition-colors ${
                resultViewTab === 'records'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📊 Records ({result.data.length})
            </button>
            {result.agui && result.agui.some((el: any) => el.type === 'chart') && (
              <button
                onClick={() => setResultViewTab('chart')}
                className={`px-4 py-2 font-medium transition-colors ${
                  resultViewTab === 'chart'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📈 Chart
              </button>
            )}
            <button
              onClick={() => setResultViewTab('execution')}
              className={`px-4 py-2 font-medium transition-colors ${
                resultViewTab === 'execution'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🔧 Execution
            </button>
          </div>

          {/* Summary Tab */}
          {resultViewTab === 'summary' && result.summary && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Analysis</h3>
              <div className="text-gray-700 leading-relaxed space-y-3">
                {result.summary.split('\n').map((line: string, idx: number) => {
                  if (!line.trim()) return null;
                  
                  if (line.trim().startsWith('-')) {
                    const text = line.trim().substring(1).trim();
                    return (
                      <div key={idx} className="flex items-start gap-2 ml-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span className="flex-1">
                          {text.split(/(\*\*.*?\*\*)/).map((part, i) => 
                            part.startsWith('**') && part.endsWith('**') ? (
                              <strong key={i} className="font-semibold text-gray-900">
                                {part.slice(2, -2)}
                              </strong>
                            ) : part
                          )}
                        </span>
                      </div>
                    );
                  }
                  
                  return (
                    <p key={idx} className="text-gray-700">
                      {line.split(/(\*\*.*?\*\*)/).map((part, i) => 
                        part.startsWith('**') && part.endsWith('**') ? (
                          <strong key={i} className="font-semibold text-gray-900">
                            {part.slice(2, -2)}
                          </strong>
                        ) : part
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {/* Records Tab */}
          {resultViewTab === 'records' && result.agui && (
            <div>
              {renderAGUI(result.agui.filter((el: any) => el.type === 'table'))}
            </div>
          )}

          {/* Chart Tab */}
          {resultViewTab === 'chart' && result.agui && (
            <div>
              {renderAGUI(result.agui.filter((el: any) => el.type === 'chart'))}
            </div>
          )}

          {/* Execution Tab */}
          {resultViewTab === 'execution' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">🔧 Execution Details</h3>
              
              {result.executionStrategy && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Strategy:</h4>
                  <div className="bg-white p-3 rounded border">
                    <p><strong>Type:</strong> {result.executionStrategy.type}</p>
                    <p><strong>Resource:</strong> {result.executionStrategy.resource}</p>
                    <p><strong>Confidence:</strong> {Math.round(result.executionStrategy.confidence * 100)}%</p>
                    <p><strong>Reasoning:</strong> {result.executionStrategy.reasoning}</p>
                  </div>
                </div>
              )}
              
              {result.sql && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Generated SQL:</h4>
                  <pre className="p-3 bg-white rounded border text-sm overflow-x-auto">
                    {result.sql}
                  </pre>
                </div>
              )}
              
              {result.explanation && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Explanation:</h4>
                  <p className="text-gray-600">{result.explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderOrchestratedResult = (result: OrchestratedResult) => (
    <div>
      <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
        <p className="text-green-800 font-semibold">✓ Multi-agent orchestration completed</p>
        {result.executionPlan && (
          <div className="mt-2 text-xs text-gray-600">
            <p>🎯 Strategy: {result.executionPlan.strategy}</p>
            <p>👥 Agents: {result.executionPlan.involvedAgents.join(', ')}</p>
            <p>📊 Complexity: {result.executionPlan.estimatedComplexity}</p>
          </div>
        )}
        {result.totalExecutionTime && (
          <p className="mt-1 text-xs text-gray-500">
            ⏱️ Total Execution Time: {result.totalExecutionTime}ms
          </p>
        )}
      </div>

      {result.combinedSummary && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 Combined Analysis</h3>
          <div className="text-gray-700 leading-relaxed">
            {result.combinedSummary.split('\n').map((line: string, idx: number) => (
              <p key={idx} className="mb-2">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Individual Agent Results */}
      <div className="space-y-4">
        {Object.entries(result.results).map(([agentId, agentResult]) => (
          <div key={agentId} className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3 capitalize">
              {agentId} Agent Result
            </h4>
            {agentResult.success ? (
              <div>
                {agentResult.summary && (
                  <div className="text-sm text-gray-600 mb-2">{agentResult.summary}</div>
                )}
                {agentResult.data && Array.isArray(agentResult.data) && (
                  <p className="text-xs text-gray-500">
                    📊 {agentResult.data.length} records
                  </p>
                )}
              </div>
            ) : (
              <div className="text-red-600 text-sm">
                Error: {agentResult.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">🤖 Multi-Agent PostgreSQL Interface</h1>
        
        {/* Main Tabs */}
        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setActiveTab('query')}
              className={`px-4 py-2 rounded ${
                activeTab === 'query'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🔍 Query
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-4 py-2 rounded ${
                activeTab === 'agents'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              👥 Agent Selection
            </button>
            <button
              onClick={() => setActiveTab('orchestrate')}
              className={`px-4 py-2 rounded ${
                activeTab === 'orchestrate'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🎼 Multi-Agent Orchestration
            </button>
          </div>

          {activeTab === 'query' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Natural Language Query 🗣️
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Show me sewadar profiles with attendance above 90%, or Get department assignments for the current month"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-4 flex gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Selection
                  </label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">🤖 Auto-Route (Recommended)</option>
                    {availableAgents.map((agent) => (
                      <option key={agent.agentId} value={agent.agentId}>
                        {agent.agentId.charAt(0).toUpperCase() + agent.agentId.slice(1)} Agent ({agent.domain})
                      </option>
                    ))}
                  </select>
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
            </div>
          )}

          {activeTab === 'agents' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Agents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div
                  onClick={() => setSelectedAgent('auto')}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedAgent === 'auto' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <h3 className="font-semibold text-gray-800 mb-2">🤖 Auto-Route</h3>
                  <p className="text-sm text-gray-600">
                    Automatically select the best agent based on query content
                  </p>
                </div>
                {availableAgents.map(renderAgentCard)}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Query for Selected Agent
                </label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your query here..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'orchestrate' && (
            <div>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                <p className="text-yellow-800 font-semibold">🎼 Multi-Agent Orchestration</p>
                <p className="text-yellow-700 text-sm mt-1">
                  This mode coordinates multiple agents to answer complex queries that span multiple domains.
                </p>
              </div>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Complex Multi-Domain Query 🧠
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Show me attendance summary for sewadars in IT department with active badges, or Generate a report of department transfers with attendance impact analysis"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                💡 Examples: "Compare attendance across departments", "Show sewadar profiles with their current assignments and recent attendance"
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={executeQuery}
              disabled={loading}
              className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {loading ? '🔄 Processing...' : (activeTab === 'orchestrate' ? '🎼 Orchestrate' : '🤖 Execute Query')}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-6">
            {result.success ? (
              (result as OrchestratedResult).results ? 
                renderOrchestratedResult(result as OrchestratedResult) :
                renderSingleAgentResult(result as MultiAgentResult)
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