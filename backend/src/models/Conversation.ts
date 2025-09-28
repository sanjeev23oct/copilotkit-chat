export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateConversationData {
  user_id: string;
  title?: string;
}

export interface UpdateConversationData {
  title?: string;
}