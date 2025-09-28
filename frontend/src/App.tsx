import React from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export default function ChatApp() {
  return (
    <CopilotKit runtimeUrl="http://localhost:3010/copilotkit">
      <div className="h-screen w-screen">
        <CopilotChat
          labels={{
            title: "AI Database Assistant",
            initial: "Ask me anything about the database, request data visualizations, or chat naturally",
          }}
          className="h-full"
        />
      </div>
    </CopilotKit>
  );
}
