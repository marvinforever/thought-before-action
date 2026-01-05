import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Target, Lightbulb, Loader2 } from "lucide-react";
import { JerichoChat } from "@/components/JerichoChat";

interface SalesCallPrepButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function SalesCallPrepButton({ 
  variant = "outline", 
  size = "sm",
  className 
}: SalesCallPrepButtonProps) {
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [callType, setCallType] = useState<string>("");
  const [prospectName, setProspectName] = useState("");
  const [prospectRole, setProspectRole] = useState("");
  const [company, setCompany] = useState("");
  const [situation, setSituation] = useState("");
  const [objective, setObjective] = useState("");

  const callTypes = [
    { value: "discovery", label: "Discovery Call", icon: "🔍", description: "First meeting to understand needs" },
    { value: "demo", label: "Demo/Presentation", icon: "🎯", description: "Showing your solution" },
    { value: "follow-up", label: "Follow-Up Call", icon: "📞", description: "Continuing a previous conversation" },
    { value: "negotiation", label: "Negotiation/Closing", icon: "🤝", description: "Working through terms" },
    { value: "qbr", label: "QBR/Account Review", icon: "📊", description: "Quarterly business review" },
    { value: "cold", label: "Cold Outreach", icon: "❄️", description: "First contact, no prior relationship" },
    { value: "referral", label: "Referral Introduction", icon: "🌟", description: "Warm intro from mutual connection" },
  ];

  const buildInitialMessage = () => {
    const selectedType = callTypes.find(t => t.value === callType);
    
    let message = `I need help preparing for a sales call. `;
    
    if (selectedType) {
      message += `It's a ${selectedType.label.toLowerCase()}. `;
    }
    
    if (prospectName || company) {
      message += `I'm meeting with ${prospectName || 'a prospect'}${prospectRole ? ` (${prospectRole})` : ''}${company ? ` at ${company}` : ''}. `;
    }
    
    if (objective.trim()) {
      message += `My objective for this call is: ${objective.trim()}. `;
    }
    
    if (situation.trim()) {
      message += `Here's what I know about the situation: ${situation.trim()}. `;
    }
    
    message += `Can you help me build a pre-call plan with discovery questions, key talking points, and potential objections to prepare for?`;
    
    return message;
  };

  const handleStartCoaching = () => {
    setSetupDialogOpen(false);
    setChatOpen(true);
  };

  const resetForm = () => {
    setCallType("");
    setProspectName("");
    setProspectRole("");
    setCompany("");
    setSituation("");
    setObjective("");
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setSetupDialogOpen(true)}
      >
        <Phone className="h-4 w-4 mr-1" />
        Prep Sales Call
      </Button>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Pre-Call Planning with Jericho
            </DialogTitle>
            <DialogDescription>
              Build a winning call plan with discovery questions, talking points, and objection handling.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex gap-2">
                <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Jericho will help you with:</p>
                  <ul className="mt-1 text-muted-foreground space-y-1">
                    <li>• Tailored discovery questions for this specific call</li>
                    <li>• Key talking points and value propositions</li>
                    <li>• Potential objections and how to handle them</li>
                    <li>• Next steps and commitment strategies</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>What type of call is this?</Label>
              <Select value={callType} onValueChange={setCallType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select call type" />
                </SelectTrigger>
                <SelectContent>
                  {callTypes.map((type) => (
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prospect Name</Label>
                <Input
                  placeholder="e.g., Sarah Johnson"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Their Role/Title</Label>
                <Input
                  placeholder="e.g., VP of Sales"
                  value={prospectRole}
                  onChange={(e) => setProspectRole(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                placeholder="e.g., Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Your Objective for This Call</Label>
              <Input
                placeholder="e.g., Schedule a demo with the decision maker"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                What's the ONE thing you want to accomplish?
              </p>
            </div>

            <div className="space-y-2">
              <Label>What do you know about the situation? (optional)</Label>
              <Textarea
                placeholder="Any context about the prospect, their challenges, previous conversations, competitive situation, etc."
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartCoaching}>
              <Target className="h-4 w-4 mr-2" />
              Build My Call Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Jericho Chat for Sales Call Prep */}
      <JerichoChat
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          resetForm();
        }}
        initialMessage={buildInitialMessage()}
        contextType="sales-call-prep"
      />
    </>
  );
}
