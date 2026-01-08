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

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          console.log("OpenAI event:", event.type);

          switch (event.type) {
            case 'response.audio_transcript.delta':
              // Assistant speaking
              setIsSpeaking(true);
              break;
              
            case 'response.audio_transcript.done':
              // Assistant finished speaking
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
              // User speech transcribed
              if (event.transcript) {
                setTranscript(prev => [...prev, { 
                  role: 'user', 
                  content: event.transcript, 
                  timestamp: new Date() 
                }]);
                messageBufferRef.current.push({ role: 'user', content: event.transcript });
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
