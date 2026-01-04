import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { JerichoChat } from "@/components/JerichoChat";

interface PrepareConversationButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  employee?: { id: string; full_name: string } | null;
}

export function PrepareConversationButton({ 
  variant = "outline", 
  size = "sm",
  className,
  employee 
}: PrepareConversationButtonProps) {
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [conversationType, setConversationType] = useState<string>("");
  const [situation, setSituation] = useState("");

  const conversationTypes = [
    { value: "performance-feedback", label: "Performance Feedback", icon: "📊" },
    { value: "behavior-issue", label: "Behavior/Attitude Issue", icon: "⚠️" },
    { value: "conflict-resolution", label: "Conflict Resolution", icon: "🤝" },
    { value: "missed-expectations", label: "Missed Expectations/Deadlines", icon: "⏰" },
    { value: "difficult-news", label: "Delivering Difficult News", icon: "💬" },
    { value: "pip-warning", label: "PIP or Formal Warning", icon: "📋" },
    { value: "other", label: "Other Tough Conversation", icon: "💭" }
  ];

  const buildInitialMessage = () => {
    const selectedType = conversationTypes.find(t => t.value === conversationType);
    const employeeName = employee?.full_name || "a team member";
    
    let message = `I need help preparing for a crucial conversation. `;
    
    if (selectedType) {
      message += `It's about ${selectedType.label.toLowerCase()} with ${employeeName}. `;
    } else {
      message += `It involves ${employeeName}. `;
    }
    
    if (situation.trim()) {
      message += `Here's the situation: ${situation.trim()}`;
    } else {
      message += `Can you help me figure out the best approach?`;
    }
    
    return message;
  };

  const handleStartCoaching = () => {
    setSetupDialogOpen(false);
    setChatOpen(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setSetupDialogOpen(true)}
      >
        <Shield className="h-4 w-4 mr-1" />
        Prepare Conversation
      </Button>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Prepare for a Crucial Conversation
            </DialogTitle>
            <DialogDescription>
              Jericho will help you navigate tough conversations with empathy and effectiveness.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400">Jericho will help you determine:</p>
                  <ul className="mt-1 text-muted-foreground space-y-1">
                    <li>• Whether to have this conversation in-person or via writing</li>
                    <li>• How to structure your message for clarity and empathy</li>
                    <li>• Key points to cover and potential responses to prepare for</li>
                  </ul>
                </div>
              </div>
            </div>

            {employee && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Regarding:</span>{" "}
                  <span className="font-medium">{employee.full_name}</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>What type of conversation is this?</Label>
              <Select value={conversationType} onValueChange={setConversationType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select conversation type" />
                </SelectTrigger>
                <SelectContent>
                  {conversationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Briefly describe the situation (optional)</Label>
              <Textarea
                placeholder="What happened? What behavior or issue needs to be addressed?"
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                The more context you provide, the better Jericho can help you prepare.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartCoaching}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Start Coaching
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Jericho Chat for Crucial Conversations */}
      <JerichoChat
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setConversationType("");
          setSituation("");
        }}
        initialMessage={buildInitialMessage()}
        contextType="crucial-conversation"
      />
    </>
  );
}