import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useViewAs } from '@/contexts/ViewAsContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface JerichoChatProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
  contextType?: string;
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function JerichoChat({ isOpen, onClose, initialMessage, contextType }: JerichoChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamBuffer, setStreamBuffer] = useState(''); // Full content from server
  const [displayedChars, setDisplayedChars] = useState(0); // Characters revealed so far
  const [hasSummarized, setHasSummarized] = useState(false); // Track if we've summarized this session
  const [initialMessageSent, setInitialMessageSent] = useState(false); // Track if initial message was already sent
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());

  // Summarize conversation - call the edge function
  const summarizeConversation = useCallback(async (convId: string) => {
    if (hasSummarized || !convId) return;
    
    try {
      console.log('Triggering conversation summarization for:', convId);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-conversation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ conversationId: convId }),
        }
      );

      if (response.ok) {
        console.log('Conversation summarized successfully');
        setHasSummarized(true);
      } else {
        console.error('Failed to summarize conversation:', await response.text());
      }
    } catch (error) {
      console.error('Error summarizing conversation:', error);
    }
  }, [hasSummarized]);

  // Reset inactivity timer on any user activity
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = new Date();
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Only set timer if we have a conversation and messages
    if (conversationId && messages.length >= 2) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('Inactivity timeout reached, summarizing conversation');
        summarizeConversation(conversationId);
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [conversationId, messages.length, summarizeConversation]);

  // Handle chat close - summarize if we had a meaningful conversation
  const handleClose = useCallback(() => {
    // Summarize if we have at least 2 messages (1 user + 1 assistant)
    if (conversationId && messages.length >= 2 && !hasSummarized) {
      summarizeConversation(conversationId);
    }
    
    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    onClose();
  }, [conversationId, messages.length, hasSummarized, summarizeConversation, onClose]);

  // Reset summarization flag when conversation changes
  useEffect(() => {
    setHasSummarized(false);
  }, [conversationId]);

  // Set up inactivity timer when messages change
  useEffect(() => {
    if (isOpen && messages.length >= 2) {
      resetInactivityTimer();
    }
    
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isOpen, messages.length, resetInactivityTimer]);

  // Cleanup on unmount - summarize if needed
  useEffect(() => {
    return () => {
      if (conversationId && messages.length >= 2 && !hasSummarized) {
        // Fire and forget - don't wait for response
        summarizeConversation(conversationId);
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [conversationId, messages.length, hasSummarized, summarizeConversation]);

  // Auto-scroll to bottom when new messages arrive or content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayedChars]);

  // Typing effect - reveal characters slowly (word by word for more natural feel)
  useEffect(() => {
    if (isLoading && streamBuffer && displayedChars < streamBuffer.length) {
      const timeout = setTimeout(() => {
        // Find next word boundary or reveal 1 char at a time
        const remaining = streamBuffer.slice(displayedChars);
        const nextSpace = remaining.indexOf(' ');
        // Reveal one character at a time for natural typing
        setDisplayedChars(prev => prev + 1);
      }, 25); // 25ms per character - feels like fast human typing
      return () => clearTimeout(timeout);
    }
  }, [isLoading, streamBuffer, displayedChars]);

  // Load conversation history on mount
  useEffect(() => {
    if (isOpen) {
      loadConversationHistory();
    }
  }, [isOpen]);

  // Send initial message if provided (only once)
  useEffect(() => {
    if (isOpen && initialMessage && messages.length === 0 && !initialMessageSent && !isLoading) {
      setInitialMessageSent(true);
      handleSendMessage(initialMessage);
    }
  }, [isOpen, initialMessage, messages.length, initialMessageSent, isLoading]);

  const loadConversationHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get most recent conversation
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('profile_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        const convId = conversations[0].id;
        setConversationId(convId);

        // Load messages
        const { data: messageData } = await supabase
          .from('conversation_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (messageData) {
          setMessages(
            messageData.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(m.created_at),
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamBuffer(''); // Reset buffer for new message
    setDisplayedChars(0); // Reset displayed chars

    // Add placeholder assistant message that will be updated
    const placeholderIndex = messages.length + 1;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session. Please log in again.');
      }

      console.log('Calling chat-with-jericho function...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-jericho`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            conversationId,
            message: textToSend,
            contextType,
            viewAsCompanyId,
            stream: true,
          }),
        }
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge function error:', response.status, errorText);
        
        // Parse error message if it's JSON
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `Failed to get response: ${response.status}`);
        } catch {
          throw new Error(`Failed to get response: ${response.status} - ${errorText}`);
        }
      }
      
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let newConversationId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.conversationId && !newConversationId) {
                newConversationId = data.conversationId;
                setConversationId(data.conversationId);
              }
              
              if (data.content) {
                accumulatedContent += data.content;
                setStreamBuffer(accumulatedContent); // Update buffer, typing effect will reveal it
              }
              
              if (data.done) {
                // Update the actual message with final content before exiting
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[placeholderIndex] = {
                    role: 'assistant',
                    content: accumulatedContent,
                    timestamp: new Date(),
                  };
                  return newMessages;
                });
                break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error chatting with Jericho:', error);
      setMessages(prev => prev.slice(0, -1)); // Remove placeholder
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get response from Jericho. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-background border-l border-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
            <span className="text-xl font-bold text-primary">J</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Jericho</h2>
            <p className="text-xs opacity-90">Your AI Career Coach</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="hover:bg-primary-foreground/20 text-primary-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm mb-2">👋 Hey! I'm Jericho.</p>
            <p className="text-xs">
              I'm here to help you crush your goals, prep for reviews, and level up your career.
              Let's get to work.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-4 ${
              msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {/* Show typed-out content for streaming message, otherwise show full content */}
                {msg.role === 'assistant' && isLoading && idx === messages.length - 1
                  ? streamBuffer.slice(0, displayedChars)
                  : msg.content}
                {/* Show typing cursor for active streaming message */}
                {msg.role === 'assistant' && isLoading && idx === messages.length - 1 && displayedChars < streamBuffer.length && (
                  <span className="inline-block w-2 h-4 ml-1 bg-foreground/70 animate-pulse" />
                )}
              </p>
              {(!isLoading || idx !== messages.length - 1 || msg.role === 'user') && (
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !input.trim()}
            variant="accent"
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}