import { useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import PostgresAgent from "./components/PostgresAgent";

export default function ChatApp() {
  const [activeView, setActiveView] = useState<'chat' | 'postgres'>('chat');

  return (
    <div className="h-screen w-screen flex flex-col">
      <nav className="bg-gray-800 text-white p-4 flex gap-4">
        <button
          onClick={() => setActiveView('chat')}
          className={`px-4 py-2 rounded ${activeView === 'chat'
            ? 'bg-blue-600'
            : 'bg-gray-700 hover:bg-gray-600'
            }`}
        >
          AI Chat
        </button>
        <button
          onClick={() => setActiveView('postgres')}
          className={`px-4 py-2 rounded ${activeView === 'postgres'
            ? 'bg-blue-600'
            : 'bg-gray-700 hover:bg-gray-600'
            }`}
        >
          PostgreSQL Agent
        </button>
      </nav>

      <div className="flex-1 overflow-auto">
        {activeView === 'chat' ? (
          <CopilotKit runtimeUrl="http://localhost:3010/copilotkit">
            <div className="h-full w-full">
              <CopilotChat
                labels={{
                  title: "AI Database Assistant",
                  initial: "Ask me anything about the database, request data visualizations, or chat naturally",
                }}
                className="h-full"
              />
            </div>
          </CopilotKit>
        ) : (
          <PostgresAgent />
        )}
      </div>
    </div>
  );
}
