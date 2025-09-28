import { Router, Request, Response } from 'express';
import { chatService } from '../services/chat';
import { aguiActionRegistry } from '../services/agui/actions';
import logger from '../utils/logger';

const router = Router();

// Create a new conversation
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    const conversation = await chatService.createConversation(title);

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create conversation'
    });
  }
});

// Get all conversations
router.get('/conversations', async (_req: Request, res: Response) => {
  try {
    const conversations = chatService.getAllConversations();

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch conversations'
    });
  }
});

// Get a specific conversation
router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = chatService.getConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json(conversation);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch conversation'
    });
  }
});

// Send a message (non-streaming)
router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    const response = await chatService.sendMessage(id, content, false);

    return res.json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    });
  }
});

// Send a message (streaming)
router.post('/conversations/:id/messages/stream', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Ensure conversation exists (will auto-create if missing)
    logger.info(`Processing streaming message for conversation: ${id}`);
    logger.info(`Message content: ${content}`);

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    logger.info('SSE headers set, calling sendMessage');
    
    // Send RUN_STARTED event
    res.write('data: {"event": "RUN_STARTED", "timestamp": "' + new Date().toISOString() + '"}\n\n');

    try {
      const stream = await chatService.sendMessage(id, content, true);
      logger.info('Got stream from chatService');

      if (Symbol.asyncIterator in Object(stream)) {
        logger.info('Stream is async iterable, starting to process chunks');
        for await (const chunk of stream as AsyncIterable<any>) {
          logger.info('Processing chunk:', chunk);
          
          // Convert to AG-UI event format
          let eventData;
          if (chunk.type === 'text' && chunk.content) {
            eventData = {
              event: "TEXT_MESSAGE_CONTENT",
              message: chunk.content,
              timestamp: new Date().toISOString()
            };
          } else if (chunk.type === 'agui' && chunk.agui) {
            eventData = {
              event: "STATE_DELTA",
              data: chunk.agui,
              timestamp: new Date().toISOString()
            };
          } else if (chunk.type === 'done') {
            eventData = {
              event: "RUN_FINISHED",
              timestamp: new Date().toISOString()
            };
          } else if (chunk.type === 'error') {
            eventData = {
              event: "ERROR",
              error: chunk.error,
              timestamp: new Date().toISOString()
            };
          } else {
            // Keep original format for other types
            eventData = chunk;
          }
          
          const data = JSON.stringify(eventData);
          res.write(`data: ${data}\n\n`);

          if (chunk.type === 'done' || chunk.type === 'error') {
            logger.info('Stream finished with type:', chunk.type);
            break;
          }
        }
      } else {
        logger.error('Stream is not async iterable');
        res.write('data: {"event": "ERROR", "error": "Invalid stream response", "timestamp": "' + new Date().toISOString() + '"}\n\n');
      }
    } catch (streamError) {
      logger.error('Error in stream processing:', streamError);
      res.write(`data: {"event": "ERROR", "error": "${streamError instanceof Error ? streamError.message : 'Stream processing error'}", "timestamp": "${new Date().toISOString()}"}\n\n`);
    }
    return res.end();
  } catch (error) {
    logger.error('Error streaming message:', error);
    const errorData = JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to stream message'
    });
    res.write(`data: ${errorData}\n\n`);
    return res.end();
  }
});

// Execute AGUI action
router.post('/actions/:actionId', async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;
    const parameters = req.body;

    const result = await chatService.executeAction(actionId, parameters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error executing action:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute action'
    });
  }
});

// Get available actions
router.get('/actions', async (_req: Request, res: Response) => {
  try {
    const actions = aguiActionRegistry.getActions();

    return res.json({
      success: true,
      data: actions
    });
  } catch (error) {
    logger.error('Error fetching actions:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch actions'
    });
  }
});

// Natural language query endpoint
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const result = await chatService.processNaturalLanguageQuery(query);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error processing query:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process query'
    });
  }
});

// Test endpoint for debugging
router.post('/test-deepseek', async (_req: Request, res: Response) => {
  try {
    logger.info('Testing DeepSeek connection');
    
    // Create a test conversation
    const testConversation = await chatService.createConversation('Test');
    logger.info('Created test conversation:', testConversation.id);
    
    // Try to send a simple message
    const result = await chatService.sendMessage(testConversation.id, 'Hello, just say hi back', false);
    logger.info('Got result from DeepSeek:', result);
    
    res.json({
      success: true,
      message: 'DeepSeek test completed',
      result: result
    });
  } catch (error) {
    logger.error('DeepSeek test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'DeepSeek test failed'
    });
  }
});

export default router;