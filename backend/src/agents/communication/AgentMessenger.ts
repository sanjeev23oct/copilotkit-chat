import logger from '../../utils/logger';

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'notification' | 'broadcast';
  action: string;
  payload: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: Date;
  timeout?: number;
  requiresResponse?: boolean;
  correlationId?: string;
  metadata?: {
    retryCount?: number;
    originalSender?: string;
    routingPath?: string[];
  };
}

export interface MessageHandler {
  (message: AgentMessage): Promise<AgentMessage | void>;
}

export interface AgentSubscription {
  agentId: string;
  actions: string[];
  handler: MessageHandler;
  priority: number;
}

export class AgentMessenger {
  private static instance: AgentMessenger;
  private subscriptions: Map<string, AgentSubscription[]> = new Map();
  private pendingResponses: Map<string, {
    resolve: (value: AgentMessage) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private messageHistory: AgentMessage[] = [];
  private maxHistorySize = 1000;

  static getInstance(): AgentMessenger {
    if (!AgentMessenger.instance) {
      AgentMessenger.instance = new AgentMessenger();
    }
    return AgentMessenger.instance;
  }

  private constructor() {
    logger.info('AgentMessenger: Initialized');
  }

  /**
   * Subscribe an agent to receive specific types of messages
   */
  subscribe(agentId: string, actions: string[], handler: MessageHandler, priority: number = 0): void {
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, []);
    }

    const subscription: AgentSubscription = {
      agentId,
      actions,
      handler,
      priority
    };

    this.subscriptions.get(agentId)!.push(subscription);
    this.subscriptions.get(agentId)!.sort((a, b) => b.priority - a.priority);

    logger.info(`AgentMessenger: Agent ${agentId} subscribed to actions: ${actions.join(', ')}`);
  }

  /**
   * Unsubscribe an agent from all message types
   */
  unsubscribe(agentId: string): void {
    this.subscriptions.delete(agentId);
    logger.info(`AgentMessenger: Agent ${agentId} unsubscribed from all messages`);
  }

  /**
   * Send a message to a specific agent
   */
  async sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<AgentMessage | void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date()
    };

    // Add to history
    this.addToHistory(fullMessage);

    logger.info(`AgentMessenger: Sending ${fullMessage.type} from ${fullMessage.from} to ${fullMessage.to}: ${fullMessage.action}`);

    // Handle broadcast messages
    if (fullMessage.to === '*' || fullMessage.type === 'broadcast') {
      return this.broadcastMessage(fullMessage);
    }

    // Handle direct messages
    const targetSubscriptions = this.subscriptions.get(fullMessage.to);
    if (!targetSubscriptions || targetSubscriptions.length === 0) {
      logger.warn(`AgentMessenger: No subscriptions found for agent ${fullMessage.to}`);
      return;
    }

    // Find matching handlers
    const matchingHandlers = targetSubscriptions.filter(sub => 
      sub.actions.includes(fullMessage.action) || sub.actions.includes('*')
    );

    if (matchingHandlers.length === 0) {
      logger.warn(`AgentMessenger: No handlers found for action ${fullMessage.action} on agent ${fullMessage.to}`);
      return;
    }

    // Execute highest priority handler
    const handler = matchingHandlers[0];
    try {
      const response = await handler.handler(fullMessage);
      
      if (response) {
        this.addToHistory(response);
        logger.info(`AgentMessenger: Received response from ${response.from}: ${response.action}`);
      }
      
      return response;
    } catch (error) {
      logger.error(`AgentMessenger: Error handling message ${fullMessage.id}:`, error);
      throw error;
    }
  }

  /**
   * Send a request message and wait for response
   */
  async sendRequest(
    from: string,
    to: string,
    action: string,
    payload: any,
    timeout: number = 30000
  ): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      from,
      to,
      type: 'request',
      action,
      payload,
      priority: 'normal',
      timestamp: new Date(),
      timeout,
      requiresResponse: true,
      correlationId: this.generateMessageId()
    };

    return new Promise(async (resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(message.correlationId!);
        reject(new Error(`Request timeout: ${action} to ${to}`));
      }, timeout);

      // Store pending response handler
      this.pendingResponses.set(message.correlationId!, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      try {
        const response = await this.sendMessage(message);
        
        // If we got an immediate response, resolve
        if (response && response.type === 'response') {
          clearTimeout(timeoutHandle);
          this.pendingResponses.delete(message.correlationId!);
          resolve(response);
        }
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pendingResponses.delete(message.correlationId!);
        reject(error);
      }
    });
  }

  /**
   * Send a response to a request message
   */
  async sendResponse(
    originalMessage: AgentMessage,
    from: string,
    responsePayload: any
  ): Promise<void> {
    const response: AgentMessage = {
      id: this.generateMessageId(),
      from,
      to: originalMessage.from,
      type: 'response',
      action: `${originalMessage.action}_response`,
      payload: responsePayload,
      priority: originalMessage.priority,
      timestamp: new Date(),
      correlationId: originalMessage.correlationId || originalMessage.id
    };

    // Handle pending response if this is a response to a request
    if (originalMessage.requiresResponse && response.correlationId) {
      const pending = this.pendingResponses.get(response.correlationId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingResponses.delete(response.correlationId);
        this.addToHistory(response);
        pending.resolve(response);
        return;
      }
    }

    // Send as regular message
    await this.sendMessage(response);
  }

  /**
   * Broadcast a message to all subscribed agents
   */
  private async broadcastMessage(message: AgentMessage): Promise<void> {
    const responses: Promise<AgentMessage | void>[] = [];

    for (const [agentId, subscriptions] of this.subscriptions.entries()) {
      if (agentId === message.from) continue; // Don't send to sender

      const matchingHandlers = subscriptions.filter(sub => 
        sub.actions.includes(message.action) || sub.actions.includes('*')
      );

      for (const handler of matchingHandlers) {
        responses.push(
          handler.handler(message).catch(error => {
            logger.error(`AgentMessenger: Error in broadcast handler for ${agentId}:`, error);
            return undefined;
          })
        );
      }
    }

    await Promise.allSettled(responses);
    logger.info(`AgentMessenger: Broadcast ${message.action} sent to ${responses.length} handlers`);
  }

  /**
   * Get message history for debugging
   */
  getMessageHistory(agentId?: string, limit: number = 100): AgentMessage[] {
    let history = this.messageHistory;
    
    if (agentId) {
      history = history.filter(msg => msg.from === agentId || msg.to === agentId);
    }
    
    return history.slice(-limit);
  }

  /**
   * Get current subscriptions for debugging
   */
  getSubscriptions(): Map<string, AgentSubscription[]> {
    return new Map(this.subscriptions);
  }

  /**
   * Get pending responses count
   */
  getPendingResponsesCount(): number {
    return this.pendingResponses.size;
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
    logger.info('AgentMessenger: Message history cleared');
  }

  /**
   * Cleanup expired pending responses
   */
  cleanupExpiredResponses(): void {
    // const now = Date.now(); // Reserved for future timestamp logging
    for (const [_correlationId, _pending] of this.pendingResponses.entries()) {
      // Check if timeout has passed (timeout is already set to fire, but clean up map)
      // This is for cleanup in case of memory leaks
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(message: AgentMessage): void {
    this.messageHistory.push(message);
    
    // Trim history if it gets too large
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize * 0.8);
    }
  }
}

/**
 * Utility class for common message patterns
 */
export class MessagePatterns {
  private messenger = AgentMessenger.getInstance();

  /**
   * Request data from another agent
   */
  async requestData(
    from: string,
    to: string,
    dataType: string,
    filters?: any,
    timeout?: number
  ): Promise<any> {
    const response = await this.messenger.sendRequest(
      from,
      to,
      'getData',
      { dataType, filters },
      timeout
    );
    
    return response.payload;
  }

  /**
   * Share context with another agent
   */
  async shareContext(
    from: string,
    to: string,
    context: any,
    contextType: string = 'general'
  ): Promise<void> {
    await this.messenger.sendMessage({
      from,
      to,
      type: 'notification',
      action: 'shareContext',
      payload: { context, contextType },
      priority: 'normal'
    });
  }

  /**
   * Broadcast availability status
   */
  async broadcastStatus(from: string, status: 'online' | 'busy' | 'offline'): Promise<void> {
    await this.messenger.sendMessage({
      from,
      to: '*',
      type: 'broadcast',
      action: 'statusUpdate',
      payload: { status },
      priority: 'low'
    });
  }

  /**
   * Request collaboration on a query
   */
  async requestCollaboration(
    from: string,
    to: string,
    query: string,
    context: any,
    deadline?: Date
  ): Promise<any> {
    const response = await this.messenger.sendRequest(
      from,
      to,
      'collaborate',
      { query, context, deadline },
      deadline ? deadline.getTime() - Date.now() : 30000
    );
    
    return response.payload;
  }
}

export default AgentMessenger;