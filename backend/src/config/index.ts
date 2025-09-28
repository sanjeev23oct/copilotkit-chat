import dotenv from 'dotenv';
import { LLMConfig, DatabaseConfig, RedisConfig } from '../types';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3010', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5185',

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'ai_chat_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  } as DatabaseConfig,

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  } as RedisConfig,

  // LLM Configuration
  llm: {
    provider: (process.env.LLM_PROVIDER || 'deepseek') as LLMConfig['provider'],
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL || 'deepseek-chat',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4000', 10),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    supportsTools: process.env.LLM_SUPPORTS_TOOLS === 'true',
  } as LLMConfig,

  // MCP Configuration
  mcp: {
    databaseEnabled: process.env.MCP_DATABASE_ENABLED === 'true',
    databaseType: process.env.MCP_DATABASE_TYPE || 'postgresql',
    fileSystemEnabled: process.env.MCP_FILE_SYSTEM_ENABLED === 'true',
    webSearchEnabled: process.env.MCP_WEB_SEARCH_ENABLED === 'true',
    webSearchApiKey: process.env.MCP_WEB_SEARCH_API_KEY,
  },

  // Tool Configuration
  tools: {
    enabled: (process.env.TOOLS_ENABLED || 'database_query,calculator').split(','),
    requireApproval: (process.env.TOOLS_REQUIRE_APPROVAL || 'database_query').split(','),
    autoApprove: (process.env.TOOLS_AUTO_APPROVE || 'calculator').split(','),
  },

  // API Configuration
  api: {
    rateLimitEnabled: process.env.API_RATE_LIMIT_ENABLED === 'true',
    defaultTimeout: parseInt(process.env.API_DEFAULT_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.API_MAX_RETRIES || '3', 10),
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    encryptionKey: process.env.ENCRYPTION_KEY || 'your-encryption-key',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
};

// Validation function
export function validateConfig(): void {
  const required = [
    'DATABASE_URL',
    'LLM_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate LLM provider
  const validProviders = ['deepseek', 'local', 'openai', 'anthropic'];
  if (!validProviders.includes(config.llm.provider)) {
    throw new Error(`Invalid LLM provider: ${config.llm.provider}. Must be one of: ${validProviders.join(', ')}`);
  }

  console.log('✅ Configuration validated successfully');
}

export default config;