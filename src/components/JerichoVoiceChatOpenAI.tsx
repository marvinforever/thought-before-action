import { useState, useEffect, useRef, useCallback } from "react";
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

// Tool execution functions
const executeClientTool = async (
  toolName: string, 
  args: any, 
  conversationId: string | null
): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Error: Not authenticated";

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, full_name')
    .eq('id', user.id)
    .single();

  const companyId = profile?.company_id;

  switch (toolName) {
    case 'add_90_day_goal': {
      try {
        const now = new Date();
        const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
        const year = now.getFullYear();

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
          company_id: companyId || '',
          goal_text: args.goal_text,
          category: args.category || 'career',
          goal_type: 'professional',
          quarter,
          year,
          goal_number: nextGoalNumber,
          by_when: args.by_when || null,
          completed: false,
        } as any);

        if (error) throw error;
        toast.success("✅ Goal added to your plan!");
        return `Successfully added goal: "${args.goal_text}"`;
      } catch (err) {
        console.error('Error adding goal:', err);
        return "Failed to add goal";
      }
    }

    case 'mark_goal_complete': {
      try {
        const { data: goals } = await supabase
          .from('ninety_day_targets')
          .select('id, goal_text')
          .eq('profile_id', user.id)
          .eq('completed', false);

        const matchingGoal = goals?.find(g => 
          g.goal_text.toLowerCase().includes(args.goal_text.toLowerCase()) ||
          args.goal_text.toLowerCase().includes(g.goal_text.toLowerCase())
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
    }

    case 'add_habit': {
      try {
        const { error } = await supabase.from('leading_indicators').insert({
          profile_id: user.id,
          company_id: companyId,
          habit_name: args.habit_name,
          habit_description: args.description,
          target_frequency: args.frequency || 'daily',
          habit_type: 'custom',
          is_active: true,
          current_streak: 0,
          longest_streak: 0,
        });

        if (error) throw error;
        toast.success("✅ Habit created!");
        return `Created habit: "${args.habit_name}"`;
      } catch (err) {
        console.error('Error adding habit:', err);
        return "Failed to add habit";
      }
    }

    case 'check_off_habit': {
      try {
        // Find matching habit
        const { data: habits } = await supabase
          .from('leading_indicators')
          .select('id, habit_name, current_streak, longest_streak')
          .eq('profile_id', user.id)
          .eq('is_active', true);

        const matchingHabit = habits?.find(h => 
          h.habit_name.toLowerCase().includes(args.habit_name.toLowerCase()) ||
          args.habit_name.toLowerCase().includes(h.habit_name.toLowerCase())
        );

        if (!matchingHabit) return "Could not find that habit";

        const today = new Date().toISOString().split('T')[0];

        // Check if already completed today
        const { data: existing } = await supabase
          .from('habit_completions')
          .select('id')
          .eq('habit_id', matchingHabit.id)
          .eq('completed_date', today)
          .maybeSingle();

        if (existing) {
          return `You already checked off "${matchingHabit.habit_name}" today!`;
        }

        // Insert completion
        await supabase.from('habit_completions').insert({
          habit_id: matchingHabit.id,
          profile_id: user.id,
          completed_date: today,
        });

        // Update streak
        const newStreak = (matchingHabit.current_streak || 0) + 1;
        const newLongest = Math.max(newStreak, matchingHabit.longest_streak || 0);

        await supabase
          .from('leading_indicators')
          .update({ 
            current_streak: newStreak, 
            longest_streak: newLongest,
            last_completed_at: new Date().toISOString()
          })
          .eq('id', matchingHabit.id);

        toast.success(`🔥 ${matchingHabit.habit_name} checked off! ${newStreak} day streak!`);
        return `Checked off "${matchingHabit.habit_name}"! You're now on a ${newStreak} day streak!`;
      } catch (err) {
        console.error('Error checking off habit:', err);
        return "Failed to check off habit";
      }
    }

    case 'add_achievement': {
      try {
        const { error } = await supabase.from('achievements').insert({
          profile_id: user.id,
          company_id: companyId,
          achievement_text: args.achievement_text,
          category: args.category || 'professional',
          achieved_date: new Date().toISOString().split('T')[0],
        });

        if (error) throw error;
        toast.success("🏆 Achievement recorded!");
        return `Recorded achievement: "${args.achievement_text}"`;
      } catch (err) {
        console.error('Error adding achievement:', err);
        return "Failed to add achievement";
      }
    }

    case 'update_vision': {
      try {
        let updateField = '';
        if (args.vision_type === 'professional' || args.vision_type === 'career') {
          updateField = args.timeframe === '3_year' ? 'three_year_vision' : 'one_year_vision';
        } else {
          updateField = args.timeframe === '3_year' ? 'personal_three_year_vision' : 'personal_one_year_vision';
        }

        const { data: existing } = await supabase
          .from('personal_goals')
          .select('profile_id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('personal_goals')
            .update({ [updateField]: args.vision_text })
            .eq('profile_id', user.id);
        } else {
          await supabase
            .from('personal_goals')
            .insert([{ profile_id: user.id, [updateField]: args.vision_text }] as any);
        }

        toast.success("✨ Vision updated!");
        return `Updated ${args.vision_type} ${args.timeframe.replace('_', '-')} vision`;
      } catch (err) {
        console.error('Error updating vision:', err);
        return "Failed to update vision";
      }
    }

    case 'give_recognition': {
      try {
        // Find recipient by name
        const { data: recipients } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('company_id', companyId)
          .neq('id', user.id);

        const recipient = recipients?.find(r => 
          r.full_name?.toLowerCase().includes(args.recipient_name.toLowerCase())
        );

        if (!recipient) {
          return `Could not find someone named "${args.recipient_name}" in your company`;
        }

        const { error } = await supabase.from('recognition_notes').insert({
          given_by: user.id,
          given_to: recipient.id,
          company_id: companyId,
          title: args.recognition_text.substring(0, 100),
          description: args.recognition_text,
          category: args.category || 'teamwork',
          impact_level: args.impact_level || 'medium',
          visibility: 'company',
          recognition_date: new Date().toISOString().split('T')[0],
        });

        if (error) throw error;

        // Send notification email
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('send-recognition-notification', {
            body: {
              recipientEmail: recipient.email,
              recipientName: recipient.full_name,
              giverName: profile?.full_name || 'A colleague',
              recognitionText: args.recognition_text,
              category: args.category || 'teamwork',
              impactLevel: args.impact_level || 'medium',
            },
            headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          });
        } catch (emailErr) {
          console.warn('Could not send recognition email:', emailErr);
        }

        toast.success(`🌟 Recognition sent to ${recipient.full_name}!`);
        return `Sent recognition to ${recipient.full_name}!`;
      } catch (err) {
        console.error('Error giving recognition:', err);
        return "Failed to send recognition";
      }
    }

    case 'save_coaching_insight': {
      try {
        const { error } = await supabase.from('coaching_insights').insert({
          profile_id: user.id,
          company_id: companyId,
          insight_type: args.insight_type,
          insight_text: args.insight_text,
          confidence_level: 'medium',
          source_conversation_id: conversationId,
          is_active: true,
          reinforcement_count: 1,
          first_observed_at: new Date().toISOString(),
          last_reinforced_at: new Date().toISOString(),
        });

        if (error) throw error;
        return `Saved insight about ${args.insight_type}`;
      } catch (err) {
        console.error('Error saving insight:', err);
        return "Failed to save insight";
      }
    }

    case 'add_task': {
      try {
        // Get count for position
        const { count } = await supabase
          .from('project_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', user.id)
          .eq('column_status', args.column_status || 'todo');

        const { error } = await supabase.from('project_tasks').insert({
          profile_id: user.id,
          title: args.title,
          description: args.description || null,
          priority: args.priority || 'medium',
          column_status: args.column_status || 'todo',
          due_date: args.due_date || null,
          position: count || 0,
          source: 'jericho_voice',
          created_by_jericho: true,
        });

        if (error) throw error;
        toast.success("📋 Task added to your board!");
        return `Added task: "${args.title}" to ${args.column_status || 'todo'}`;
      } catch (err) {
        console.error('Error adding task:', err);
        return "Failed to add task";
      }
    }

    case 'complete_task': {
      try {
        const { data: tasks } = await supabase
          .from('project_tasks')
          .select('id, title')
          .eq('profile_id', user.id)
          .neq('column_status', 'done');

        const matchingTask = tasks?.find(t => 
          t.title.toLowerCase().includes(args.task_title.toLowerCase()) ||
          args.task_title.toLowerCase().includes(t.title.toLowerCase())
        );

        if (!matchingTask) return `Could not find a task matching "${args.task_title}"`;

        const { error } = await supabase
          .from('project_tasks')
          .update({ column_status: 'done' })
          .eq('id', matchingTask.id);

        if (error) throw error;
        toast.success("✅ Task completed!");
        return `Marked task as done: "${matchingTask.title}"`;
      } catch (err) {
        console.error('Error completing task:', err);
        return "Failed to complete task";
      }
    }

    case 'create_project': {
      try {
        const { error } = await supabase.from('user_projects').insert({
          profile_id: user.id,
          title: args.title,
          description: args.description || null,
          color: args.color || '#3b82f6',
          status: 'active',
        });

        if (error) throw error;
        toast.success("📁 Project created!");
        return `Created project: "${args.title}"`;
      } catch (err) {
        console.error('Error creating project:', err);
        return "Failed to create project";
      }
    }

    default:
      console.warn('Unknown tool:', toolName);
      return `Unknown tool: ${toolName}`;
  }
};

export function JerichoVoiceChatOpenAI({ isOpen, onClose }: JerichoVoiceChatProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string; timestamp: Date }>>([]);
  const [completeness, setCompleteness] = useState<{
    percentage: number;
    missingItems: string[];
    onboardingPhase: string;
  } | null>(null);
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const messageBufferRef = useRef<{ role: string; content: string }[]>([]);
  const conversationIdRef = useRef<string | null>(null);

  // Keep conversationIdRef in sync
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Save messages to database
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
        messageBufferRef.current = [...messagesToSave, ...messageBufferRef.current];
      }
    } catch (err) {
      console.error('Error saving voice messages:', err);
    }
  }, [conversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const startVoiceConversation = async () => {
    setIsInitializing(true);
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      console.log("Microphone access granted");

      // Get session token from our edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use voice chat");
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const { data, error } = await supabase.functions.invoke('openai-voice-agent', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      const {
        clientSecret,
        conversationId: convId,
        completeness: userCompleteness,
        contextSummary: ctxSummary,
        firstMessage,
      } = data;

      setConversationId(convId);
      setCompleteness(userCompleteness);
      setContextSummary(ctxSummary);

      console.log("Starting OpenAI Realtime WebRTC session");

      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up audio playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      pc.ontrack = (e) => {
        console.log("Received audio track from OpenAI");
        audioEl.srcObject = e.streams[0];
      };

      // Add microphone track
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      // Track pending function calls
      const pendingCalls: Map<string, { name: string; arguments: string }> = new Map();

      dc.onopen = () => {
        console.log("Data channel open");
        // Send first message after connection
        if (firstMessage) {
          dc.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: 'start' }]
            }
          }));
          dc.send(JSON.stringify({ type: 'response.create' }));
        }
      };

      dc.onmessage = async (e) => {
        try {
          const event = JSON.parse(e.data);
          
          // Log important events
          if (!['response.audio.delta', 'input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped'].includes(event.type)) {
            console.log("OpenAI event:", event.type, event);
          }

          switch (event.type) {
            case 'response.audio_transcript.delta':
              setIsSpeaking(true);
              break;
              
            case 'response.audio_transcript.done':
              if (event.transcript) {
                setTranscript(prev => [...prev, { 
                  role: 'assistant', 
                  content: event.transcript, 
                  timestamp: new Date() 
                }]);
                messageBufferRef.current.push({ role: 'assistant', content: event.transcript });
              }
              setIsSpeaking(false);
              break;

            case 'conversation.item.input_audio_transcription.completed':
              if (event.transcript) {
                setTranscript(prev => [...prev, { 
                  role: 'user', 
                  content: event.transcript, 
                  timestamp: new Date() 
                }]);
                messageBufferRef.current.push({ role: 'user', content: event.transcript });
              }
              break;

            // Handle function calls
            case 'response.function_call_arguments.delta':
              // Accumulate arguments
              if (event.call_id) {
                const existing = pendingCalls.get(event.call_id);
                if (existing) {
                  existing.arguments += event.delta || '';
                }
              }
              break;

            case 'response.output_item.added':
              // New function call starting
              if (event.item?.type === 'function_call') {
                pendingCalls.set(event.item.call_id, {
                  name: event.item.name,
                  arguments: ''
                });
              }
              break;

            case 'response.function_call_arguments.done':
              // Function call complete - execute it
              if (event.call_id) {
                const call = pendingCalls.get(event.call_id);
                if (call) {
                  console.log(`Executing tool: ${call.name}`, event.arguments);
                  
                  try {
                    const args = JSON.parse(event.arguments || '{}');
                    const result = await executeClientTool(call.name, args, conversationIdRef.current);
                    console.log(`Tool result for ${call.name}:`, result);

                    // Send result back to OpenAI
                    dc.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: event.call_id,
                        output: result
                      }
                    }));

                    // Continue the conversation
                    dc.send(JSON.stringify({ type: 'response.create' }));
                  } catch (toolErr) {
                    console.error('Error executing tool:', toolErr);
                    dc.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: event.call_id,
                        output: `Error: ${toolErr instanceof Error ? toolErr.message : 'Unknown error'}`
                      }
                    }));
                    dc.send(JSON.stringify({ type: 'response.create' }));
                  }

                  pendingCalls.delete(event.call_id);
                }
              }
              break;

            case 'error':
              console.error("OpenAI error:", event.error);
              toast.error(event.error?.message || "Voice error occurred");
              break;
          }
        } catch (err) {
          console.error("Error parsing event:", err);
        }
      };

      dc.onerror = (e) => {
        console.error("Data channel error:", e);
      };

      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI Realtime API
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error("SDP exchange failed:", errorText);
        throw new Error("Failed to connect to OpenAI Realtime");
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setIsConnected(true);
      toast.success("Connected to Jericho");
      console.log("OpenAI Realtime connected!");

    } catch (error: any) {
      console.error("Failed to start voice conversation:", error);
      toast.error(error.message || "Failed to start voice conversation");
      
      // Cleanup on error
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const endVoiceConversation = async () => {
    try {
      // Close WebRTC connection
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null;
        audioElementRef.current = null;
      }

      setIsConnected(false);
      
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

        // Trigger summarization
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
      
      toast.info("Voice conversation ended");
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
              <div className={`p-2 rounded-full ${isConnected ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                <Phone className={`h-5 w-5 ${isConnected ? 'text-green-500' : 'text-gray-500'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Voice Chat with Jericho</h3>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? '🟢 Connected (OpenAI)' : 
                   isInitializing ? '🟡 Connecting...' : 
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
          
          {/* Context summary badges */}
          {contextSummary && (
            <div className="flex flex-wrap gap-2">
              {contextSummary.coachingInsightsCount > 0 && (
                <div className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-500 px-2 py-1 rounded-full">
                  <Brain className="h-3 w-3" />
                  {contextSummary.coachingInsightsCount} memories
                </div>
              )}
              {contextSummary.currentGoalsCount > 0 && (
                <div className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded-full">
                  <Target className="h-3 w-3" />
                  {contextSummary.currentGoalsCount} goals
                </div>
              )}
              {contextSummary.activeHabitsCount > 0 && (
                <div className="flex items-center gap-1 text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
                  <Trophy className="h-3 w-3" />
                  {contextSummary.activeHabitsCount} habits
                </div>
              )}
              {contextSummary.goalCompletionRate !== null && (
                <div className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded-full">
                  <Sparkles className="h-3 w-3" />
                  {contextSummary.goalCompletionRate}% completion
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transcript area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {transcript.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              {!isConnected ? (
                <>
                  <Phone className="h-12 w-12 mb-4 opacity-50" />
                  <p>Press the button below to start a voice conversation with Jericho</p>
                  <p className="text-sm mt-2">Powered by OpenAI Realtime</p>
                </>
              ) : (
                <>
                  <Mic className="h-12 w-12 mb-4 animate-pulse text-green-500" />
                  <p>Listening... Start speaking!</p>
                </>
              )}
            </div>
          ) : (
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
                    <p className="text-xs opacity-50 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isSpeaking && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm animate-pulse">Jericho is speaking...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Controls */}
        <div className="p-4 border-t flex items-center justify-center gap-4">
          {!isConnected ? (
            <Button
              size="lg"
              onClick={startVoiceConversation}
              disabled={isInitializing}
              className="gap-2"
            >
              {isInitializing ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5" />
                  Start Voice Call
                </>
              )}
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
            </>
          )}
          
          <Button
            variant="outline"
            onClick={onClose}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Switch to Text
          </Button>
        </div>
      </Card>
    </div>
  );
}
