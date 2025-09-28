import { Router, Request, Response } from 'express';
import { chatService } from '../services/chat';
import logger from '../utils/logger';

const router = Router();

// AG-UI Stream endpoint - follows the exact pattern from the example
router.get('/', async (req: Request, res: Response) => {
  try {
    const { message, symbol } = req.query;
    const userMessage = (message as string) || "Analyze the portfolio";
    
    logger.info('AG-UI Stream endpoint called with:', { message: userMessage, symbol });

    // Set up Server-Sent Events with proper headers
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
      timestamp: new Date().toISOString(),
      data: { message: userMessage, symbols: symbol ? [symbol].flat() : [] }
    };
    res.write(`data: ${JSON.stringify(startEvent)}\n\n`);

    // Create a conversation for this stream
    const conversation = await chatService.createConversation('AG-UI Stream');
    
    // Build enhanced prompt for portfolio analysis
    let enhancedPrompt = userMessage;
    if (symbol) {
      const symbols = Array.isArray(symbol) ? symbol : [symbol];
      enhancedPrompt = `Analyze portfolio for symbols: ${symbols.join(', ')}. ${userMessage}
      
      Please respond with JSON format:
      {
        "content": "your analysis text",
        "agui": [
          {
            "type": "table",
            "id": "portfolio-data",
            "props": {
              "headers": ["Symbol", "Price", "Change", "Volume"],
              "rows": [["MSFT", "$420.50", "+2.5%", "1.2M"]]
            }
          }
        ]
      }`;
    }

    // Stream the AI response
    const stream = await chatService.sendMessage(conversation.id, enhancedPrompt, true);
    
    let portfolioState: any = {};
    let messageBuffer = '';

    if (Symbol.asyncIterator in Object(stream)) {
      for await (const chunk of stream as AsyncIterable<any>) {
        logger.debug('Processing AG-UI chunk:', chunk);
        
        if (chunk.type === 'text' && chunk.content) {
          messageBuffer += chunk.content;
          
          // Send PROGRESS event for text content
          const progressEvent = {
            event: "PROGRESS",
            message: chunk.content,
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(progressEvent)}\n\n`);
          
        } else if (chunk.type === 'agui' && chunk.agui) {
          // Convert AGUI elements to state updates
          if (chunk.agui.type === 'table' && chunk.agui.props) {
            const tableData = chunk.agui.props;
            if (tableData.headers && tableData.rows) {
              // Convert table to portfolio state
              tableData.rows.forEach((row: any[]) => {
                if (tableData.headers[0] === 'Symbol' && row[0]) {
                  portfolioState[row[0]] = {
                    symbol: row[0],
                    price: row[1] || 'N/A',
                    change: row[2] || 'N/A',
                    volume: row[3] || 'N/A',
                    lastUpdated: new Date().toISOString()
                  };
                }
              });
            }
          } else if (chunk.agui.type === 'chart') {
            // Handle chart data
            portfolioState.chartData = chunk.agui.props;
          }
          
          // Send STATE_DELTA event
          const stateEvent = {
            event: "STATE_DELTA",
            data: portfolioState,
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(stateEvent)}\n\n`);
          
        } else if (chunk.type === 'done') {
          // Send final state snapshot
          const snapshotEvent = {
            event: "STATE_SNAPSHOT",
            data: portfolioState,
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(snapshotEvent)}\n\n`);
          
          // Send RUN_FINISHED event
          const finishEvent = {
            event: "RUN_FINISHED",
            timestamp: new Date().toISOString(),
            summary: {
              totalMessages: messageBuffer.length > 0 ? 1 : 0,
              portfolioItems: Object.keys(portfolioState).length,
              duration: Date.now() - new Date(startEvent.timestamp).getTime()
            }
          };
          res.write(`data: ${JSON.stringify(finishEvent)}\n\n`);
          break;
          
        } else if (chunk.type === 'error') {
          const errorEvent = {
            event: "ERROR",
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
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
});

export default router;