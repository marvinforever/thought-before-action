import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, Copy, Check, Save } from 'lucide-react';
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
  hasGeneratedContent?: boolean; // Flag for messages with actionable content
}

interface AITaskDetails {
  task: string;
  ai_solution: string;
  recommended_tool?: string;
  hours_saved?: number;
}

interface JerichoChatProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
  contextType?: string;
  taskDetails?: AITaskDetails; // New prop for AI task agent mode
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function JerichoChat({ isOpen, onClose, initialMessage, contextType, taskDetails }: JerichoChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamBuffer, setStreamBuffer] = useState(''); // Full content from server
  const [displayedChars, setDisplayedChars] = useState(0); // Characters revealed so far
  const [hasSummarized, setHasSummarized] = useState(false); // Track if we've summarized this session
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const initialMessageSentRef = useRef(false); // Use ref to prevent race conditions
  const activeAssistantIndexRef = useRef<number | null>(null);
  const taskDetailsRef = useRef(taskDetails); // Track taskDetails for initial message

  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());

  // Update taskDetailsRef when taskDetails changes
  useEffect(() => {
    taskDetailsRef.current = taskDetails;
  }, [taskDetails]);

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
    
    // Reset initial message flag so it can be sent again if chat reopens
    initialMessageSentRef.current = false;
    
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
      setIsHistoryLoaded(false);
      // For ai-task-agent mode, start fresh without loading history
      if (contextType === 'ai-task-agent') {
        setMessages([]);
        setConversationId(null);
        setIsHistoryLoaded(true);
      } else {
        loadConversationHistory().finally(() => setIsHistoryLoaded(true));
      }
    }
  }, [isOpen, contextType]);

  // Send initial message if provided (only once, and only after history load finishes)
  useEffect(() => {
    if (!isHistoryLoaded) return;

    // For ai-task-agent mode with taskDetails, send the task prompt
    if (isOpen && contextType === 'ai-task-agent' && taskDetailsRef.current && !initialMessageSentRef.current && !isLoading) {
      initialMessageSentRef.current = true;
      const task = taskDetailsRef.current;
      const taskPrompt = `Help me with this task: ${task.task}\n\nSuggested approach: ${task.ai_solution}`;
      handleSendMessage(taskPrompt);
      return;
    }

    if (isOpen && initialMessage && messages.length === 0 && !initialMessageSentRef.current && !isLoading) {
      initialMessageSentRef.current = true;
      handleSendMessage(initialMessage);
    }
  }, [isOpen, initialMessage, messages.length, isLoading, isHistoryLoaded, contextType]);

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

    // Add user message + placeholder assistant message in a single state update
    setMessages(prev => {
      const next: Message[] = [
        ...prev,
        userMessage,
        {
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ];
      activeAssistantIndexRef.current = next.length - 1;
      return next;
    });

    setInput('');
    setIsLoading(true);
    setStreamBuffer(''); // Reset buffer for new message
    setDisplayedChars(0); // Reset displayed chars

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
            taskDetails: taskDetailsRef.current, // Pass task details to backend
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

      // Robust SSE parsing (handles partial JSON across chunks)
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue; // keepalive/blank
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const data = JSON.parse(jsonStr);

            if (data.conversationId && !newConversationId) {
              newConversationId = data.conversationId;
              setConversationId(data.conversationId);
            }

            if (typeof data.content === 'string' && data.content.length) {
              accumulatedContent += data.content;
              setStreamBuffer(accumulatedContent);
            }

            if (data.done) {
              const assistantIndex = activeAssistantIndexRef.current;

              if (assistantIndex !== null) {
                setMessages(prev => {
                  if (!prev[assistantIndex]) return prev;
                  const next = [...prev];
                  next[assistantIndex] = {
                    role: 'assistant',
                    content: accumulatedContent,
                    timestamp: new Date(),
                    hasGeneratedContent: contextType === 'ai-task-agent', // Mark as having actionable content
                  };
                  return next;
                });
              }

              window.dispatchEvent(new Event('onboardingProgressRefresh'));
              streamDone = true;
              break;
            }
          } catch {
            // Incomplete JSON split across chunks — put it back and wait for more data
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush (in case stream ended without trailing newline)
      if (!streamDone && textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            if (typeof data.content === 'string' && data.content.length) {
              accumulatedContent += data.content;
              setStreamBuffer(accumulatedContent);
            }
            if (data.done) {
              const assistantIndex = activeAssistantIndexRef.current;
              if (assistantIndex !== null) {
                setMessages(prev => {
                  if (!prev[assistantIndex]) return prev;
                  const next = [...prev];
                  next[assistantIndex] = {
                    role: 'assistant',
                    content: accumulatedContent,
                    timestamp: new Date(),
                    hasGeneratedContent: contextType === 'ai-task-agent',
                  };
                  return next;
                });
              }
              window.dispatchEvent(new Event('onboardingProgressRefresh'));
            }
          } catch {
            // ignore leftovers
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

  const handleCopyContent = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      toast({
        title: 'Copied!',
        description: 'Content copied to clipboard',
      });
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please try selecting and copying manually',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAsAchievement = async (content: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('No company found');

      // Extract a title from the content (first line or first 100 chars)
      const title = content.split('\n')[0].slice(0, 100) || 'AI-generated content';

      await supabase.from('achievements').insert({
        profile_id: user.id,
        company_id: profile.company_id,
        achievement_text: `Completed AI task: ${title}`,
        category: 'productivity',
        achieved_date: new Date().toISOString().split('T')[0],
      });

      toast({
        title: 'Saved!',
        description: 'Added to your achievements',
      });
    } catch (error) {
      console.error('Error saving achievement:', error);
      toast({
        title: 'Failed to save',
        description: 'Please try again',
        variant: 'destructive',
      });
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
            <p className="text-xs opacity-90">
              {contextType === 'ai-task-agent' ? 'AI Task Agent' : 'Your AI Career Coach'}
            </p>
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
            {contextType === 'ai-task-agent' ? (
              <>
                <p className="text-sm mb-2">🤖 AI Task Agent Mode</p>
                <p className="text-xs">
                  I'll help you complete this task step by step. Let's get started!
                </p>
              </>
            ) : (
              <>
                <p className="text-sm mb-2">👋 Hey! I'm Jericho.</p>
                <p className="text-xs">
                  I'm here to help you crush your goals, prep for reviews, and level up your career.
                  Let's get to work.
                </p>
              </>
            )}
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
              
              {/* Action buttons for assistant messages with generated content */}
              {msg.role === 'assistant' && msg.content && !isLoading && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleCopyContent(msg.content, idx)}
                  >
                    {copiedIndex === idx ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    Copy
                  </Button>
                  {contextType === 'ai-task-agent' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleSaveAsAchievement(msg.content)}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  )}
                </div>
              )}
              
              {(!isLoading || idx !== messages.length - 1 || msg.role === 'user') && !msg.content && (
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
            placeholder={isLoading ? "Jericho is typing..." : "Type your message..."}
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