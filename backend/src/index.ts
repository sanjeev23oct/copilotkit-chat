import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import copilotKitRouter from './routes/copilotkit';
import databaseRouter from './routes/database';
import chatRouter from './routes/chat';
import agRouter from './routes/ag';
import aguiStreamRouter from './routes/agui-stream';
import postgresAgentRouter from './routes/postgres-agent';
import multiAgentRouter from './routes/multi-agent';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5185',
    'http://localhost:3000',
    'http://127.0.0.1:5185',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL || 'http://localhost:5185'
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'DNT',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'User-Agent',
    'Referer',
    'x-copilotkit-runtime-client-gql-version'
  ],
  optionsSuccessStatus: 200
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/copilotkit', copilotKitRouter);
app.use('/api/database', databaseRouter);
app.use('/api/chat', chatRouter);
app.use('/ag', agRouter);
app.use('/custom-agent', aguiStreamRouter);
app.use('/api/postgres-agent', postgresAgentRouter);
app.use('/api/multi-agent', multiAgentRouter);

// Basic route
app.get('/', (_req, res) => {
  res.json({
    message: 'AI Chat Backend API',
    version: '1.0.0',
    docs: '/api/health',
    endpoints: {
      copilotkit: '/api/copilotkit',
      database: '/api/database',
      chat: '/api/chat',
      postgresAgent: '/api/postgres-agent',
      multiAgent: '/api/multi-agent',
      health: '/api/health'
    }
  });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`🤖 CopilotKit: http://localhost:${PORT}/api/copilotkit`);
  logger.info(`🗄️  Database API: http://localhost:${PORT}/api/database`);
  logger.info(`💬 Chat API: http://localhost:${PORT}/api/chat`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;