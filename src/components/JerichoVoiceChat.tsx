import { useState, useEffect, useRef, useCallback } from "react";
import { useConversation } from "@11labs/react";
import { Mic, MicOff, MessageSquare, X, Phone, Brain, Target, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JerichoVoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ContextSummary {
  coachingInsightsCount: number;
  pendingFollowUpsCount: number;
  recentConversationsCount: number;
  goalCompletionRate: number | null;
  currentGoalsCount: number;
  activeHabitsCount: number;
}

export function JerichoVoiceChat({ isOpen, onClose }: JerichoVoiceChatProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string; timestamp: Date }>>([]);
  const [completeness, setCompleteness] = useState<{
    percentage: number;
    missingItems: string[];
    onboardingPhase: string;
  } | null>(null);
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageBufferRef = useRef<{ role: string; content: string }[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Batch save messages to database every 3 seconds
  const saveMessagesToDatabase = useCallback(async () => {
    if (!conversationId || messageBufferRef.current.length === 0) return;

    const messagesToSave = [...messageBufferRef.current];
    messageBufferRef.current = [];

    try {
      const { error } = await supabase
        .from('conversation_messages')
        .insert(messagesToSave.map(msg => ({
          conversation_id: conversationId,
          role: msg.role,
          content: msg.content,
        })));

      if (error) {
        console.error('Error saving messages:', error);
        // Put messages back in buffer on error
        messageBufferRef.current = [...messagesToSave, ...messageBufferRef.current];
      }
    } catch (err) {
      console.error('Error saving voice messages:', err);
    }
  }, [conversationId]);

  // Client tools that the voice agent can call
  const clientTools = {
    add_90_day_goal: async (params: { goal_text: string; category?: string; by_when?: string }) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "Error: Not authenticated";

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        const now = new Date();
        const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
        const year = now.getFullYear();

        // Get next goal number
        const { data: existingGoals } = await supabase
          .from('ninety_day_targets')
          .select('goal_number')
          .eq('profile_id', user.id)
          .eq('quarter', quarter)
          .eq('year', year)
          .order('goal_number', { ascending: false })
          .limit(1);

        const nextGoalNumber = (existingGoals?.[0]?.goal_number || 0) + 1;

        const { error } = await supabase.from('ninety_day_targets').insert({
          profile_id: user.id,
          company_id: profile?.company_id || '',
          goal_text: params.goal_text,
          category: params.category || 'career',
          goal_type: 'professional',
          quarter,
          year,
          goal_number: nextGoalNumber,
          by_when: params.by_when || null,
          completed: false,
        } as any);

        if (error) throw error;
        toast.success("Goal added to your plan!");
        return `Successfully added goal: "${params.goal_text}"`;
      } catch (err) {
        console.error('Error adding goal:', err);
        return "Failed to add goal";
      }
    },

    mark_goal_complete: async (params: { goal_text: string }) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "Error: Not authenticated";

        // Find matching goal by text (fuzzy match)
        const { data: goals } = await supabase
          .from('ninety_day_targets')
          .select('id, goal_text')
          .eq('profile_id', user.id)
          .eq('completed', false);

        const matchingGoal = goals?.find(g => 
          g.goal_text.toLowerCase().includes(params.goal_text.toLowerCase()) ||
          params.goal_text.toLowerCase().includes(g.goal_text.toLowerCase())
        );

        if (!matchingGoal) return "Could not find that goal";

        const { error } = await supabase
          .from('ninety_day_targets')
          .update({ completed: true, updated_at: new Date().toISOString() })
          .eq('id', matchingGoal.id);

        if (error) throw error;
        toast.success("🎉 Goal marked complete!");
        return `Marked goal as complete: "${matchingGoal.goal_text}"`;
      } catch (err) {
        console.error('Error completing goal:', err);
        return "Failed to mark goal complete";
      }
    },

    add_habit: async (params: { habit_name: string; description?: string; frequency?: string }) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "Error: Not authenticated";

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        const { error } = await supabase.from('leading_indicators').insert({
          profile_id: user.id,
          company_id: profile?.company_id,
          habit_name: params.habit_name,
          habit_description: params.description,
          target_frequency: params.frequency || 'daily',
          habit_type: 'custom',
          is_active: true,
          current_streak: 0,
          longest_streak: 0,
        });

        if (error) throw error;
        toast.success("Habit created!");
        return `Created habit: "${params.habit_name}"`;
      } catch (err) {
        console.error('Error adding habit:', err);
        return "Failed to add habit";
      }
    },

    add_achievement: async (params: { achievement_text: string; category?: string }) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "Error: Not authenticated";

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        const { error } = await supabase.from('achievements').insert({
          profile_id: user.id,
          company_id: profile?.company_id,
          achievement_text: params.achievement_text,
          category: params.category || 'professional',
          achieved_date: new Date().toISOString().split('T')[0],
        });

        if (error) throw error;
        toast.success("🏆 Achievement recorded!");
        return `Recorded achievement: "${params.achievement_text}"`;
      } catch (err) {
        console.error('Error adding achievement:', err);
        return "Failed to add achievement";
      }
    },

    update_vision: async (params: { vision_type: string; vision_text: string; timeframe: string }) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "Error: Not authenticated";

        // Determine which field to update
        let updateField = '';
        if (params.vision_type === 'professional' || params.vision_type === 'career') {
          updateField = params.timeframe === '3_year' ? 'three_year_vision' : 'one_year_vision';
        } else {
          updateField = params.timeframe === '3_year' ? 'personal_three_year_vision' : 'personal_one_year_vision';
        }

        // Check if personal goals exist
        const { data: existing } = await supabase
          .from('personal_goals')
          .select('profile_id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('personal_goals')
            .update({ [updateField]: params.vision_text })
            .eq('profile_id', user.id);
        } else {
          await supabase
            .from('personal_goals')
            .insert([{ profile_id: user.id, [updateField]: params.vision_text }] as any);
        }

        toast.success("Vision updated!");
        return `Updated ${params.vision_type} ${params.timeframe.replace('_', '-')} vision`;
      } catch (err) {
        console.error('Error updating vision:', err);
        return "Failed to update vision";
      }
    },

    save_insight: async (params: { insight_type: string; insight_text: string }) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "Error: Not authenticated";

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        const { error } = await supabase.from('coaching_insights').insert({
          profile_id: user.id,
          company_id: profile?.company_id,
          insight_type: params.insight_type,
          insight_text: params.insight_text,
          confidence_level: 'medium',
          source_conversation_id: conversationId,
          is_active: true,
          reinforcement_count: 1,
          first_observed_at: new Date().toISOString(),
          last_reinforced_at: new Date().toISOString(),
        });

        if (error) throw error;
        return `Saved insight about ${params.insight_type}`;
      } catch (err) {
        console.error('Error saving insight:', err);
        return "Failed to save insight";
      }
    },
  };

  const conversation = useConversation({
    clientTools,
    onConnect: () => {
      console.log("Connected to Jericho voice");
      toast.success("Connected to Jericho");
    },
    onDisconnect: () => {
      console.log("Disconnected from Jericho voice");
      toast.info("Voice conversation ended");
      // Save any remaining messages
      saveMessagesToDatabase();
    },
    onMessage: (message) => {
      console.log("Voice message received:", message);
      
      const role = message.source === 'user' ? 'user' : 'assistant';
      const content = message.message || '';
      
      if (content) {
        // Add to display transcript
        setTranscript(prev => [...prev, {
          role,
          content,
          timestamp: new Date(),
        }]);

        // Buffer for database save
        messageBufferRef.current.push({ role, content });

        // Schedule batch save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(saveMessagesToDatabase, 3000);
      }
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const startVoiceConversation = async () => {
    setIsInitializing(true);
    try {
      // Create and resume AudioContext to satisfy browser autoplay policy
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      console.log("AudioContext state:", audioContext.state);
      
      // Request microphone access with optimized settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      // Stop the stream - ElevenLabs SDK will create its own
      stream.getTracks().forEach(track => track.stop());
      
      console.log("Microphone access granted");

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

      const { signedUrl, conversationId: convId, completeness: userCompleteness, contextSummary: ctxSummary } = data;
      setConversationId(convId);
      setCompleteness(userCompleteness);
      setContextSummary(ctxSummary);
      
      console.log("Starting ElevenLabs session with signedUrl:", signedUrl?.substring(0, 80) + "...");

      // Start ElevenLabs conversation with signed URL (WebSocket mode)
      const sessionResult = await conversation.startSession({
        signedUrl: signedUrl,
      });
      
      console.log("ElevenLabs session result:", sessionResult);
      console.log("Conversation status after start:", conversation.status);
      console.log("Is speaking:", conversation.isSpeaking);
      
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
      
      // Save any remaining buffered messages
      await saveMessagesToDatabase();
      
      // Update voice session end time
      if (conversationId) {
        await supabase
          .from('voice_sessions')
          .update({
            ended_at: new Date().toISOString(),
          })
          .eq('conversation_id', conversationId);

        // Trigger summarization for coaching memory
        console.log('Triggering voice conversation summarization...');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          supabase.functions.invoke('summarize-conversation', {
            body: { conversationId },
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).then(result => {
            if (result.error) {
              console.error('Summarization error:', result.error);
            } else {
              console.log('Voice conversation summarized:', result.data);
            }
          });
        }
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
      <Card className="w-full max-w-2xl h-[650px] flex flex-col bg-background border-2">
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
          
          {/* Context badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {completeness && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                Profile: {completeness.percentage}%
              </span>
            )}
            {contextSummary && contextSummary.coachingInsightsCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 flex items-center gap-1">
                <Brain className="h-3 w-3" />
                {contextSummary.coachingInsightsCount} memories
              </span>
            )}
            {contextSummary && contextSummary.currentGoalsCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <Target className="h-3 w-3" />
                {contextSummary.currentGoalsCount} goals
              </span>
            )}
            {contextSummary && contextSummary.goalCompletionRate !== null && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                {contextSummary.goalCompletionRate}% completion
              </span>
            )}
            {contextSummary && contextSummary.pendingFollowUpsCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {contextSummary.pendingFollowUpsCount} follow-ups
              </span>
            )}
          </div>
        </div>

        {/* Transcript Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {transcript.length === 0 && conversation.status !== 'connected' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Mic className="h-16 w-16 text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">Ready to talk with Jericho?</h4>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Have natural conversations about your goals, challenges, and growth. 
                Jericho remembers your history and can help you stay on track.
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>✨ Jericho can add goals, achievements, and habits for you</p>
                <p>🧠 Everything you discuss is remembered for next time</p>
                <p>📊 Your progress is tracked and celebrated</p>
              </div>
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
                  <p className="text-[10px] opacity-50 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
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
                    // Open text chat
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
            Your conversation is saved and summarized for coaching continuity
          </p>
        </div>
      </Card>
    </div>
  );
}
