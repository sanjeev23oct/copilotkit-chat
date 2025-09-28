import { Router } from 'express';
import { chatService } from '../services/chat';
import logger from '../utils/logger';

const router = Router();

// CopilotKit GraphQL endpoint - handle generateCopilotResponse mutation
router.post('/', async (req, res) => {
  try {
    logger.info('CopilotKit endpoint called');
    logger.info('Request body keys:', Object.keys(req.body));
    
    const { operationName, variables } = req.body;
    
    // Handle GraphQL generateCopilotResponse mutation
    if (operationName === 'generateCopilotResponse' && variables?.data) {
      const { messages } = variables.data;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          errors: [{ message: 'Messages array is required' }]
        });
      }
      
      // Find the LATEST user message (skip system messages)
      const userMessage = messages.reverse().find(msg => msg.textMessage?.role === 'user');
      if (!userMessage) {
        return res.status(400).json({
          errors: [{ message: 'No user message found' }]
        });
      }
      
      logger.info('Processing user message:', userMessage.textMessage.content);
      
      // Create conversation and get DeepSeek response
      const conversation = await chatService.createConversation(`CopilotKit Chat ${Date.now()}`);
      logger.info('Created conversation:', conversation.id);
      
      const response = await chatService.sendMessage(conversation.id, userMessage.textMessage.content, false);
      logger.info('Got response from chatService:', typeof response, response);
      
      // Type guard to check if response is ChatMessage
      if (typeof response === 'object' && 'content' in response) {
        // Return simple GraphQL-compatible response (this was working before)
        return res.json({
          data: {
            generateCopilotResponse: {
              threadId: conversation.id,
              runId: `run_${Date.now()}`,
              extensions: {},
              status: {
                code: 'SUCCESS',
                __typename: 'BaseResponseStatus'
              },
              messages: [{
                __typename: 'TextMessageOutput',
                id: `msg_${Date.now()}`,
                createdAt: new Date().toISOString(),
                content: [response.content],
                role: 'assistant',
                parentMessageId: userMessage.id,
                status: {
                  code: 'SUCCESS',
                  __typename: 'SuccessMessageStatus'
                }
              }],
              metaEvents: [],
              __typename: 'CopilotResponse'
            }
          }
        });
      } else {
        return res.status(500).json({
          errors: [{ message: 'Failed to get response from DeepSeek' }]
        });
      }
    }
    
    // For non-GraphQL requests, return simple response
    return res.json({
      message: 'CopilotKit endpoint is available',
      status: 'ok'
    });
    
  } catch (error) {
    logger.error('CopilotKit runtime error:', error);
    return res.status(500).json({
      errors: [{ 
        message: error instanceof Error ? error.message : 'Internal server error'
      }]
    });
  }
});

// AG-UI Stream endpoint for CoAgent integration
router.get('/stream/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;
    const { message } = req.query;
    const userMessage = (message as string) || "Hello";
    
    logger.info('AG-UI Stream for agent:', agentName, 'message:', userMessage);

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send RUN_STARTED event
    const startEvent = {
      event: "RUN_STARTED",
      agent: agentName,
      timestamp: new Date().toISOString(),
      data: { message: userMessage }
    };
    res.write(`data: ${JSON.stringify(startEvent)}\n\n`);

    // Create conversation and process message
    const conversation = await chatService.createConversation(`${agentName} Stream`);
    const stream = await chatService.sendMessage(conversation.id, userMessage, true);
    
    let agentState: any = {
      conversationId: conversation.id,
      agentName,
      lastMessage: userMessage,
      startTime: new Date().toISOString()
    };

    if (Symbol.asyncIterator in Object(stream)) {
      for await (const chunk of stream as AsyncIterable<any>) {
        logger.debug('Processing AG-UI chunk for agent:', agentName, chunk);
        
        if (chunk.type === 'text' && chunk.content) {
          // Send PROGRESS event for text content
          const progressEvent = {
            event: "PROGRESS",
            agent: agentName,
            message: chunk.content,
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(progressEvent)}\n\n`);
          
          // Update agent state
          agentState.lastResponse = (agentState.lastResponse || '') + chunk.content;
          
        } else if (chunk.type === 'agui' && chunk.agui) {
          // Convert AGUI elements to state updates
          agentState.aguiElements = agentState.aguiElements || [];
          agentState.aguiElements.push(chunk.agui);
          
          // Send STATE_DELTA event
          const stateEvent = {
            event: "STATE_DELTA",
            agent: agentName,
            data: agentState,
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(stateEvent)}\n\n`);
          
        } else if (chunk.type === 'done') {
          // Send final state snapshot
          agentState.endTime = new Date().toISOString();
          agentState.duration = Date.now() - new Date(agentState.startTime).getTime();
          
          const snapshotEvent = {
            event: "STATE_SNAPSHOT",
            agent: agentName,
            data: agentState,
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(snapshotEvent)}\n\n`);
          
          // Send RUN_FINISHED event
          const finishEvent = {
            event: "RUN_FINISHED",
            agent: agentName,
            timestamp: new Date().toISOString(),
            summary: {
              duration: agentState.duration,
              aguiElementsCount: agentState.aguiElements?.length || 0,
              responseLength: agentState.lastResponse?.length || 0
            }
          };
          res.write(`data: ${JSON.stringify(finishEvent)}\n\n`);
          break;
          
        } else if (chunk.type === 'error') {
          const errorEvent = {
            event: "ERROR",
            agent: agentName,
            error: chunk.error,
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
          break;
        }
      }
    }

    res.end();
    
  } catch (error) {
    logger.error('AG-UI Stream error:', error);
    const errorEvent = {
      event: "ERROR",
      agent: req.params.agentName,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
});

// CoAgent state endpoint
router.get('/agents/:agentName/state', async (req, res) => {
  try {
    const { agentName } = req.params;
    logger.info('Getting state for agent:', agentName);
    
    // For now, return empty state - this would be enhanced with actual state management
    res.json({
      state: {},
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Agent state error:', error);
    res.status(500).json({
      error: 'Failed to get agent state',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// CoAgent state update endpoint
router.post('/agents/:agentName/state', async (req, res) => {
  try {
    const { agentName } = req.params;
    const { state } = req.body;
    
    logger.info('Updating state for agent:', agentName);
    logger.info('New state:', state);
    
    // For now, just acknowledge - this would be enhanced with actual state persistence
    res.json({
      success: true,
      agentName,
      state,
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Agent state update error:', error);
    res.status(500).json({
      error: 'Failed to update agent state',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;