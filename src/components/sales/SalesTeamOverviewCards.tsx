import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, Phone, MessageSquare, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OverviewData {
  activeSellers: number;
  totalPipelineValue: number;
  avgFourCallCompletion: number;
  coachingSessions: number;
  lastActivity: string | null;
}

interface SalesTeamOverviewCardsProps {
  data: OverviewData;
  isLoading?: boolean;
}

export function SalesTeamOverviewCards({ data, isLoading }: SalesTeamOverviewCardsProps) {
  const cards = [
    {
      title: "Active Sellers",
      value: data.activeSellers.toString(),
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Pipeline Value",
      value: `$${data.totalPipelineValue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "4-Call Completion",
      value: `${data.avgFourCallCompletion}%`,
      icon: Phone,
      color: data.avgFourCallCompletion >= 50 ? "text-green-500" : data.avgFourCallCompletion >= 25 ? "text-amber-500" : "text-red-500",
      bgColor: data.avgFourCallCompletion >= 50 ? "bg-green-500/10" : data.avgFourCallCompletion >= 25 ? "bg-amber-500/10" : "bg-red-500/10",
    },
    {
      title: "AI Coaching (30d)",
      value: data.coachingSessions.toString(),
      icon: MessageSquare,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "..." : card.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {data.lastActivity && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Last team activity: {formatDistanceToNow(new Date(data.lastActivity), { addSuffix: true })}
          </span>
        </div>
      )}
    </div>
  );
}
