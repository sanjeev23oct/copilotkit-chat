import React, { useEffect, useState } from "react";

interface AGUIStreamProps {
  symbols?: string[];
  message?: string;
}

interface PortfolioData {
  [symbol: string]: {
    symbol: string;
    price: string;
    change: string;
    volume: string;
    lastUpdated: string;
  };
}

export default function AGUIStream({ symbols = ['MSFT', 'AAPL'], message = "Analyze portfolio" }: AGUIStreamProps) {
  const [messages, setMessages] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData>({});
  const [status, setStatus] = useState<'connecting' | 'running' | 'finished' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Build query parameters
    const params = new URLSearchParams();
    params.append('message', message);
    symbols.forEach(symbol => params.append('symbol', symbol));
    
    const url = `http://localhost:3010/custom-agent?${params.toString()}`;
    console.log('Connecting to AG-UI stream:', url);
    
    const source = new EventSource(url);
    
    source.onopen = () => {
      console.log('AG-UI stream connected');
      setStatus('connecting');
    };
    
    source.onmessage = event => {
      try {
        const e = JSON.parse(event.data);
        console.log('AG-UI event received:', e);
        
        switch (e.event) {
          case 'RUN_STARTED':
            setStatus('running');
            setMessages(prev => [...prev, `🚀 Analysis started for: ${symbols.join(', ')}`]);
            break;
            
          case 'PROGRESS':
            if (e.message) {
              setMessages(prev => [...prev, e.message]);
            }
            break;
            
          case 'STATE_DELTA':
            if (e.data) {
              setPortfolio(prev => ({ ...prev, ...e.data }));
            }
            break;
            
          case 'STATE_SNAPSHOT':
            if (e.data) {
              setPortfolio(e.data);
            }
            break;
            
          case 'RUN_FINISHED':
            setStatus('finished');
            setMessages(prev => [...prev, `✅ Analysis completed`]);
            if (e.summary) {
              setMessages(prev => [...prev, `📊 Summary: ${e.summary.portfolioItems} items analyzed in ${e.summary.duration}ms`]);
            }
            break;
            
          case 'ERROR':
            setStatus('error');
            setError(e.error);
            setMessages(prev => [...prev, `❌ Error: ${e.error}`]);
            break;
            
          default:
            console.log('Unknown AG-UI event:', e);
        }
      } catch (parseError) {
        console.error('Failed to parse AG-UI event:', parseError);
      }
    };
    
    source.onerror = (error) => {
      console.error('AG-UI stream error:', error);
      setStatus('error');
      setError('Connection failed');
    };
    
    return () => {
      console.log('Closing AG-UI stream');
      source.close();
    };
  }, [symbols.join(','), message]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">AG-UI Portfolio Stream</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              status === 'connecting' ? 'bg-yellow-500' :
              status === 'running' ? 'bg-blue-500 animate-pulse' :
              status === 'finished' ? 'bg-green-500' :
              'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium capitalize">{status}</span>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Messages */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Agent Messages</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-500 italic">Waiting for messages...</p>
            ) : (
              <ul className="space-y-1">
                {messages.map((msg, i) => (
                  <li key={i} className="text-sm text-gray-700 p-2 bg-gray-50 rounded">
                    {msg}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Portfolio State */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Portfolio Data</h3>
          {Object.keys(portfolio).length === 0 ? (
            <p className="text-gray-500 italic">No portfolio data yet...</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(portfolio).map(([symbol, data]) => (
                <div key={symbol} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-lg">{data.symbol}</h4>
                    <span className="text-sm text-gray-500">
                      {new Date(data.lastUpdated).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Price:</span>
                      <p className="font-medium">{data.price}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Change:</span>
                      <p className={`font-medium ${
                        data.change.startsWith('+') ? 'text-green-600' : 
                        data.change.startsWith('-') ? 'text-red-600' : 
                        'text-gray-800'
                      }`}>{data.change}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Volume:</span>
                      <p className="font-medium">{data.volume}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Raw Portfolio JSON (for debugging) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Raw Portfolio State</h3>
        <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
          {JSON.stringify(portfolio, null, 2)}
        </pre>
      </div>
    </div>
  );
}