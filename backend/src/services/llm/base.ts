import { ChatMessage, StreamChunk, AGUIElement } from '../../types/agui';

export interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  agui?: AGUIElement[];
  metadata?: {
    model: string;
    tokens: number;
    processingTime: number;
  };
}

export interface StreamingLLMResponse {
  stream: AsyncIterable<StreamChunk>;
  metadata?: Record<string, any>;
}

export abstract class BaseLLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.validateConfig();
  }

  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }
    if (!this.config.model) {
      throw new Error('Model is required');
    }
  }

  // Abstract methods that must be implemented by providers
  abstract chat(messages: ChatMessage[]): Promise<LLMResponse>;
  abstract streamChat(messages: ChatMessage[]): Promise<StreamingLLMResponse>;
  abstract isAvailable(): Promise<boolean>;

  // Common utility methods
  protected formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  protected createSystemPrompt(): string {
    return `You are an AI assistant with access to database querying capabilities and AGUI (Agentic UI) components.

AGUI Components Available:
- button: Interactive buttons with actions
- table: Data tables with sorting/filtering
- form: Input forms with validation
- card: Information cards
- list: Ordered/unordered lists
- chart: Data visualizations

When responding:
1. Provide helpful text responses
2. Use AGUI components to enhance the user experience
3. For database queries, present results in tables
4. Use buttons for actions users can take
5. Use forms for data input
6. Use charts for data visualization

IMPORTANT: You MUST respond with valid JSON in this exact format:
{
  "content": "Your text response here",
  "agui": [array of AGUI elements if needed, or omit this field if no AGUI elements]
}

Do not include any text before or after the JSON. The entire response must be valid JSON.`;
  }

  protected parseAGUIResponse(content: string): { content: string; agui?: AGUIElement[] } {
    try {
      // First, try to extract JSON from the content if it's wrapped in other text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonContent);
      return {
        content: parsed.content || content,
        agui: parsed.agui || undefined
      };
    } catch (error) {
      // If not valid JSON, return as plain text
      console.warn('Failed to parse AGUI response as JSON:', error);
      console.warn('Raw content:', content);
      return { content };
    }
  }
}