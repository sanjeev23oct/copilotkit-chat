import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage, Conversation, UseChatOptions, UseChatReturn, ApiResponse } from '../types';
import { config } from '../config';

const useChat = (options: UseChatOptions = {}): UseChatReturn => {
  const { conversationId, autoScroll = true } = options;
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch messages for current conversation
  const {
    data: messages = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) return [];
      
      const response = await fetch(`${config.apiBaseUrl}/api/chat/conversation/${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const result: ApiResponse<Conversation> = await response.json();
      return result.data?.messages || [];
    },
    enabled: !!conversationId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string): Promise<ChatMessage> => {
      const response = await fetch(`${config.apiBaseUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const result: ApiResponse<ChatMessage> = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to send message');
      }

      return result.data;
    },
    onSuccess: (newMessage) => {
      // Update the messages cache
      queryClient.setQueryData(['messages', conversationId], (oldMessages: ChatMessage[] = []) => [
        ...oldMessages,
        newMessage,
      ]);
      
      // Clear any previous errors
      setError(null);
      
      // Auto-scroll to bottom if enabled
      if (autoScroll) {
        setTimeout(() => {
          const chatContainer = document.querySelector('[data-chat-container]');
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        }, 100);
      }
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Failed to send message');
    },
  });

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    try {
      await sendMessageMutation.mutateAsync(content);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [sendMessageMutation]);

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading: isLoading || sendMessageMutation.isPending,
    error,
    retry,
    clearError,
  };
};

export default useChat;