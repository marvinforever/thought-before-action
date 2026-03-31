import { useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FormattedMessage } from "@/components/ui/formatted-message";
import { MessageFeedback } from "./MessageFeedback";
import { VoiceRecorder } from "./VoiceRecorder";
import { AddContactPromptCard } from "./AddContactPromptCard";
import { ResearchResultCard } from "./ResearchResultCard";
import { ProductCatalogCard } from "./ProductCatalogCard";
import {
  Sparkles,
  Send,
  Loader2,
  Plus,
  CalendarDays,
  FileText,
  LayoutGrid,
  ClipboardList,
  Paperclip,
  X,
  UserPlus,
  Bell,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
  id?: string;
  contactPrompts?: { name: string; companyName?: string }[];
  researchData?: { query: string; summary: string; citations: string[] };
  catalogData?: { companyName: string; catalog: string; citations?: string[]; savedToCompany?: string };
}

interface SalesChatInterfaceProps {
  messages: Message[];
  input: string;
  chatLoading: boolean;
  hasStarted: boolean;
  hasMethodologyAccess: boolean;
  chatMode: "coach" | "rec";
  deals: any[];
  profile: any;
  companyId: string;
  userId: string;
  newCustomerPrompt?: { name: string } | null;
  onUploadDocument: () => void;
  onInputChange: (value: string) => void;
  onSendMessage: (message?: string) => void;
  onCancel: () => void;
  onDismissNewCustomerPrompt?: () => void;
  onCreateCustomerProfile?: () => void;
  onStartCoaching: () => void;
  onAddDeal: () => void;
  onShowProposalWizard: () => void;
  onShowCallPlanTracker: () => void;
  onShowPitchDeck?: () => void;
  onDismissContactPrompt?: (messageIdx: number, promptIdx: number) => void;
  onContactAdded?: (name: string) => void;
}

export function SalesChatInterface({
  messages,
  input,
  chatLoading,
  hasStarted,
  hasMethodologyAccess,
  chatMode,
  deals,
  profile,
  companyId,
  userId,
  newCustomerPrompt,
  onUploadDocument,
  onInputChange,
  onSendMessage,
  onCancel,
  onDismissNewCustomerPrompt,
  onCreateCustomerProfile,
  onStartCoaching,
  onAddDeal,
  onShowProposalWizard,
  onShowCallPlanTracker,
  onDismissContactPrompt,
  onContactAdded,
}: SalesChatInterfaceProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (hasStarted) {
      scrollToBottom();
    }
  }, [hasStarted, messages.length, chatLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  if (!hasStarted) {
    return (
      <motion.div 
        className="flex-1 flex flex-col items-center justify-center text-center px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Animated Hero */}
        <motion.div 
          className="relative mb-8"
          animate={{ 
            y: [0, -8, 0],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="h-24 w-24 rounded-2xl bg-primary flex items-center justify-center shadow-2xl">
            <span className="text-4xl font-bold text-accent">J</span>
          </div>
          <motion.div
            className="absolute -top-2 -right-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-6 w-6 text-accent" />
          </motion.div>
          <motion.div
            className="absolute -bottom-1 -left-1"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="h-4 w-4 rounded-full bg-accent/50" />
          </motion.div>
        </motion.div>

        <motion.h2 
          className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Hey{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! 👋
        </motion.h2>
        
        <motion.p 
          className="text-lg text-muted-foreground mb-8 max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          I'm Jericho, your AI sales agent. Let's work on your pipeline and close some deals together.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Button 
            size="lg" 
            onClick={onStartCoaching}
            className="gap-2 text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all bg-primary hover:bg-primary/90"
          >
            <Sparkles className="h-5 w-5" />
            Let's Get Started
          </Button>
        </motion.div>

        <motion.div 
          className="mt-12 flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {[
            "Prospecting strategies",
            "Discovery questions", 
            "Handle objections",
            "Close more deals"
          ].map((topic, i) => (
            <Badge 
              key={i} 
              variant="secondary" 
              className="text-sm py-1.5 px-4 bg-primary/5 text-primary border border-primary/10"
            >
              {topic}
            </Badge>
          ))}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Scroll Button */}
      <button
        onClick={scrollToBottom}
        className="text-xs text-primary hover:underline mb-2 flex items-center gap-1"
      >
        ↓ Scroll to bottom
      </button>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-4">
        <div className="space-y-4 pb-4">
          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mr-2 mt-1 shrink-0 shadow-md">
                    <span className="text-sm font-bold text-accent">J</span>
                  </div>
                )}
                <div className="max-w-[85%]">
                  <Card className={`${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border-border/50"}`}>
                    <CardContent className="p-3">
                      {msg.role === "assistant" ? (
                        <FormattedMessage content={msg.content} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Feedback buttons for assistant messages */}
                  {msg.role === "assistant" && !chatLoading && (
                    <div className="mt-1 ml-1">
                      <MessageFeedback
                        messageId={msg.id}
                        companyId={companyId}
                        userId={userId}
                        messageContent={msg.content}
                        recommendationType={chatMode === "rec" ? "product_rec" : "coaching"}
                        conversationContext={messages.slice(Math.max(0, idx - 4), idx).map(m => `${m.role}: ${m.content}`).join("\n")}
                      />
                    </div>
                  )}
                  {/* Contact prompt cards */}
                  {msg.role === "assistant" && msg.contactPrompts && msg.contactPrompts.length > 0 && (
                    <AnimatePresence>
                      {msg.contactPrompts.map((cp, cpIdx) => (
                        <AddContactPromptCard
                          key={`${idx}-${cpIdx}-${cp.name}`}
                          prompt={cp}
                          userId={userId}
                          onDismiss={() => onDismissContactPrompt?.(idx, cpIdx)}
                          onAdded={(name) => onContactAdded?.(name)}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                  {/* Research result card */}
                  {msg.role === "assistant" && msg.researchData && (
                    <ResearchResultCard
                      query={msg.researchData.query}
                      summary={msg.researchData.summary}
                      citations={msg.researchData.citations}
                    />
                  )}
                  {/* Product catalog card */}
                  {msg.role === "assistant" && msg.catalogData && (
                    <ProductCatalogCard
                      companyName={msg.catalogData.companyName}
                      catalog={msg.catalogData.catalog}
                      citations={msg.catalogData.citations}
                      savedToCompany={msg.catalogData.savedToCompany}
                      userCompanyId={companyId}
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {chatLoading && (
            <motion.div 
              className="flex justify-start items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mr-2 shadow-md shrink-0">
                <span className="text-sm font-bold text-accent">J</span>
              </div>
              <Card className="bg-card">
                <CardContent className="p-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </CardContent>
              </Card>
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Stop
              </Button>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* New Customer Prompt Banner */}
      <AnimatePresence>
        {newCustomerPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-3"
          >
            <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                <span className="text-primary">{newCustomerPrompt.name}</span> isn't in your system yet.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Want to create a company profile so you can track notes and history?
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => onCreateCustomerProfile?.()}
              >
                <UserPlus className="h-3 w-3" />
                Create Profile
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={onDismissNewCustomerPrompt}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {hasMethodologyAccess && (
          <>
            <Button 
              variant="default" 
              size="sm"
              onClick={onShowCallPlanTracker}
              className="gap-1 bg-accent text-primary hover:bg-accent/90"
            >
              <ClipboardList className="h-3 w-3" />
              4-Call Tracker
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onSendMessage("Generate a 4-call plan for a grower I'm working with")}
              className="gap-1"
            >
              <CalendarDays className="h-3 w-3" />
              Generate 4-Call Plan
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onSendMessage("Walk me through the Season Review process")}
            >
              Season Review tips
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onSendMessage("How do we hit the 111.4 goal?")}
            >
              111.4 Strategy
            </Button>
          </>
        )}
        {deals.length === 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onAddDeal}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            Add my first deal
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onSendMessage("Give me a pre-call plan based on what we've discussed")}
          className="gap-1"
        >
          <FileText className="h-3 w-3" />
          Pre-call Plan
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onSendMessage("Show me my current pipeline")}
          className="gap-1"
        >
          <LayoutGrid className="h-3 w-3" />
          My pipeline
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onSendMessage("What should I focus on today?")}
        >
          Today's priorities
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onInputChange("Research ")}
          className="gap-1"
        >
          <Search className="h-3 w-3" />
          Research a topic
        </Button>
      </div>

      {/* Input */}
      <div className="pt-4 border-t bg-background/80 backdrop-blur-sm -mx-4 px-4 pb-2 space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onUploadDocument}
            disabled={chatLoading}
            className="self-end shrink-0 border-primary/30 hover:bg-primary/10"
            title="Upload document"
          >
            <Paperclip className="h-5 w-5 text-primary" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about sales..."
            className="resize-none min-h-[52px] border-primary/20 focus:border-primary"
            rows={2}
          />
          <VoiceRecorder 
            onTranscript={(text) => onInputChange(input ? `${input} ${text}` : text)}
            disabled={chatLoading}
          />
          <Button
            onClick={() => onSendMessage()}
            disabled={chatLoading || !input.trim()}
            className="px-4 self-end bg-primary hover:bg-primary/90"
          >
            {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        
        {/* Create Proposal button */}
        {messages.length >= 2 && chatMode === 'rec' && (
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onShowProposalWizard}
              className="gap-1.5 border-primary/20 hover:bg-primary/5"
            >
              <FileText className="h-3.5 w-3.5" />
              Create Proposal
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
