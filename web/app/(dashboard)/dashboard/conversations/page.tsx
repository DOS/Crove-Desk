import { AgentRealtimeProvider } from "@/components/agent-realtime-provider";

import { ConversationWorkbench } from "./_components/conversation-workbench";

export default function ConversationsPage() {
  return (
    <>
      <AgentRealtimeProvider />
      <ConversationWorkbench />
    </>
  );
}
