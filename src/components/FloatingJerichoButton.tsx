import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JerichoChat } from "@/components/JerichoChat";
import { JerichoVoiceChat } from "@/components/JerichoVoiceChat";

export function FloatingJerichoButton() {
  const [isTextOpen, setIsTextOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [contextType, setContextType] = useState<string | undefined>();
  const location = useLocation();

  useEffect(() => {
    // Listen for custom events to open Jericho with specific context
    const handleOpenChat = (event: CustomEvent) => {
      setContextType(event.detail?.contextType);
      setIsTextOpen(true);
    };

    window.addEventListener('openJerichoChat' as any, handleOpenChat);
    return () => window.removeEventListener('openJerichoChat' as any, handleOpenChat);
  }, []);

  // Hide on public landing page
  if (location.pathname === "/") {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        <Button
          size="lg"
          variant="secondary"
          className="rounded-full shadow-lg hover:shadow-xl transition-all h-12 w-12 p-0"
          onClick={() => setIsVoiceOpen(true)}
          title="Voice chat with Jericho"
        >
          <Mic className="h-5 w-5" />
          <span className="sr-only">Voice chat with Jericho</span>
        </Button>
        
        <Button
          size="lg"
          className="rounded-full shadow-lg hover:shadow-xl transition-all h-14 w-14 p-0"
          onClick={() => setIsTextOpen(true)}
          title="Text chat with Jericho"
        >
          <MessageSquare className="h-6 w-6" />
          <span className="sr-only">Text chat with Jericho</span>
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