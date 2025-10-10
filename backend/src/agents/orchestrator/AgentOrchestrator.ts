import { SharedContext, AgentResult } from '../base/BaseAgent';
import AgentRegistry, { AgentRegistration } from '../communication/AgentRegistry';
import AgentMessenger, { AgentMessage } from '../communication/AgentMessenger';
import { unifiedLLMService } from '../../services/llm/unified';
import { AGUIElement } from '../../types/agui';
import logger from '../../utils/logger';

export interface OrchestratedQuery {
  id: string;
  originalQuery: string;
  userId?: string | undefined;
  sessionId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deadline?: Date;
  context: SharedContext;
}

export interface QueryPlan {
  queryId: string;
  steps: QueryStep[];
  estimatedTime: number;
  involvedAgents: string[];
  dependencies: string[];
  parallelExecution: boolean;
}

export interface QueryStep {
  id: string;
  agentId: string;
  query: string;
  parameters?: any;
  dependsOn: string[];
  expectedData: string;
  timeout: number;
}

export interface OrchestratedResult {
  success: boolean;
  queryId: string;
  data: any[];
  combinedSummary: string;
  agui: AGUIElement[];
  involvedAgents: string[];
  executionPlan: QueryPlan;
  stepResults: Map<string, AgentResult>;
  executionTime: number;
  error?: string;
}

export class AgentOrchestrator {
  private static instance: AgentOrchestrator;
  private registry = AgentRegistry.getInstance();
  private messenger = AgentMessenger.getInstance();
  private activeQueries: Map<string, OrchestratedQuery> = new Map();
  private queryPlans: Map<string, QueryPlan> = new Map();
  private stepResults: Map<string, Map<string, AgentResult>> = new Map();

  static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  private constructor() {
    this.setupMessageHandlers();
    logger.info('AgentOrchestrator: Initialized');
  }

  /**
   * Process a complex query that may require multiple agents
   */
  async processQuery(
    query: string,
    userId?: string,
    sessionId: string = `session_${Date.now()}`,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<OrchestratedResult> {
    const startTime = Date.now();
    const queryId = this.generateQueryId();

    logger.info(`AgentOrchestrator: Processing query ${queryId}: "${query}"`);

    const orchestratedQuery: OrchestratedQuery = {
      id: queryId,
      originalQuery: query,
      userId,
      sessionId,
      priority,
      context: {
        originalQuery: query,
        userId,
        sessionId,
        relatedData: {},
        confidence: 0.8,
        executionPath: ['orchestrator']
      }
    };

    this.activeQueries.set(queryId, orchestratedQuery);

    try {
      // Analyze query to determine if orchestration is needed
      const queryPlan = await this.createQueryPlan(query, orchestratedQuery.context);
      this.queryPlans.set(queryId, queryPlan);

      // If only one agent is needed, route directly
      if (queryPlan.involvedAgents.length === 1) {
        return await this.executeSingleAgentQuery(queryId, queryPlan);
      }

      // Execute multi-agent orchestration
      return await this.executeMultiAgentQuery(queryId, queryPlan);

    } catch (error) {
      logger.error(`AgentOrchestrator: Error processing query ${queryId}:`, error);
      
      return {
        success: false,
        queryId,
        data: [],
        combinedSummary: 'Query processing failed',
        agui: [],
        involvedAgents: [],
        executionPlan: this.queryPlans.get(queryId)!,
        stepResults: new Map(),
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      // Cleanup
      this.activeQueries.delete(queryId);
      this.queryPlans.delete(queryId);
      this.stepResults.delete(queryId);
    }
  }

  /**
   * Create a query execution plan
   */
  private async createQueryPlan(query: string, _context: SharedContext): Promise<QueryPlan> {
    const availableAgents = this.registry.getOnlineAgents();
    
    if (availableAgents.length === 0) {
      throw new Error('No agents available for query processing');
    }

    // Use LLM to analyze query and create execution plan
    const planningPrompt = this.buildPlanningPrompt(query, availableAgents);
    
    try {
      const response = await unifiedLLMService.chat([
        { role: 'system', content: planningPrompt },
        { role: 'user', content: `Create execution plan for: "${query}"` }
      ], { temperature: 0.1, max_tokens: 1500 });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM for query planning');
      }

      // Parse JSON response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const plan: QueryPlan = JSON.parse(cleanContent);
      
      // Validate and adjust plan
      this.validateQueryPlan(plan, availableAgents);
      
      logger.info(`AgentOrchestrator: Created plan with ${plan.steps.length} steps involving ${plan.involvedAgents.length} agents`);
      
      return plan;
    } catch (error) {
      logger.error('AgentOrchestrator: Error creating query plan:', error);
      
      // Fallback to single agent plan
      const fallbackAgent = availableAgents[0];
      return this.createFallbackPlan(query, fallbackAgent);
    }
  }

  /**
   * Execute query with single agent
   */
  private async executeSingleAgentQuery(queryId: string, plan: QueryPlan): Promise<OrchestratedResult> {
    const startTime = Date.now();
    const agentId = plan.involvedAgents[0];
    const step = plan.steps[0];

    logger.info(`AgentOrchestrator: Executing single agent query with ${agentId}`);

    try {
      // Send query to agent
      const response = await this.messenger.sendRequest(
        'orchestrator',
        agentId,
        'queryData',
        {
          query: step.query,
          parameters: step.parameters
        },
        step.timeout
      );

      const agentResult: AgentResult = response.payload;
      const stepResults = new Map();
      stepResults.set(step.id, agentResult);

      return {
        success: agentResult.success,
        queryId,
        data: agentResult.data || [],
        combinedSummary: agentResult.summary || 'No summary available',
        agui: agentResult.agui || [],
        involvedAgents: [agentId],
        executionPlan: plan,
        stepResults,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error(`AgentOrchestrator: Single agent query failed:`, error);
      throw error;
    }
  }

  /**
   * Execute query with multiple agents
   */
  private async executeMultiAgentQuery(queryId: string, plan: QueryPlan): Promise<OrchestratedResult> {
    const startTime = Date.now();
    const orchestratedQuery = this.activeQueries.get(queryId)!;
    const stepResults = new Map<string, AgentResult>();
    
    this.stepResults.set(queryId, stepResults);

    logger.info(`AgentOrchestrator: Executing multi-agent query with ${plan.involvedAgents.length} agents`);

    try {
      if (plan.parallelExecution) {
        await this.executeStepsInParallel(plan, stepResults);
      } else {
        await this.executeStepsSequentially(plan, stepResults);
      }

      // Combine results from all steps
      const combinedData = this.combineStepData(stepResults);
      const combinedSummary = await this.generateCombinedSummary(orchestratedQuery.originalQuery, stepResults);
      const combinedAGUI = this.combineAGUIElements(stepResults);

      return {
        success: true,
        queryId,
        data: combinedData,
        combinedSummary,
        agui: combinedAGUI,
        involvedAgents: plan.involvedAgents,
        executionPlan: plan,
        stepResults,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error(`AgentOrchestrator: Multi-agent query failed:`, error);
      throw error;
    }
  }

  /**
   * Execute steps in parallel
   */
  private async executeStepsInParallel(plan: QueryPlan, stepResults: Map<string, AgentResult>): Promise<void> {
    const promises = plan.steps.map(step => this.executeStep(step, stepResults));
    await Promise.allSettled(promises);
  }

  /**
   * Execute steps sequentially respecting dependencies
   */
  private async executeStepsSequentially(plan: QueryPlan, stepResults: Map<string, AgentResult>): Promise<void> {
    const executed = new Set<string>();
    const remaining = [...plan.steps];

    while (remaining.length > 0) {
      // Find steps that can be executed (all dependencies met)
      const ready = remaining.filter(step => 
        step.dependsOn.every(dep => executed.has(dep))
      );

      if (ready.length === 0) {
        throw new Error('Circular dependency detected in query plan');
      }

      // Execute ready steps
      await Promise.all(ready.map(step => this.executeStep(step, stepResults)));

      // Mark as executed and remove from remaining
      ready.forEach(step => {
        executed.add(step.id);
        const index = remaining.indexOf(step);
        remaining.splice(index, 1);
      });
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: QueryStep, stepResults: Map<string, AgentResult>): Promise<void> {
    logger.info(`AgentOrchestrator: Executing step ${step.id} with agent ${step.agentId}`);

    try {
      // Prepare parameters with data from dependency steps
      const parameters = { ...step.parameters };
      for (const depId of step.dependsOn) {
        const depResult = stepResults.get(depId);
        if (depResult) {
          parameters[`${depId}_data`] = depResult.data;
        }
      }

      const response = await this.messenger.sendRequest(
        'orchestrator',
        step.agentId,
        'queryData',
        {
          query: step.query,
          parameters
        },
        step.timeout
      );

      stepResults.set(step.id, response.payload);
      logger.info(`AgentOrchestrator: Step ${step.id} completed successfully`);
    } catch (error) {
      logger.error(`AgentOrchestrator: Step ${step.id} failed:`, error);
      
      // Create error result
      stepResults.set(step.id, {
        success: false,
        error: error instanceof Error ? error.message : 'Step execution failed',
        involvedAgents: [step.agentId],
        executionTime: 0
      });
    }
  }

  /**
   * Combine data from all steps
   */
  private combineStepData(stepResults: Map<string, AgentResult>): any[] {
    const combinedData: any[] = [];

    for (const [stepId, result] of stepResults.entries()) {
      if (result.success && result.data) {
        // Add step identifier to each record
        const stepData = result.data.map(record => ({
          ...record,
          _stepId: stepId,
          _source: result.involvedAgents?.[0] || 'unknown'
        }));
        combinedData.push(...stepData);
      }
    }

    return combinedData;
  }

  /**
   * Generate combined summary from all step results
   */
  private async generateCombinedSummary(originalQuery: string, stepResults: Map<string, AgentResult>): Promise<string> {
    try {
      const stepSummaries: string[] = [];
      
      for (const [stepId, result] of stepResults.entries()) {
        if (result.summary) {
          stepSummaries.push(`**${stepId}**: ${result.summary}`);
        }
      }

      if (stepSummaries.length === 0) {
        return 'No summary available from agent results.';
      }

      // Use LLM to combine summaries
      const response = await unifiedLLMService.chat([
        {
          role: 'system',
          content: `You are a data analyst combining results from multiple specialized agents. Create a cohesive summary.

FORMATTING RULES:
- Start with overall findings
- Use **bold** for key insights
- Use bullet points for multiple items
- Keep under 200 words
- Focus on answering the original query`
        },
        {
          role: 'user',
          content: `Original Query: "${originalQuery}"

Step Results:
${stepSummaries.join('\n\n')}

Provide a combined summary.`
        }
      ], { temperature: 0.3, max_tokens: 600 });

      return response.choices[0]?.message?.content?.trim() || 
             `Combined results from ${stepResults.size} specialized agents.`;
    } catch (error) {
      logger.error('AgentOrchestrator: Error generating combined summary:', error);
      return `Combined results from ${stepResults.size} specialized agents for your query.`;
    }
  }

  /**
   * Combine AGUI elements from all steps
   */
  private combineAGUIElements(stepResults: Map<string, AgentResult>): AGUIElement[] {
    const combinedElements: AGUIElement[] = [];

    for (const [stepId, result] of stepResults.entries()) {
      if (result.agui) {
        // Add step identifier to element IDs
        const stepElements = result.agui.map(element => ({
          ...element,
          id: `${stepId}_${element.id}`,
          props: {
            ...element.props,
            caption: `${element.props?.caption || 'Data'} - ${stepId}`
          }
        }));
        combinedElements.push(...stepElements);
      }
    }

    return combinedElements;
  }

  /**
   * Build planning prompt for LLM
   */
  private buildPlanningPrompt(_query: string, availableAgents: AgentRegistration[]): string {
    const agentInfo = availableAgents.map(agent => 
      `${agent.agentId} (${agent.domain}): Tables: ${agent.tablePatterns.join(', ')}`
    ).join('\n');

    return `You are a query orchestration planner. Analyze queries and create execution plans for multiple specialized agents.

AVAILABLE AGENTS:
${agentInfo}

PLANNING RULES:
1. Use single agent if query is domain-specific
2. Use multiple agents for cross-domain queries
3. Consider data dependencies between steps
4. Minimize agent communication overhead
5. Prefer parallel execution when possible

Return JSON format:
{
  "queryId": "unique_id",
  "steps": [
    {
      "id": "step1",
      "agentId": "agent_id",
      "query": "specific query for agent",
      "parameters": {},
      "dependsOn": [],
      "expectedData": "description",
      "timeout": 30000
    }
  ],
  "estimatedTime": 5000,
  "involvedAgents": ["agent1", "agent2"],
  "dependencies": ["step1->step2"],
  "parallelExecution": false
}`;
  }

  /**
   * Validate and adjust query plan
   */
  private validateQueryPlan(plan: QueryPlan, availableAgents: AgentRegistration[]): void {
    const agentIds = new Set(availableAgents.map(a => a.agentId));
    
    // Ensure all agents in plan are available
    for (const agentId of plan.involvedAgents) {
      if (!agentIds.has(agentId)) {
        throw new Error(`Agent ${agentId} in plan is not available`);
      }
    }

    // Ensure all steps reference valid agents
    for (const step of plan.steps) {
      if (!agentIds.has(step.agentId)) {
        step.agentId = availableAgents[0].agentId; // Fallback to first available
      }
      
      // Set default timeout if not specified
      if (!step.timeout || step.timeout <= 0) {
        step.timeout = 30000;
      }
    }
  }

  /**
   * Create fallback plan for single agent
   */
  private createFallbackPlan(query: string, agent: AgentRegistration): QueryPlan {
    return {
      queryId: this.generateQueryId(),
      steps: [
        {
          id: 'fallback_step',
          agentId: agent.agentId,
          query,
          dependsOn: [],
          expectedData: 'Query results',
          timeout: 30000
        }
      ],
      estimatedTime: 5000,
      involvedAgents: [agent.agentId],
      dependencies: [],
      parallelExecution: false
    };
  }

  /**
   * Setup message handlers for orchestrator
   */
  private setupMessageHandlers(): void {
    this.messenger.subscribe(
      'orchestrator',
      ['queryStatus', 'agentOffline', 'healthCheck'],
      this.handleMessage.bind(this),
      5 // High priority
    );
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(message: AgentMessage): Promise<AgentMessage | void> {
    logger.info(`AgentOrchestrator: Received message: ${message.action}`);

    switch (message.action) {
      case 'queryStatus':
        return this.handleQueryStatus(message);
      case 'agentOffline':
        return this.handleAgentOffline(message);
      case 'healthCheck':
        return this.handleHealthCheck(message);
    }
  }

  /**
   * Handle query status requests
   */
  private async handleQueryStatus(message: AgentMessage): Promise<AgentMessage> {
    const { queryId } = message.payload;
    const query = this.activeQueries.get(queryId);
    const plan = this.queryPlans.get(queryId);
    
    return {
      ...message,
      from: 'orchestrator',
      to: message.from,
      type: 'response',
      payload: {
        exists: !!query,
        status: query ? 'active' : 'not_found',
        plan: plan || null
      },
      timestamp: new Date()
    } as AgentMessage;
  }

  /**
   * Handle agent offline notifications
   */
  private async handleAgentOffline(message: AgentMessage): Promise<void> {
    const { agentId } = message.payload;
    logger.warn(`AgentOrchestrator: Agent ${agentId} went offline`);
    
    // Here we could implement query rerouting logic
    // For now, just log the event
  }

  /**
   * Handle health check requests
   */
  private async handleHealthCheck(message: AgentMessage): Promise<AgentMessage> {
    return {
      ...message,
      from: 'orchestrator',
      to: message.from,
      type: 'response',
      payload: {
        status: 'healthy',
        activeQueries: this.activeQueries.size,
        activePlans: this.queryPlans.size
      },
      timestamp: new Date()
    } as AgentMessage;
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get orchestrator health status
   */
  getHealthStatus() {
    return {
      status: 'active',
      activeQueries: this.activeQueries.size,
      activePlans: this.queryPlans.size,
      availableAgents: this.registry.getOnlineAgents().length
    };
  }
}

export default AgentOrchestrator;