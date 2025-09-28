import { Router } from 'express';
import { ChatService } from '../services/chat';
import logger from '../utils/logger';

const router = Router();
const chatService = new ChatService();

// AG-UI compatible endpoint
router.post('/', async (req, res) => {
  try {
    const userMessage = req.body.message || "";
    
    if (!userMessage.trim()) {
      return res.json({ reply: "Please provide a message." });
    }

    logger.info('AG endpoint received message:', userMessage);

    // Create a temporary conversation for this request
    const conversation = await chatService.createConversation('AG Chat');

    // Stream the AI response and collect it
    let fullContent = '';
    let aguiElements: any[] = [];
    
    const stream = await chatService.sendMessage(conversation.id, userMessage, true);
    
    if (Symbol.asyncIterator in Object(stream)) {
      for await (const chunk of stream as AsyncIterable<any>) {
        if (chunk.type === 'text' && chunk.content) {
          fullContent += chunk.content;
        } else if (chunk.type === 'agui' && chunk.agui) {
          aguiElements.push(chunk.agui);
        } else if (chunk.type === 'done') {
          break;
        }
      }
    } else {
      logger.error('Stream is not async iterable in AG route');
      return res.status(500).json({ reply: "Error: Invalid stream response" });
    }
    
    // Parse the full content to extract clean text
    let reply = fullContent;
    
    // Try to parse JSON response and extract content
    try {
      // Look for JSON structure in the response
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.content) {
          reply = parsed.content;
        }
      }
    } catch (parseError) {
      logger.warn('Failed to parse JSON from response, using raw content:', parseError);
      // Clean up any JSON artifacts from the raw content
      reply = fullContent
        .replace(/^\s*\{\s*"content"\s*:\s*"/, '')
        .replace(/",?\s*"agui"\s*:[\s\S]*\}\s*$/, '')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n');
    }
    
    // If there are AGUI elements, add them as interactive elements
    if (aguiElements.length > 0) {
      const aguiText = aguiElements.map(element => {
        if (element.type === 'button') {
          return `\n🔘 ${element.label || 'Button'}`;
        } else if (element.type === 'table') {
          return `\n📊 Table with data`;
        } else if (element.type === 'chart') {
          return `\n📈 Chart available`;
        } else if (element.type === 'form') {
          return `\n📝 Form available`;
        }
        return `\n🔧 ${element.type}`;
      }).join('');
      
      reply += aguiText;
    }

    logger.info('AG endpoint sending reply:', reply.substring(0, 100) + '...');
    
    return res.json({ reply });
    
  } catch (error) {
    logger.error('AG endpoint error:', error);
    return res.status(500).json({ 
      reply: "Error communicating with AI: " + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

export default router;