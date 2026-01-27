import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Trophy, Clock } from "lucide-react";

interface CoachingEngagement {
  repId: string;
  repName: string;
  conversationCount: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
  lastSession: string | null;
  topics: string[];
}

interface CoachingEngagementTableProps {
  data: CoachingEngagement[];
  isLoading?: boolean;
  onRepClick?: (repId: string) => void;
}

export function CoachingEngagementTable({ data, isLoading, onRepClick }: CoachingEngagementTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No AI coaching sessions in the last 30 days</p>
      </div>
    );
  }

  const maxConversations = Math.max(...data.map((d) => d.conversationCount), 1);
  const maxMessages = Math.max(...data.map((d) => d.totalMessages), 1);

  return (
    <div className="space-y-6">
      {/* Top 3 Leaderboard */}
      <div className="grid grid-cols-3 gap-4">
        {data.slice(0, 3).map((rep, index) => (
          <div
            key={rep.repId}
            className={`relative p-4 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors ${
              index === 0
                ? "bg-amber-500/10 border-amber-500/30"
                : index === 1
                ? "bg-slate-500/10 border-slate-500/30"
                : "bg-orange-500/10 border-orange-500/30"
            }`}
            onClick={() => onRepClick?.(rep.repId)}
          >
            <div className="absolute top-2 right-2">
              {index === 0 && <Trophy className="h-5 w-5 text-amber-500" />}
              {index === 1 && <Trophy className="h-5 w-5 text-slate-400" />}
              {index === 2 && <Trophy className="h-5 w-5 text-orange-400" />}
            </div>
            <p className="text-sm text-muted-foreground">#{index + 1}</p>
            <h4 className="font-semibold truncate">{rep.repName}</h4>
            <p className="text-2xl font-bold mt-1">{rep.conversationCount}</p>
            <p className="text-xs text-muted-foreground">coaching sessions</p>
          </div>
        ))}
      </div>

      {/* Full Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Rep Name</TableHead>
              <TableHead className="text-center">Sessions</TableHead>
              <TableHead className="text-center">Messages</TableHead>
              <TableHead className="text-center">Avg/Session</TableHead>
              <TableHead>Last Session</TableHead>
              <TableHead>Recent Topics</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((rep, index) => (
              <TableRow
                key={rep.repId}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRepClick?.(rep.repId)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">{rep.repName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={(rep.conversationCount / maxConversations) * 100}
                      className="h-2 w-16"
                    />
                    <span className="text-sm font-medium w-8 text-right">
                      {rep.conversationCount}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={(rep.totalMessages / maxMessages) * 100}
                      className="h-2 w-16"
                    />
                    <span className="text-sm font-medium w-8 text-right">
                      {rep.totalMessages}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{rep.avgMessagesPerConversation}</Badge>
                </TableCell>
                <TableCell>
                  {rep.lastSession ? (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(rep.lastSession), { addSuffix: true })}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {rep.topics.slice(0, 2).map((topic, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] truncate max-w-[90px]">
                        {topic}
                      </Badge>
                    ))}
                    {rep.topics.length > 2 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{rep.topics.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
