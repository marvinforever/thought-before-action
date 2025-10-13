import { useState, useEffect, useRef } from "react";
import { useConversation } from "@11labs/react";
import { Mic, MicOff, MessageSquare, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JerichoVoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JerichoVoiceChat({ isOpen, onClose }: JerichoVoiceChatProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [completeness, setCompleteness] = useState<{
    percentage: number;
    missingItems: string[];
    onboardingPhase: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to Jericho voice");
      toast.success("Connected to Jericho");
    },
    onDisconnect: () => {
      console.log("Disconnected from Jericho voice");
      toast.info("Voice conversation ended");
    },
    onMessage: (message) => {
      console.log("Message received:", message);
      // Add messages to transcript for display
      setTranscript(prev => [...prev, {
        role: message.source === 'user' ? 'user' : 'assistant',
        content: message.message || ''
      }]);
    },
    onError: (error) => {
      console.error("Voice error:", error);
      toast.error("Voice connection error. Please try again.");
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const startVoiceConversation = async () => {
    setIsInitializing(true);
    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use voice chat");
        return;
      }

      // Initialize voice agent
      const { data, error } = await supabase.functions.invoke('elevenlabs-voice-agent', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      const { signedUrl, conversationId: convId, completeness: userCompleteness, systemPrompt, firstMessage } = data;
      setConversationId(convId);
      setCompleteness(userCompleteness);

      // Start ElevenLabs conversation with signed URL and overrides
      await conversation.startSession({
        signedUrl: signedUrl,
        overrides: {
          agent: {
            prompt: {
              prompt: systemPrompt
            },
            firstMessage: firstMessage
          }
        }
      });
      
    } catch (error: any) {
      console.error("Failed to start voice conversation:", error);
      toast.error(error.message || "Failed to start voice conversation");
    } finally {
      setIsInitializing(false);
    }
  };

  const endVoiceConversation = async () => {
    try {
      await conversation.endSession();
      
      // Update voice session end time
      if (conversationId) {
        await supabase
          .from('voice_sessions')
          .update({
            ended_at: new Date().toISOString(),
          })
          .eq('conversation_id', conversationId);
      }
      
      onClose();
    } catch (error) {
      console.error("Error ending conversation:", error);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col bg-background border-2">
        {/* Header */}
        <div className="flex flex-col gap-3 p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${conversation.status === 'connected' ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                <Phone className={`h-5 w-5 ${conversation.status === 'connected' ? 'text-green-500' : 'text-gray-500'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Voice Chat with Jericho</h3>
                <p className="text-sm text-muted-foreground">
                  {conversation.status === 'connected' ? '🟢 Connected' : 
                   conversation.status === 'connecting' ? '🟡 Connecting...' : 
                   '⚪ Not connected'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {completeness && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                Profile: {completeness.percentage}% Complete
              </span>
              {completeness.onboardingPhase && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  completeness.onboardingPhase === 'complete' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 
                  completeness.onboardingPhase === 'in_progress' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' : 
                  'bg-gray-500/10 text-gray-700 dark:text-gray-400'
                }`}>
                  {completeness.onboardingPhase === 'complete' ? '✓ Setup Complete' :
                   completeness.onboardingPhase === 'in_progress' ? '⏳ Getting Started' :
                   '🆕 New User'}
                </span>
              )}
              {completeness.missingItems.length > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground">
                  Jericho can help: {completeness.missingItems[0].replace('_', ' ')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Transcript Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {transcript.length === 0 && conversation.status !== 'connected' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Mic className="h-16 w-16 text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">Ready to talk with Jericho?</h4>
              <p className="text-sm text-muted-foreground max-w-md">
                Have natural conversations about your goals, challenges, and growth. 
                Jericho can help you set goals, track achievements, and navigate your career path.
              </p>
            </div>
          )}
          
          {conversation.status === 'connected' && transcript.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                <Mic className="relative h-12 w-12 text-primary" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Listening...</p>
            </div>
          )}

          <div className="space-y-4">
            {transcript.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {conversation.isSpeaking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Controls */}
        <div className="p-4 border-t bg-muted/50">
          <div className="flex items-center justify-center gap-4">
            {conversation.status !== 'connected' ? (
              <Button
                size="lg"
                onClick={startVoiceConversation}
                disabled={isInitializing}
                className="gap-2"
              >
                <Mic className="h-5 w-5" />
                {isInitializing ? 'Connecting...' : 'Start Voice Chat'}
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={endVoiceConversation}
                  className="gap-2"
                >
                  <MicOff className="h-5 w-5" />
                  End Call
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    endVoiceConversation();
                    // Open text chat (you can dispatch a custom event to open the text chat)
                    window.dispatchEvent(new CustomEvent('openJerichoChat'));
                  }}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Switch to Text
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-center text-muted-foreground mt-3">
            Your conversation will be saved and summarized in your weekly growth email
          </p>
        </div>
      </Card>
    </div>
  );
}
