import type { ChatMessage, Conversation, StreamChunk } from '../types/agui';

const API_BASE_URL = 'http://localhost:3010/api';

export class ChatService {
  async createConversation(title?: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }

    const result = await response.json();
    return {
      ...result.data,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt),
      messages: result.data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    };
  }

  async getConversations(): Promise<Conversation[]> {
    const response = await fetch(`${API_BASE_URL}/chat/conversations`);

    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }

    const result = await response.json();
    return result.data.map((conv: any) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }));
  }

  async getConversation(id: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/chat/conversations/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch conversation');
    }

    const result = await response.json();
    return {
      ...result.data,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt),
      messages: result.data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    };
  }

  async sendMessage(conversationId: string, content: string): Promise<ChatMessage> {
    const response = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const result = await response.json();
    return {
      ...result.data,
      timestamp: new Date(result.data.timestamp)
    };
  }

  async* streamMessage(conversationId: string, content: string): AsyncIterable<StreamChunk> {
    console.log('Starting stream for conversation:', conversationId, 'content:', content);
    
    const response = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    console.log('Stream response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error('Failed to stream message');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream reading completed');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim()) {
              try {
                const chunk = JSON.parse(data);
                console.log('Parsed chunk:', chunk);
                yield chunk;
                
                if (chunk.type === 'done' || chunk.type === 'error') {
                  console.log('Stream finished with chunk type:', chunk.type);
                  return;
                }
              } catch (error) {
                console.warn('Failed to parse SSE data:', data, error);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async executeAction(actionId: string, parameters: Record<string, any>): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/chat/actions/${actionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parameters),
    });

    if (!response.ok) {
      throw new Error('Failed to execute action');
    }

    const result = await response.json();
    return result.data;
  }

  async processQuery(query: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/chat/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error('Failed to process query');
    }

    const result = await response.json();
    return result.data;
  }
}

export const chatService = new ChatService();