import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, BookOpen, Shield, ChevronRight } from "lucide-react";
import { JerichoChat } from "@/components/JerichoChat";

interface ConversationTopic {
  category: string;
  topics: {
    value: string;
    label: string;
    icon: string;
    description: string;
  }[];
}

const CONVERSATION_TOPICS: ConversationTopic[] = [
  {
    category: "Performance & Accountability",
    topics: [
      { value: "performance-feedback", label: "Performance Feedback", icon: "📊", description: "Address performance gaps or celebrate wins" },
      { value: "missed-expectations", label: "Missed Expectations/Deadlines", icon: "⏰", description: "Discuss unmet goals or deadlines" },
      { value: "declining-performance", label: "Declining Performance", icon: "📉", description: "Address a downward trend in work quality" },
      { value: "pip-warning", label: "PIP or Formal Warning", icon: "📋", description: "Initiate performance improvement plan" },
      { value: "accountability-ownership", label: "Accountability & Ownership", icon: "🎯", description: "Foster greater responsibility" },
    ]
  },
  {
    category: "Behavior & Team Dynamics",
    topics: [
      { value: "behavior-issue", label: "Behavior/Attitude Issue", icon: "⚠️", description: "Address problematic behavior patterns" },
      { value: "conflict-resolution", label: "Conflict Resolution", icon: "🤝", description: "Mediate between team members" },
      { value: "team-not-gelling", label: "Team Not Gelling", icon: "🔗", description: "Address team cohesion issues" },
      { value: "gossip-negativity", label: "Gossip or Negativity", icon: "🗣️", description: "Address toxic communication patterns" },
      { value: "resistance-to-feedback", label: "Resistance to Feedback", icon: "🛡️", description: "Employee rejects constructive input" },
    ]
  },
  {
    category: "Career & Role Changes",
    topics: [
      { value: "promotion-denial", label: "Promotion Denial", icon: "🚫", description: "Explain why promotion isn't happening yet" },
      { value: "role-change", label: "Role Change or Demotion", icon: "🔄", description: "Discuss changes in responsibilities" },
      { value: "career-plateau", label: "Career Plateau", icon: "📍", description: "Help employee stuck in role" },
      { value: "unrealistic-expectations", label: "Unrealistic Expectations", icon: "🌟", description: "Realign expectations with reality" },
      { value: "flight-risk", label: "Flight Risk Retention", icon: "✈️", description: "Engage employee considering leaving" },
    ]
  },
  {
    category: "Personal & Sensitive",
    topics: [
      { value: "personal-issues", label: "Personal Issues Affecting Work", icon: "💔", description: "Balance support with work needs" },
      { value: "hygiene-appearance", label: "Hygiene or Appearance", icon: "🧼", description: "Delicate personal presentation topics" },
      { value: "mental-health", label: "Mental Health Concerns", icon: "🧠", description: "Address observed struggles with care" },
      { value: "substance-concerns", label: "Substance Concerns", icon: "🍷", description: "Suspected substance-related issues" },
      { value: "grief-loss", label: "Grief or Major Life Event", icon: "🕊️", description: "Support through difficult times" },
    ]
  },
  {
    category: "Trust & Integrity",
    topics: [
      { value: "dishonesty", label: "Dishonesty or Integrity", icon: "⚖️", description: "Address suspected lying or ethics issues" },
      { value: "credit-stealing", label: "Credit Stealing", icon: "🏆", description: "Employee taking credit for others' work" },
      { value: "policy-violation", label: "Policy Violation", icon: "📜", description: "Address rule-breaking behavior" },
      { value: "confidentiality-breach", label: "Confidentiality Breach", icon: "🔒", description: "Discuss information sharing violations" },
    ]
  },
  {
    category: "Exit Conversations",
    topics: [
      { value: "termination", label: "Termination", icon: "🚪", description: "Conduct a respectful separation" },
      { value: "layoff", label: "Layoff Notification", icon: "📬", description: "Deliver difficult organizational news" },
      { value: "resignation-response", label: "Resignation Response", icon: "👋", description: "Handle when employee quits" },
      { value: "exit-interview", label: "Exit Interview", icon: "📝", description: "Gather honest departure feedback" },
    ]
  },
  {
    category: "Remote/Hybrid Challenges",
    topics: [
      { value: "remote-engagement", label: "Remote Engagement Issues", icon: "💻", description: "Address disengagement in remote work" },
      { value: "return-to-office", label: "Return-to-Office Resistance", icon: "🏢", description: "Navigate RTO pushback" },
      { value: "communication-gaps", label: "Communication Gaps", icon: "📡", description: "Fix remote communication issues" },
      { value: "work-from-home-abuse", label: "WFH Productivity Concerns", icon: "🏠", description: "Address suspected misuse of flexibility" },
    ]
  },
  {
    category: "Difficult News Delivery",
    topics: [
      { value: "salary-freeze", label: "Salary Freeze or Cut", icon: "💰", description: "Communicate compensation changes" },
      { value: "benefit-changes", label: "Benefit Reductions", icon: "🏥", description: "Explain changes to benefits" },
      { value: "team-restructure", label: "Team Restructure", icon: "🔀", description: "Announce organizational changes" },
      { value: "project-cancellation", label: "Project Cancellation", icon: "⛔", description: "Communicate shelved initiatives" },
    ]
  },
  {
    category: "Boundaries",
    topics: [
      { value: "over-familiar", label: "Over-Familiar Behavior", icon: "🤗", description: "Reset professional boundaries" },
      { value: "workload-pushback", label: "Pushback on Workload", icon: "⚡", description: "Address complaints about assignments" },
      { value: "emotional-outbursts", label: "Emotional Outbursts", icon: "😤", description: "Address unprofessional reactions" },
      { value: "inappropriate-comments", label: "Inappropriate Comments", icon: "💬", description: "Address offensive or off-color remarks" },
    ]
  },
];

interface ManagerResourcesTabProps {
  employee?: { id: string; full_name: string } | null;
}

export function ManagerResourcesTab({ employee }: ManagerResourcesTabProps) {
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [chatOpen, setChatOpen] = useState(false);

  const allTopics = CONVERSATION_TOPICS.flatMap(cat => 
    cat.topics.map(t => ({ ...t, category: cat.category }))
  );

  const selectedTopicData = allTopics.find(t => t.value === selectedTopic);

  const buildInitialMessage = () => {
    if (!selectedTopicData) return "";
    
    const employeeName = employee?.full_name || "a team member";
    return `I need help preparing for a crucial conversation about "${selectedTopicData.label}" with ${employeeName}. ${selectedTopicData.description}. Can you help me think through the best approach, what to say, and how to handle potential responses?`;
  };

  const handleStartCoaching = () => {
    if (selectedTopic) {
      setChatOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Crucial Conversation Preparation
          </CardTitle>
          <CardDescription>
            Jericho can help you prepare for difficult conversations with empathy and effectiveness. 
            Select a topic below to get coaching on how to approach the conversation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a conversation topic..." />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {CONVERSATION_TOPICS.map((category) => (
                    <div key={category.category}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        {category.category}
                      </div>
                      {category.topics.map((topic) => (
                        <SelectItem key={topic.value} value={topic.value}>
                          <span className="flex items-center gap-2">
                            <span>{topic.icon}</span>
                            <span>{topic.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleStartCoaching}
              disabled={!selectedTopic}
              className="md:w-auto"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Get Coaching from Jericho
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {selectedTopicData && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{selectedTopicData.icon}</span>
                <div>
                  <div className="font-medium">{selectedTopicData.label}</div>
                  <div className="text-sm text-muted-foreground">{selectedTopicData.description}</div>
                  <Badge variant="outline" className="mt-2">{selectedTopicData.category}</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Reference Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" />
              Before the Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Clarify your objective and desired outcome</p>
            <p>• Gather specific examples and facts</p>
            <p>• Choose a private, neutral setting</p>
            <p>• Plan your opening statement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-accent" />
              During the Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Start with facts, not judgments</p>
            <p>• Listen actively and ask questions</p>
            <p>• Stay calm if emotions rise</p>
            <p>• Focus on behavior, not personality</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              After the Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Document key points discussed</p>
            <p>• Set clear next steps and timeline</p>
            <p>• Schedule follow-up check-in</p>
            <p>• Reflect on what went well</p>
          </CardContent>
        </Card>
      </div>

      {/* Jericho Chat */}
      <JerichoChat
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setSelectedTopic("");
        }}
        initialMessage={buildInitialMessage()}
        contextType="crucial-conversation"
      />
    </div>
  );
}
