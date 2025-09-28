# CopilotKit AI Chat App

A modern AI chat application built with React, Node.js, and CopilotKit, featuring DeepSeek LLM integration and AG-UI protocol support for interactive elements.

## Features

### 🤖 AI Integration
- **DeepSeek LLM**: Advanced AI responses with streaming support
- **CopilotKit Integration**: Enhanced chat interface with built-in AI capabilities
- **AG-UI Protocol**: Interactive elements like buttons, tables, charts, and forms
- **Real-time Streaming**: Live response streaming for better user experience

### 🎨 Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **CopilotKit Components** for AI-enhanced chat interface
- **Tailwind CSS** for responsive, modern styling
- **Interactive AGUI Components** for rich user interactions

### ⚡ Backend
- **Node.js + Express** with TypeScript
- **Streaming API Support** for real-time responses
- **Database Integration** capabilities
- **Comprehensive Error Handling** and logging
- **Health Check Endpoints** for monitoring
- **CORS and Security** middleware

### 🔧 Architecture
- **Modular Design** with clean separation of concerns
- **Environment-based Configuration** for different deployment stages
- **Generic LLM Adapter** system for easy provider switching
- **AGUI Action Registry** for extensible interactive elements

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- DeepSeek API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sanjeev23oct/copilotkit-chat.git
   cd copilotkit-chat
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Backend environment
   cd backend
   cp .env.example .env
   # Edit .env and add your DeepSeek API key:
   # DEEPSEEK_API_KEY=your_api_key_here

   # Frontend environment (optional)
   cd ../frontend
   cp .env.example .env.local
   ```

4. **Start the application**
   ```bash
   # Start backend (from backend directory)
   npm run dev

   # Start frontend (from frontend directory, in another terminal)
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5185
   - Backend API: http://localhost:3010
   - Health Check: http://localhost:3010/api/health

## API Endpoints

### Core Endpoints
- `POST /copilotkit` - CopilotKit GraphQL runtime endpoint
- `POST /ag` - Simple AG-UI compatible endpoint
- `GET /api/health` - Health check endpoint

### Chat API
- `POST /api/chat/conversations` - Create new conversation
- `GET /api/chat/conversations` - Get all conversations
- `POST /api/chat/conversations/:id/messages` - Send message
- `POST /api/chat/conversations/:id/messages/stream` - Stream message response

### Database API
- `POST /api/database/query` - Execute database queries
- `GET /api/database/schema` - Get database schema

## Configuration

### Environment Variables

#### Backend (.env)
```env
# Server Configuration
PORT=3010
NODE_ENV=development
FRONTEND_URL=http://localhost:5185

# DeepSeek Configuration
DEEPSEEK_API_KEY=your_deepseek_api_key

# Database Configuration (Optional)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_chat_db
DB_USER=postgres
DB_PASSWORD=password

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
```

#### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:3010
```

## Project Structure

```
copilotkit-chat/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic services
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API service layer
│   │   ├── types/          # TypeScript types
│   │   ├── hooks/          # Custom React hooks
│   │   └── App.tsx         # Main app component
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Development

### Backend Development
```bash
cd backend
npm run dev          # Start with nodemon
npm run build        # Build TypeScript
npm run test         # Run tests
npm run lint         # Run ESLint
```

### Frontend Development
```bash
cd frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run Vitest tests
npm run lint         # Run ESLint
```

## Features in Detail

### CopilotKit Integration
The app uses CopilotKit for enhanced AI chat capabilities:
- Built-in chat interface with streaming support
- Function calling capabilities
- Agent state management
- Real-time updates

### AG-UI Protocol
Interactive elements that can be generated by the AI:
- **Buttons**: Clickable actions
- **Tables**: Data display with sorting/filtering
- **Charts**: Data visualizations
- **Forms**: User input collection
- **Cards**: Information display

### DeepSeek Integration
- Streaming responses for real-time chat
- Function calling support
- Error handling and retry logic
- Token usage tracking

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue on GitHub or contact the maintainers.

## Acknowledgments

- [CopilotKit](https://copilotkit.ai/) for the AI chat framework
- [DeepSeek](https://deepseek.com/) for the LLM API
- [React](https://reactjs.org/) and [Vite](https://vitejs.dev/) for the frontend
- [Express.js](https://expressjs.com/) for the backend framework