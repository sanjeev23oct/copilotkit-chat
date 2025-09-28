import React, { useState, useRef, useEffect } from 'react';
import type { Conversation } from '../../types/agui';
import { AGUIRenderer } from '../agui/AGUIRenderer';

interface ChatInterfaceProps {
  conversation?: Conversation;
  onSendMessage: (content: string) => void;
  onAction?: (actionId: string, params?: any) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversation,
  onSendMessage,
  onAction
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    setIsLoading(true);
    
    onSendMessage(message);
    
    // Reset loading state after a delay (in real implementation, this would be handled by the parent)
    setTimeout(() => setIsLoading(false), 1000);
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {conversation?.title || 'AI Database Assistant'}
        </h1>
        <p className="text-sm text-gray-600">
          Ask me anything about the database or request data visualizations
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {!conversation?.messages.length && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-1.946-.274A5.978 5.978 0 0112 20.5a5.978 5.978 0 01-2.054-.274A8.955 8.955 0 018 21c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Start a conversation
            </h3>
            <p className="text-gray-600 mb-6">
              Try asking questions like:
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <div>"Show me all users"</div>
              <div>"What products do we have?"</div>
              <div>"Create a chart of orders by user"</div>
              <div>"Get the database schema"</div>
            </div>
          </div>
        )}

        {conversation?.messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              {/* Message content */}
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* AGUI elements */}
              {message.agui && message.agui.length > 0 && (
                <div className="mt-4">
                  <AGUIRenderer elements={message.agui} onAction={onAction} />
                </div>
              )}
              
              {/* Timestamp */}
              <div
                className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {formatTimestamp(message.timestamp)}
                {message.metadata && (
                  <span className="ml-2">
                    • {message.metadata.model} • {message.metadata.tokens} tokens
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about the database..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;