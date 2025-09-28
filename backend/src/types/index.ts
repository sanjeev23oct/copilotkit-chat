// Core types for the AI Chat application

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
    agUIElements?: AGUIElement[];
    databaseQuery?: string;
    toolExecutions?: ToolExecutionResult[];
  };
}

export interface AGUIElement {
  type: 'button' | 'form' | 'chart' | 'table' | 'card';
  id: string;
  props: Record<string, any>;
  action?: string;
}

export interface ToolExecutionResult {
  toolName: string;
  callId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

// LLM Provider Types
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  agUIElements?: AGUIElement[];
}

export interface AgenticResponse extends LLMResponse {
  toolCalls?: ToolCall[];
  requiresToolExecution: boolean;
  conversationState: 'complete' | 'awaiting_tool_results' | 'error';
}

export interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
}

// Agent Tool Types
export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolContext {
  userId: string;
  conversationId: string;
  permissions: string[];
}

// Chat Context Types
export interface AgenticChatContext {
  conversationId: string;
  userId: string;
  history: ChatMessage[];
  permissions: string[];
  availableTools: string[];
  toolExecutions: ToolExecutionResult[];
}

export interface AgenticChatResponse {
  message: ChatMessage;
  toolExecutions?: ToolExecutionResult[];
  suggestedActions?: SuggestedAction[];
  agUIElements?: AGUIElement[];
}

export interface SuggestedAction {
  id: string;
  label: string;
  action: string;
  type: 'button' | 'link';
}

// Database Types
export interface DatabaseSchema {
  tables: Table[];
  relationships: Relationship[];
}

export interface Table {
  name: string;
  columns: Column[];
  description?: string;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Configuration Types
export interface LLMConfig {
  provider: 'deepseek' | 'local' | 'openai' | 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  supportsTools: boolean;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

// Error Types
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.name = this.constructor.name;
  }
}

export class LLMProviderError extends AppError {}
export class DatabaseError extends AppError {}
export class ValidationError extends AppError {}
export class AuthenticationError extends AppError {}
export class ToolExecutionError extends AppError {}