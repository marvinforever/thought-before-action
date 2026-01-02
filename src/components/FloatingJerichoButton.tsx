import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JerichoChat } from "@/components/JerichoChat";
import { JerichoVoiceChat } from "@/components/JerichoVoiceChat";
import { supabase } from "@/integrations/supabase/client";

const MOMENTUM_COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export function FloatingJerichoButton() {
  const [isTextOpen, setIsTextOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [showVoiceButton, setShowVoiceButton] = useState(false);
  const [contextType, setContextType] = useState<string | undefined>();
  const location = useLocation();

  useEffect(() => {
    const checkUserCompany = async (userId: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();
      
      setShowVoiceButton(profile?.company_id === MOMENTUM_COMPANY_ID);
    };

    // Check on mount and subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        checkUserCompany(session.user.id);
      } else {
        setShowVoiceButton(false);
      }
    });

    // Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) checkUserCompany(user.id);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Listen for custom events to open Jericho with specific context
    const handleOpenChat = (event: CustomEvent) => {
      setContextType(event.detail?.contextType);
      setIsTextOpen(true);
    };

    window.addEventListener('openJerichoChat' as any, handleOpenChat);
    return () => window.removeEventListener('openJerichoChat' as any, handleOpenChat);
  }, []);

  // Hide on public landing page and auth page
  if (location.pathname === "/" || location.pathname === "/auth") {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        {showVoiceButton && (
          <Button
            size="lg"
            className="rounded-full shadow-lg hover:shadow-xl transition-all h-14 w-14 p-0 bg-gradient-to-r from-purple-500 to-indigo-600"
            onClick={() => setIsVoiceOpen(true)}
            title="Voice chat with Jericho"
          >
            <Mic className="h-6 w-6" />
            <span className="sr-only">Voice chat with Jericho</span>
          </Button>
        )}
        <Button
          size="lg"
          className="rounded-full shadow-lg hover:shadow-xl transition-all h-14 w-14 p-0"
          onClick={() => setIsTextOpen(true)}
          title="Chat with Jericho"
        >
          <MessageSquare className="h-6 w-6" />
          <span className="sr-only">Chat with Jericho</span>
        </Button>
      </div>

      {isTextOpen && (
        <JerichoChat
          isOpen={isTextOpen}
          onClose={() => {
            setIsTextOpen(false);
            setContextType(undefined);
          }}
          contextType={contextType}
        />
      )}

      {isVoiceOpen && (
        <JerichoVoiceChat
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
        />
      )}
    </>
  );
}