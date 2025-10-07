import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JerichoChat } from "@/components/JerichoChat";

export function FloatingJerichoButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [contextType, setContextType] = useState<string | undefined>();

  useEffect(() => {
    // Listen for custom events to open Jericho with specific context
    const handleOpenChat = (event: CustomEvent) => {
      setContextType(event.detail?.contextType);
      setIsOpen(true);
    };

    window.addEventListener('openJerichoChat' as any, handleOpenChat);
    return () => window.removeEventListener('openJerichoChat' as any, handleOpenChat);
  }, []);

  return (
    <>
      <Button
        size="lg"
        className="fixed bottom-6 right-6 rounded-full shadow-lg hover:shadow-xl transition-all z-40 h-14 w-14 p-0"
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare className="h-6 w-6" />
        <span className="sr-only">Chat with Jericho</span>
      </Button>

      {isOpen && (
        <JerichoChat
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            setContextType(undefined);
          }}
          contextType={contextType}
        />
      )}
    </>
  );
}