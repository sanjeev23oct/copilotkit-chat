import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

export interface FunctionSignature {
  parameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  example: string;
  description: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  domain: string;
  priority: number;
  specific_tables?: string[];
  specific_functions?: string[];
  function_signatures?: Record<string, FunctionSignature>;
  table_patterns: string[];
  procedure_patterns: string[];
  function_patterns: string[];
  keywords: string[];
  external_apis: APIConfig[];
}

export interface APIConfig {
  name: string;
  endpoint: string;
  method: string;
  description: string;
  authentication?: {
    type: string;
    token_env?: string;
  };
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

export interface RoutingRuleConfig {
  pattern: string;
  target_agent: string;
  priority: number;
  type: 'regex' | 'string';
  orchestration_hint?: boolean;
  involved_agents?: string[];
}

export interface AgentSystemConfig {
  agents: Record<string, AgentConfig>;
  routing_rules: RoutingRuleConfig[];
  communication: {
    message_timeout: number;
    heartbeat_interval: number;
    max_retry_attempts: number;
    retry_delay: number;
  };
  performance: {
    query_timeout: number;
    max_parallel_agents: number;
    result_cache_ttl: number;
    max_result_size: number;
  };
  security: {
    enable_query_validation: boolean;
    allowed_sql_operations: string[];
    enable_audit_logging: boolean;
    rate_limit_per_agent: number;
  };
  development: {
    debug_mode: boolean;
    log_level: string;
    enable_mock_apis: boolean;
    mock_delay: number;
  };
}

export class AgentConfigLoader {
  private static instance: AgentConfigLoader;
  private config: AgentSystemConfig | null = null;
  private configPath: string;

  static getInstance(): AgentConfigLoader {
    if (!AgentConfigLoader.instance) {
      AgentConfigLoader.instance = new AgentConfigLoader();
    }
    return AgentConfigLoader.instance;
  }

  private constructor() {
    this.configPath = path.join(__dirname, 'agents.yaml');
  }

  /**
   * Load configuration from YAML file
   */
  async loadConfig(): Promise<AgentSystemConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      logger.info(`Loading agent configuration from: ${this.configPath}`);
      
      const fileContents = fs.readFileSync(this.configPath, 'utf8');
      const rawConfig = yaml.load(fileContents) as any;
      
      // Process environment variable substitutions
      this.config = this.processEnvironmentVariables(rawConfig);
      
      // Validate configuration
      this.validateConfig(this.config);
      
      logger.info(`Agent configuration loaded successfully with ${Object.keys(this.config.agents).length} agents`);
      
      return this.config;
    } catch (error) {
      logger.error('Failed to load agent configuration:', error);
      
      // Return fallback configuration
      return this.getFallbackConfig();
    }
  }

  /**
   * Get configuration for a specific agent
   */
  getAgentConfig(agentId: string): AgentConfig | null {
    if (!this.config) {
      logger.warn('Configuration not loaded, call loadConfig() first');
      return null;
    }

    return this.config.agents[agentId] || null;
  }

  /**
   * Get all agent configurations
   */
  getAllAgentConfigs(): Record<string, AgentConfig> {
    if (!this.config) {
      logger.warn('Configuration not loaded, call loadConfig() first');
      return {};
    }

    return this.config.agents;
  }

  /**
   * Get routing rules
   */
  getRoutingRules(): RoutingRuleConfig[] {
    if (!this.config) {
      logger.warn('Configuration not loaded, call loadConfig() first');
      return [];
    }

    return this.config.routing_rules;
  }

  /**
   * Get communication settings
   */
  getCommunicationConfig() {
    if (!this.config) {
      return {
        message_timeout: 30000,
        heartbeat_interval: 30000,
        max_retry_attempts: 3,
        retry_delay: 5000
      };
    }

    return this.config.communication;
  }

  /**
   * Get performance settings
   */
  getPerformanceConfig() {
    if (!this.config) {
      return {
        query_timeout: 60000,
        max_parallel_agents: 5,
        result_cache_ttl: 300000,
        max_result_size: 10000
      };
    }

    return this.config.performance;
  }

  /**
   * Get security settings
   */
  getSecurityConfig() {
    if (!this.config) {
      return {
        enable_query_validation: true,
        allowed_sql_operations: ['SELECT'],
        enable_audit_logging: true,
        rate_limit_per_agent: 100
      };
    }

    return this.config.security;
  }

  /**
   * Get development settings
   */
  getDevelopmentConfig() {
    if (!this.config) {
      return {
        debug_mode: false,
        log_level: 'info',
        enable_mock_apis: false,
        mock_delay: 1000
      };
    }

    return this.config.development;
  }

  /**
   * Reload configuration from file
   */
  async reloadConfig(): Promise<AgentSystemConfig> {
    this.config = null;
    return this.loadConfig();
  }

  /**
   * Process environment variable substitutions in configuration
   */
  private processEnvironmentVariables(config: any): AgentSystemConfig {
    const processValue = (value: any): any => {
      if (typeof value === 'string') {
        // Replace ${VAR_NAME} with environment variable values
        return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
          const envValue = process.env[varName];
          if (envValue === undefined) {
            logger.warn(`Environment variable ${varName} not found, keeping placeholder`);
            return match;
          }
          return envValue;
        });
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (typeof value === 'object' && value !== null) {
        const processed: any = {};
        for (const [key, val] of Object.entries(value)) {
          processed[key] = processValue(val);
        }
        return processed;
      }
      return value;
    };

    return processValue(config);
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: AgentSystemConfig): void {
    if (!config.agents || Object.keys(config.agents).length === 0) {
      throw new Error('No agents defined in configuration');
    }

    for (const [agentId, agentConfig] of Object.entries(config.agents)) {
      if (!agentConfig.name || !agentConfig.domain) {
        throw new Error(`Invalid agent configuration for ${agentId}: missing name or domain`);
      }

      if (!Array.isArray(agentConfig.table_patterns)) {
        throw new Error(`Invalid table_patterns for agent ${agentId}: must be an array`);
      }

      if (!Array.isArray(agentConfig.keywords)) {
        throw new Error(`Invalid keywords for agent ${agentId}: must be an array`);
      }
    }

    if (!Array.isArray(config.routing_rules)) {
      throw new Error('routing_rules must be an array');
    }

    for (const rule of config.routing_rules) {
      if (!rule.pattern || !rule.target_agent || typeof rule.priority !== 'number') {
        throw new Error('Invalid routing rule: missing required fields');
      }
    }

    logger.info('Agent configuration validation passed');
  }

  /**
   * Get fallback configuration when file loading fails
   */
  private getFallbackConfig(): AgentSystemConfig {
    logger.warn('Using fallback agent configuration');
    
    return {
      agents: {
        sewadar: {
          name: 'Sewadar Agent',
          description: 'Handles sewadar information',
          domain: 'sewadar',
          priority: 10,
          table_patterns: ['sewadar%', 'profile%'],
          procedure_patterns: ['sp_sewadar%'],
          function_patterns: ['fn_sewadar%'],
          keywords: ['sewadar', 'badge', 'profile'],
          external_apis: []
        },
        department: {
          name: 'Department Agent',
          description: 'Handles department information',
          domain: 'department',
          priority: 8,
          table_patterns: ['department%', 'section%'],
          procedure_patterns: ['sp_department%'],
          function_patterns: ['fn_department%'],
          keywords: ['department', 'section'],
          external_apis: []
        }
      },
      routing_rules: [
        {
          pattern: 'sewadar',
          target_agent: 'sewadar',
          priority: 15,
          type: 'string'
        },
        {
          pattern: 'department',
          target_agent: 'department',
          priority: 15,
          type: 'string'
        }
      ],
      communication: {
        message_timeout: 30000,
        heartbeat_interval: 30000,
        max_retry_attempts: 3,
        retry_delay: 5000
      },
      performance: {
        query_timeout: 60000,
        max_parallel_agents: 5,
        result_cache_ttl: 300000,
        max_result_size: 10000
      },
      security: {
        enable_query_validation: true,
        allowed_sql_operations: ['SELECT'],
        enable_audit_logging: true,
        rate_limit_per_agent: 100
      },
      development: {
        debug_mode: false,
        log_level: 'info',
        enable_mock_apis: false,
        mock_delay: 1000
      }
    };
  }

  /**
   * Create agent configuration from database discovery
   */
  async createConfigFromDiscovery(discoveredTables: any[]): Promise<Partial<AgentSystemConfig>> {
    const agentConfigs: Record<string, AgentConfig> = {};
    
    // Group tables by domain patterns
    const domainGroups = this.groupTablesByDomain(discoveredTables);
    
    for (const [domain, tables] of Object.entries(domainGroups)) {
      const tableNames = tables.map(t => t.table_name);
      const tablePatterns = this.extractPatterns(tableNames);
      
      agentConfigs[domain] = {
        name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Agent`,
        description: `Handles ${domain} related data`,
        domain,
        priority: 5,
        table_patterns: tablePatterns,
        procedure_patterns: [`sp_${domain}%`],
        function_patterns: [`fn_${domain}%`],
        keywords: [domain],
        external_apis: []
      };
    }

    return {
      agents: agentConfigs
    };
  }

  /**
   * Group tables by domain based on naming patterns
   */
  private groupTablesByDomain(tables: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      sewadar: [],
      department: [],
      attendance: [],
      admin: [],
      general: []
    };

    for (const table of tables) {
      const tableName = table.table_name.toLowerCase();
      
      if (tableName.includes('sewadar') || tableName.includes('profile') || tableName.includes('badge')) {
        groups.sewadar.push(table);
      } else if (tableName.includes('department') || tableName.includes('section') || tableName.includes('unit')) {
        groups.department.push(table);
      } else if (tableName.includes('attendance') || tableName.includes('duty') || tableName.includes('schedule')) {
        groups.attendance.push(table);
      } else if (tableName.includes('admin') || tableName.includes('user') || tableName.includes('role')) {
        groups.admin.push(table);
      } else {
        groups.general.push(table);
      }
    }

    // Remove empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, tables]) => tables.length > 0)
    );
  }

  /**
   * Extract patterns from table names
   */
  private extractPatterns(tableNames: string[]): string[] {
    const patterns = new Set<string>();
    
    for (const tableName of tableNames) {
      // Extract prefix patterns (e.g., 'sewadar_profiles' -> 'sewadar%')
      const parts = tableName.split('_');
      if (parts.length > 1) {
        patterns.add(`${parts[0]}%`);
      }
      
      // Add exact table name pattern
      patterns.add(tableName);
    }

    return Array.from(patterns);
  }
}

export default AgentConfigLoader;