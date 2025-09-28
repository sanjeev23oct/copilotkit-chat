import OpenAI from 'openai';
import { BaseLLMProvider, LLMConfig, LLMResponse, StreamingLLMResponse } from './base';
import { ChatMessage, StreamChunk } from '../../types/agui';
import logger from '../../utils/logger';

export class DeepSeekProvider extends BaseLLMProvider {
  private client: OpenAI;

  constructor(config: LLMConfig) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.deepseek.com',
      model: config.model || 'deepseek-chat',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4000
    });

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error('DeepSeek provider not available:', error);
      return false;
    }
  }

  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const formattedMessages = this.formatMessages(messages);
      
      // Add system prompt
      const systemPrompt = this.createSystemPrompt();
      const messagesWithSystem = [
        { role: 'system', content: systemPrompt },
        ...formattedMessages
      ];

      // Build request params conditionally
      const requestParams: any = {
        model: this.config.model,
        messages: messagesWithSystem,
      };

      if (this.config.temperature !== undefined) {
        requestParams.temperature = this.config.temperature;
      }
      if (this.config.maxTokens !== undefined) {
        requestParams.max_tokens = this.config.maxTokens;
      }

      const response = await this.client.chat.completions.create(requestParams);

      const content = response.choices[0]?.message?.content || '';
      const processingTime = Date.now() - startTime;
      
      logger.info('DeepSeek raw response:', content);
      
      // Parse AGUI response
      const { content: textContent, agui } = this.parseAGUIResponse(content);

      const result: LLMResponse = {
        content: textContent,
        metadata: {
          model: this.config.model,
          tokens: response.usage?.total_tokens || 0,
          processingTime
        }
      };

      if (agui && agui.length > 0) {
        result.agui = agui;
      }

      return result;
    } catch (error) {
      logger.error('DeepSeek chat error:', error);
      throw new Error(`DeepSeek API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async streamChat(messages: ChatMessage[]): Promise<StreamingLLMResponse> {
    try {
      logger.info('DeepSeek streamChat called with messages:', messages.length);
      const formattedMessages = this.formatMessages(messages);
      
      // Add system prompt
      const systemPrompt = this.createSystemPrompt();
      const messagesWithSystem = [
        { role: 'system', content: systemPrompt },
        ...formattedMessages
      ];
      
      logger.info('Formatted messages for DeepSeek:', messagesWithSystem.length);

      // Build stream params conditionally
      const streamParams: any = {
        model: this.config.model,
        messages: messagesWithSystem,
        stream: true,
      };

      if (this.config.temperature !== undefined) {
        streamParams.temperature = this.config.temperature;
      }
      if (this.config.maxTokens !== undefined) {
        streamParams.max_tokens = this.config.maxTokens;
      }

      logger.info('Calling DeepSeek API with stream params');
      const stream = await this.client.chat.completions.create(streamParams);
      logger.info('Got stream from DeepSeek API');

      return {
        stream: this.processStream(stream as any),
        metadata: {
          model: this.config.model,
          provider: 'deepseek'
        }
      };
    } catch (error) {
      logger.error('DeepSeek stream error:', error);
      throw new Error(`DeepSeek streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async* processStream(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): AsyncIterable<StreamChunk> {
    let fullContent = '';
    let totalTokens = 0;

    try {
      logger.info('Starting to process DeepSeek stream');
      
      // First, collect all the content
      for await (const chunk of stream) {
        logger.debug('DeepSeek chunk received:', chunk);
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          fullContent += delta.content;
        }

        // Track token usage if available
        if (chunk.usage?.total_tokens) {
          totalTokens = chunk.usage.total_tokens;
        }

        if (chunk.choices[0]?.finish_reason) {
          logger.info('Stream finished with reason:', chunk.choices[0].finish_reason);
          break;
        }
      }

      // Now parse and stream the actual content
      if (fullContent) {
        logger.info('Processing complete content:', fullContent.substring(0, 100) + '...');
        
        try {
          // Try to parse as JSON first
          const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Stream the actual text content
            if (parsed.content) {
              yield {
                type: 'text',
                content: parsed.content
              };
            }
            
            // Stream AGUI elements
            if (parsed.agui && Array.isArray(parsed.agui)) {
              for (const aguiElement of parsed.agui) {
                const elementWithId = {
                  ...aguiElement,
                  id: aguiElement.id || `agui-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };
                
                yield {
                  type: 'agui',
                  agui: elementWithId
                };
              }
            }
          } else {
            // If not JSON, stream the raw content
            yield {
              type: 'text',
              content: fullContent
            };
          }
        } catch (parseError) {
          logger.warn('Failed to parse JSON, streaming raw content:', parseError);
          // Stream raw content as fallback
          yield {
            type: 'text',
            content: fullContent
          };
        }
      }

      yield {
        type: 'done',
        metadata: {
          totalTokens: totalTokens || fullContent.length
        }
      };
    } catch (error) {
      logger.error('Stream processing error:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Stream processing error'
      };
    }
  }
}