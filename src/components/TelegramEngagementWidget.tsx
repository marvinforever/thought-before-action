import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Users, TrendingUp, BarChart3 } from "lucide-react";

export function TelegramEngagementWidget() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    linkedUsers: 0,
    totalMessages: 0,
    messagesLast7Days: 0,
    topTypes: [] as { type: string; count: number }[],
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get team member IDs from manager assignments
      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select("employee_id")
        .eq("manager_id", user.id);

      const teamIds = assignments?.map(a => a.employee_id) || [];
      if (teamIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get linked users count
      const { count: linkedCount } = await supabase
        .from("telegram_links")
        .select("id", { count: "exact", head: true })
        .in("user_id", teamIds)
        .eq("is_active", true);

      // Get messages last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentMessages } = await supabase
        .from("telegram_conversations")
        .select("message_type, created_at")
        .in("user_id", teamIds)
        .gte("created_at", sevenDaysAgo);

      // Count by type
      const typeCounts: Record<string, number> = {};
      (recentMessages || []).forEach(m => {
        typeCounts[m.message_type] = (typeCounts[m.message_type] || 0) + 1;
      });

      const topTypes = Object.entries(typeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Total messages
      const { count: totalCount } = await supabase
        .from("telegram_conversations")
        .select("id", { count: "exact", head: true })
        .in("user_id", teamIds);

      setStats({
        linkedUsers: linkedCount || 0,
        totalMessages: totalCount || 0,
        messagesLast7Days: recentMessages?.length || 0,
        topTypes,
      });
    } catch (err) {
      console.error("Error loading Telegram stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    sales_coaching: "Sales Coaching",
    pre_call_prep: "Call Prep",
    pipeline_update: "Pipeline",
    product_question: "Products",
    growth_plan: "Growth Plan",
    capabilities: "Capabilities",
    kudos: "Kudos",
    sprint_check: "Sprint Check",
    training: "Training",
    general: "General",
  };

  const typeColors: Record<string, string> = {
    sales_coaching: "bg-blue-500",
    pre_call_prep: "bg-indigo-500",
    pipeline_update: "bg-emerald-500",
    kudos: "bg-amber-500",
    growth_plan: "bg-purple-500",
    training: "bg-cyan-500",
    general: "bg-gray-400",
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading Telegram engagement...
        </CardContent>
      </Card>
    );
  }

  if (stats.linkedUsers === 0 && stats.totalMessages === 0) return null;

  return (
    <Card className="border-l-4 border-l-accent/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-accent" />
            <CardTitle className="text-base">Telegram Engagement</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {stats.linkedUsers} linked
          </Badge>
        </div>
        <CardDescription>Team Telegram activity (last 7 days)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-foreground">{stats.messagesLast7Days}</div>
            <div className="text-xs text-muted-foreground">Messages (7d)</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-foreground">
              {stats.linkedUsers > 0 ? Math.round(stats.messagesLast7Days / stats.linkedUsers) : 0}
            </div>
            <div className="text-xs text-muted-foreground">Per User Avg</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-foreground">{stats.totalMessages}</div>
            <div className="text-xs text-muted-foreground">All Time</div>
          </div>
        </div>

        {/* Type Breakdown */}
        {stats.topTypes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Feature</p>
            <div className="space-y-1.5">
              {stats.topTypes.map(({ type, count }) => {
                const maxCount = stats.topTypes[0]?.count || 1;
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 truncate">
                      {typeLabels[type] || type}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${typeColors[type] || "bg-accent"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
