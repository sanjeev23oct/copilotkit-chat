import { BaseAgent } from '../base/BaseAgent';
import AgentMessenger, { MessagePatterns } from './AgentMessenger';
import logger from '../../utils/logger';

export interface AgentCapability {
  name: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

export interface AgentRegistration {
  agentId: string;
  agentName: string;
  domain: string;
  status: 'online' | 'busy' | 'offline';
  capabilities: AgentCapability[];
  tablePatterns: string[];
  procedurePatterns: string[];
  functionPatterns: string[];
  apiEndpoints: string[];
  lastHeartbeat: Date;
  priority: number;
  metadata: {
    version: string;
    description: string;
    tags: string[];
  };
}

export interface RoutingRule {
  pattern: string | RegExp;
  targetAgent: string;
  priority: number;
  condition?: (query: string, context?: any) => boolean;
}

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, AgentRegistration> = new Map();
  private routingRules: RoutingRule[] = [];
  private messenger = AgentMessenger.getInstance();
  private messagePatterns = new MessagePatterns();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs = 30000; // 30 seconds

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  private constructor() {
    this.startHeartbeatMonitoring();
    logger.info('AgentRegistry: Initialized');
  }

  /**
   * Register an agent with the registry
   */
  async registerAgent(agent: BaseAgent): Promise<void> {
    const agentId = agent.getAgentId();
    
    const registration: AgentRegistration = {
      agentId,
      agentName: agent.getAgentName(),
      domain: agent.getDomain(),
      status: 'online',
      capabilities: await this.extractCapabilities(agent),
      tablePatterns: agent.getTablePatterns ? agent.getTablePatterns() : [],
      procedurePatterns: agent.getProcedurePatterns ? agent.getProcedurePatterns() : [],
      functionPatterns: agent.getFunctionPatterns ? agent.getFunctionPatterns() : [],
      apiEndpoints: agent.getAPIResources ? agent.getAPIResources().map(api => api.name) : [],
      lastHeartbeat: new Date(),
      priority: 1,
      metadata: {
        version: '1.0.0',
        description: `${agent.getAgentName()} for ${agent.getDomain()} domain`,
        tags: [agent.getDomain(), 'database', 'query']
      }
    };

    this.agents.set(agentId, registration);

    // Subscribe agent to registry messages
    this.messenger.subscribe(
      agentId,
      ['healthCheck', 'getCapabilities', 'routeQuery', 'collaborate'],
      agent.handleMessage.bind(agent),
      1
    );

    // Add default routing rules for the agent
    this.addDefaultRoutingRules(registration);

    // Broadcast agent registration
    await this.messagePatterns.broadcastStatus(agentId, 'online');

    logger.info(`AgentRegistry: Registered agent ${agentId} for domain ${registration.domain}`);
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const registration = this.agents.get(agentId);
    if (!registration) {
      logger.warn(`AgentRegistry: Agent ${agentId} not found for unregistration`);
      return;
    }

    // Update status to offline
    registration.status = 'offline';

    // Unsubscribe from messenger
    this.messenger.unsubscribe(agentId);

    // Remove routing rules for this agent
    this.routingRules = this.routingRules.filter(rule => rule.targetAgent !== agentId);

    // Broadcast agent offline status
    await this.messagePatterns.broadcastStatus(agentId, 'offline');

    // Remove from registry after broadcast
    this.agents.delete(agentId);

    logger.info(`AgentRegistry: Unregistered agent ${agentId}`);
  }

  /**
   * Find the best agent to handle a query
   */
  async routeQuery(query: string, context?: any): Promise<string | null> {
    const queryLower = query.toLowerCase();
    const availableAgents = Array.from(this.agents.values())
      .filter(agent => agent.status === 'online')
      .sort((a, b) => b.priority - a.priority);

    if (availableAgents.length === 0) {
      logger.warn('AgentRegistry: No available agents for query routing');
      return null;
    }

    // Try routing rules first
    for (const rule of this.routingRules.sort((a, b) => b.priority - a.priority)) {
      const agent = this.agents.get(rule.targetAgent);
      if (!agent || agent.status !== 'online') continue;

      let matches = false;
      
      if (typeof rule.pattern === 'string') {
        matches = queryLower.includes(rule.pattern.toLowerCase());
      } else {
        matches = rule.pattern.test(query);
      }

      if (matches && (!rule.condition || rule.condition(query, context))) {
        logger.info(`AgentRegistry: Routed query to ${rule.targetAgent} via rule: ${rule.pattern}`);
        return rule.targetAgent;
      }
    }

    // Fallback to domain-based routing
    const domainAgent = this.findAgentByDomain(queryLower);
    if (domainAgent) {
      logger.info(`AgentRegistry: Routed query to ${domainAgent} via domain matching`);
      return domainAgent;
    }

    // Default to first available agent
    const defaultAgent = availableAgents[0];
    logger.info(`AgentRegistry: Routed query to default agent: ${defaultAgent.agentId}`);
    return defaultAgent.agentId;
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agents by domain
   */
  getAgentsByDomain(domain: string): AgentRegistration[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.domain === domain);
  }

  /**
   * Get online agents
   */
  getOnlineAgents(): AgentRegistration[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.status === 'online');
  }

  /**
   * Add custom routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.push(rule);
    this.routingRules.sort((a, b) => b.priority - a.priority);
    logger.info(`AgentRegistry: Added routing rule: ${rule.pattern} -> ${rule.targetAgent}`);
  }

  /**
   * Remove routing rule
   */
  removeRoutingRule(pattern: string | RegExp, targetAgent: string): void {
    const initialLength = this.routingRules.length;
    this.routingRules = this.routingRules.filter(rule => 
      !(rule.pattern === pattern && rule.targetAgent === targetAgent)
    );
    
    if (this.routingRules.length < initialLength) {
      logger.info(`AgentRegistry: Removed routing rule: ${pattern} -> ${targetAgent}`);
    }
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId: string, status: 'online' | 'busy' | 'offline'): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn(`AgentRegistry: Agent ${agentId} not found for status update`);
      return;
    }

    const oldStatus = agent.status;
    agent.status = status;
    agent.lastHeartbeat = new Date();

    if (oldStatus !== status) {
      await this.messagePatterns.broadcastStatus(agentId, status);
      logger.info(`AgentRegistry: Agent ${agentId} status changed: ${oldStatus} -> ${status}`);
    }
  }

  /**
   * Record heartbeat from agent
   */
  heartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date();
    }
  }

  /**
   * Get registry health status
   */
  getHealthStatus(): {
    totalAgents: number;
    onlineAgents: number;
    busyAgents: number;
    offlineAgents: number;
    domains: string[];
    routingRules: number;
  } {
    const agents = Array.from(this.agents.values());
    
    return {
      totalAgents: agents.length,
      onlineAgents: agents.filter(a => a.status === 'online').length,
      busyAgents: agents.filter(a => a.status === 'busy').length,
      offlineAgents: agents.filter(a => a.status === 'offline').length,
      domains: [...new Set(agents.map(a => a.domain))],
      routingRules: this.routingRules.length
    };
  }

  /**
   * Extract capabilities from agent
   */
  private async extractCapabilities(_agent: BaseAgent): Promise<AgentCapability[]> {
    const capabilities: AgentCapability[] = [
      {
        name: 'processQuery',
        description: 'Process natural language queries'
      },
      {
        name: 'handleMessage',
        description: 'Handle inter-agent messages'
      }
    ];

    // Add domain-specific capabilities
    // All agents have these capabilities since they're abstract methods
    capabilities.push({
      name: 'queryTables',
      description: 'Query domain-specific database tables',
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'Natural language query' },
        { name: 'tableHints', type: 'array', required: false, description: 'Table name hints' }
      ]
    });

    capabilities.push({
      name: 'executeProcedures',
      description: 'Execute domain-specific stored procedures'
    });

    capabilities.push({
      name: 'executeFunctions',
      description: 'Execute domain-specific database functions'
    });

    capabilities.push({
      name: 'callExternalAPIs',
      description: 'Call external web APIs'
    });

    return capabilities;
  }

  /**
   * Add default routing rules for an agent
   */
  private addDefaultRoutingRules(registration: AgentRegistration): void {
    const { domain, tablePatterns, agentId } = registration;

    // Add domain-based rule
    this.addRoutingRule({
      pattern: domain,
      targetAgent: agentId,
      priority: 5
    });

    // Add table pattern rules
    tablePatterns.forEach(pattern => {
      const cleanPattern = pattern.replace('%', '');
      if (cleanPattern.length > 0) {
        this.addRoutingRule({
          pattern: cleanPattern,
          targetAgent: agentId,
          priority: 10
        });
      }
    });

    // Add specific keywords for common agent types
    if (domain === 'sewadar') {
      this.addRoutingRule({
        pattern: /\b(sewadar|badge|profile|eligibility)\b/i,
        targetAgent: agentId,
        priority: 15
      });
    }

    if (domain === 'department') {
      this.addRoutingRule({
        pattern: /\b(department|section|unit|division)\b/i,
        targetAgent: agentId,
        priority: 15
      });
    }

    if (domain === 'attendance') {
      this.addRoutingRule({
        pattern: /\b(attendance|present|absent|duty|schedule)\b/i,
        targetAgent: agentId,
        priority: 15
      });
    }
  }

  /**
   * Find agent by domain keywords
   */
  private findAgentByDomain(queryLower: string): string | null {
    const availableAgents = Array.from(this.agents.values())
      .filter(agent => agent.status === 'online');

    // Check domain keywords
    for (const agent of availableAgents) {
      if (queryLower.includes(agent.domain.toLowerCase())) {
        return agent.agentId;
      }

      // Check table patterns
      for (const pattern of agent.tablePatterns) {
        const cleanPattern = pattern.replace('%', '').toLowerCase();
        if (cleanPattern.length > 0 && queryLower.includes(cleanPattern)) {
          return agent.agentId;
        }
      }
    }

    return null;
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkAgentHealth();
    }, this.heartbeatIntervalMs);

    logger.info('AgentRegistry: Started heartbeat monitoring');
  }

  /**
   * Check agent health and mark stale agents as offline
   */
  private checkAgentHealth(): void {
    const now = new Date();
    const staleThreshold = this.heartbeatIntervalMs * 3; // 90 seconds

    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.status === 'online' || agent.status === 'busy') {
        const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > staleThreshold) {
          logger.warn(`AgentRegistry: Agent ${agentId} marked as offline due to stale heartbeat`);
          agent.status = 'offline';
        }
      }
    }
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('AgentRegistry: Stopped heartbeat monitoring');
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.stopHeartbeatMonitoring();
    
    // Mark all agents as offline
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.status !== 'offline') {
        await this.updateAgentStatus(agentId, 'offline');
      }
    }

    logger.info('AgentRegistry: Shutdown complete');
  }
}

export default AgentRegistry;