import { DeepSeekProvider } from './llm/deepseek';
import { aguiActionRegistry } from './agui/actions';
import { ChatMessage, Conversation, StreamChunk, AGUIElement } from '../types/agui';
import logger from '../utils/logger';

export class ChatService {
  private llmProvider: DeepSeekProvider;
  private conversations: Map<string, Conversation> = new Map();

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }

    this.llmProvider = new DeepSeekProvider({
      apiKey,
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 4000
    });
  }

  async createConversation(title?: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: this.generateId(),
      title: title || 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.set(conversation.id, conversation);
    logger.info(`Created new conversation: ${conversation.id}`);
    return conversation;
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  async sendMessage(
    conversationId: string,
    content: string,
    streaming: boolean = true
  ): Promise<ChatMessage | AsyncIterable<StreamChunk>> {
    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      // Auto-create conversation if it doesn't exist (handles server restarts)
      logger.warn(`Conversation ${conversationId} not found, creating new one`);
      conversation = await this.createConversation('Recovered Conversation');
      // Use the original conversation ID to maintain frontend compatibility
      this.conversations.delete(conversation.id);
      conversation.id = conversationId;
      this.conversations.set(conversationId, conversation);
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    conversation.messages.push(userMessage);
    conversation.updatedAt = new Date();

    // Update title if it's the first message
    if (conversation.messages.length === 1) {
      conversation.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }

    logger.info(`Sending message, streaming: ${streaming}`);
    
    if (streaming) {
      logger.info('Calling streamResponse');
      return this.streamResponse(conversation);
    } else {
      logger.info('Calling generateResponse');
      return this.generateResponse(conversation);
    }
  }

  private async generateResponse(conversation: Conversation): Promise<ChatMessage> {
    try {
      const response = await this.llmProvider.chat(conversation.messages);
      
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: response.content,
        ...(response.agui && { agui: response.agui }),
        timestamp: new Date(),
        ...(response.metadata && { metadata: response.metadata })
      };

      conversation.messages.push(assistantMessage);
      conversation.updatedAt = new Date();

      return assistantMessage;
    } catch (error) {
      logger.error('Error generating response:', error);
      throw error;
    }
  }

  private async* streamResponse(conversation: Conversation): AsyncIterable<StreamChunk> {
    try {
      logger.info('Starting stream response for conversation:', conversation.id);
      
      // Skip initial message - let the actual content stream
      
      const streamResponse = await this.llmProvider.streamChat(conversation.messages);
      logger.info('Got stream response from LLM provider');
      
      let assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: '',
        agui: [],
        timestamp: new Date()
      };

      logger.info('Starting to process stream chunks');
      for await (const chunk of streamResponse.stream) {
        logger.debug('Processing chunk:', chunk);
        if (chunk.type === 'text' && chunk.content) {
          assistantMessage.content += chunk.content;
        } else if (chunk.type === 'agui' && chunk.agui) {
          if (!assistantMessage.agui) {
            assistantMessage.agui = [];
          }
          assistantMessage.agui.push(chunk.agui);
        } else if (chunk.type === 'done') {
          // Save the complete message
          conversation.messages.push(assistantMessage);
          conversation.updatedAt = new Date();
        }

        yield chunk;
      }
    } catch (error) {
      logger.error('Error streaming response:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Streaming error'
      };
    }
  }

  async executeAction(actionId: string, parameters: Record<string, any>): Promise<any> {
    try {
      logger.info(`Executing action: ${actionId}`, parameters);
      const result = await aguiActionRegistry.executeAction(actionId, parameters);
      
      if (!result.success) {
        throw new Error(result.error || 'Action execution failed');
      }

      return result;
    } catch (error) {
      logger.error(`Action execution failed: ${actionId}`, error);
      throw error;
    }
  }

  async processNaturalLanguageQuery(query: string): Promise<{
    response: string;
    agui?: AGUIElement[];
    data?: any;
  }> {
    try {
      // Check if this looks like a database query
      const dbKeywords = ['select', 'show', 'get', 'find', 'list', 'count', 'sum', 'average', 'users', 'products', 'orders'];
      const isDbQuery = dbKeywords.some(keyword => 
        query.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isDbQuery) {
        // Try to convert to SQL and execute
        const conversation = await this.createConversation('Database Query');
        const systemMessage: ChatMessage = {
          id: this.generateId(),
          role: 'system',
          content: `Convert this natural language query to SQL and execute it: "${query}". 
          
          Available tables: users, products, orders
          
          Respond with JSON format:
          {
            "content": "explanation of what you're doing",
            "agui": [
              {
                "type": "table",
                "id": "results",
                "props": {
                  "headers": ["column1", "column2"],
                  "rows": [["value1", "value2"]]
                }
              }
            ]
          }`,
          timestamp: new Date()
        };

        conversation.messages.push(systemMessage);
        const response = await this.generateResponse(conversation);
        
        return {
          response: response.content,
          ...(response.agui && { agui: response.agui }),
          data: null
        };
      } else {
        // Regular chat response
        const conversation = await this.createConversation('Chat');
        const userMessage: ChatMessage = {
          id: this.generateId(),
          role: 'user',
          content: query,
          timestamp: new Date()
        };
        
        conversation.messages.push(userMessage);
        const response = await this.generateResponse(conversation);
        
        return {
          response: response.content,
          ...(response.agui && { agui: response.agui })
        };
      }
    } catch (error) {
      logger.error('Error processing natural language query:', error);
      throw error;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const chatService = new ChatService();