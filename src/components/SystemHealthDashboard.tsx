import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  Users, 
  Mic, 
  MessageSquare, 
  Podcast, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Zap,
  Database,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface HealthMetrics {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersWeek: number;
  podcastsGeneratedToday: number;
  podcastsGeneratedWeek: number;
  avgPodcastDuration: number;
  chatSessionsToday: number;
  chatSessionsWeek: number;
  voiceSessionsToday: number;
  voiceSessionsWeek: number;
  lastPodcastGenerated: string | null;
  lastChatSession: string | null;
}

interface DailyBreakdown {
  date: string;
  podcasts: number;
  chats: number;
  voiceSessions: number;
}

export const SystemHealthDashboard = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = async () => {
    try {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      const weekAgo = subDays(today, 7).toISOString();

      // Parallel queries for all metrics
      const [
        totalUsersResult,
        activeUsersTodayResult,
        activeUsersWeekResult,
        podcastsTodayResult,
        podcastsWeekResult,
        chatsTodayResult,
        chatsWeekResult,
        voiceTodayResult,
        voiceWeekResult,
        lastPodcastResult,
        lastChatResult,
        dailyPodcastsResult,
        dailyChatsResult,
        dailyVoiceResult,
      ] = await Promise.all([
        // Total users
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        
        // Active users today (had a conversation)
        supabase
          .from("conversations")
          .select("profile_id")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        
        // Active users this week
        supabase
          .from("conversations")
          .select("profile_id")
          .gte("created_at", weekAgo),
        
        // Podcasts generated today
        supabase
          .from("podcast_episodes")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        
        // Podcasts generated this week
        supabase
          .from("podcast_episodes")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgo),
        
        // Chat sessions today
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("source", "chat")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        
        // Chat sessions this week
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("source", "chat")
          .gte("created_at", weekAgo),
        
        // Voice sessions today
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("source", "voice")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        
        // Voice sessions this week
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("source", "voice")
          .gte("created_at", weekAgo),
        
        // Last podcast generated
        supabase
          .from("podcast_episodes")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Last chat session
        supabase
          .from("conversations")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Daily podcasts breakdown (last 7 days)
        supabase
          .from("podcast_episodes")
          .select("created_at")
          .gte("created_at", weekAgo)
          .order("created_at", { ascending: true }),
        
        // Daily chats breakdown
        supabase
          .from("conversations")
          .select("created_at")
          .eq("source", "chat")
          .gte("created_at", weekAgo)
          .order("created_at", { ascending: true }),
        
        // Daily voice breakdown
        supabase
          .from("conversations")
          .select("created_at")
          .eq("source", "voice")
          .gte("created_at", weekAgo)
          .order("created_at", { ascending: true }),
      ]);

      // Calculate unique active users
      const activeUsersTodaySet = new Set(
        (activeUsersTodayResult.data || []).map(c => c.profile_id)
      );
      const activeUsersWeekSet = new Set(
        (activeUsersWeekResult.data || []).map(c => c.profile_id)
      );

      // Build daily breakdown
      const dailyMap = new Map<string, DailyBreakdown>();
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), "yyyy-MM-dd");
        dailyMap.set(date, { date, podcasts: 0, chats: 0, voiceSessions: 0 });
      }

      (dailyPodcastsResult.data || []).forEach(p => {
        const date = format(new Date(p.created_at), "yyyy-MM-dd");
        const entry = dailyMap.get(date);
        if (entry) entry.podcasts++;
      });

      (dailyChatsResult.data || []).forEach(c => {
        const date = format(new Date(c.created_at), "yyyy-MM-dd");
        const entry = dailyMap.get(date);
        if (entry) entry.chats++;
      });

      (dailyVoiceResult.data || []).forEach(v => {
        const date = format(new Date(v.created_at), "yyyy-MM-dd");
        const entry = dailyMap.get(date);
        if (entry) entry.voiceSessions++;
      });

      setDailyBreakdown(Array.from(dailyMap.values()));

      setMetrics({
        totalUsers: totalUsersResult.count || 0,
        activeUsersToday: activeUsersTodaySet.size,
        activeUsersWeek: activeUsersWeekSet.size,
        podcastsGeneratedToday: podcastsTodayResult.count || 0,
        podcastsGeneratedWeek: podcastsWeekResult.count || 0,
        avgPodcastDuration: 0,
        chatSessionsToday: chatsTodayResult.count || 0,
        chatSessionsWeek: chatsWeekResult.count || 0,
        voiceSessionsToday: voiceTodayResult.count || 0,
        voiceSessionsWeek: voiceWeekResult.count || 0,
        lastPodcastGenerated: lastPodcastResult.data?.created_at || null,
        lastChatSession: lastChatResult.data?.created_at || null,
      });
    } catch (error) {
      console.error("Error loading system health metrics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMetrics();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load metrics
      </div>
    );
  }

  // Calculate capacity estimates
  const estimatedPodcastCapacity = 150; // per hour with current ElevenLabs plan
  const estimatedChatCapacity = 100; // concurrent with current Lovable AI limits
  const estimatedVoiceCapacity = 15; // concurrent voice calls

  const podcastUtilization = Math.min(100, (metrics.podcastsGeneratedToday / (estimatedPodcastCapacity * 8)) * 100);
  const chatUtilization = Math.min(100, (metrics.chatSessionsToday / (estimatedChatCapacity * 24)) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            System Health Dashboard
          </h2>
          <p className="text-muted-foreground">
            Real-time monitoring of Jericho scaling metrics
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* User Activity */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Registered in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeUsersToday}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeUsersWeek} active this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {metrics.lastChatSession 
                ? format(new Date(metrics.lastChatSession), "h:mm a")
                : "None"}
            </div>
            <p className="text-xs text-muted-foreground">
              Last chat session
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Podcast Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Podcast className="h-5 w-5" />
            Daily Podcast Generation
          </CardTitle>
          <CardDescription>
            Estimated capacity: ~{estimatedPodcastCapacity}/hour ({estimatedPodcastCapacity * 8}/day @ 8 hours)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Generated Today</span>
                <Badge variant="secondary">{metrics.podcastsGeneratedToday}</Badge>
              </div>
              <Progress value={podcastUtilization} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {podcastUtilization.toFixed(1)}% of daily capacity
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold">{metrics.podcastsGeneratedWeek}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Last Generated</p>
              <p className="text-sm">
                {metrics.lastPodcastGenerated 
                  ? format(new Date(metrics.lastPodcastGenerated), "MMM d, h:mm a")
                  : "Never"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jericho Chat & Voice */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Jericho Chat (Text)
            </CardTitle>
            <CardDescription>
              Rate limit: ~{estimatedChatCapacity} concurrent sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Sessions Today</p>
                <p className="text-2xl font-bold">{metrics.chatSessionsToday}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{metrics.chatSessionsWeek}</p>
              </div>
            </div>
            <Progress value={chatUtilization} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {chatUtilization.toFixed(1)}% of estimated daily capacity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Jericho Voice Calls
            </CardTitle>
            <CardDescription>
              Concurrent limit: ~{estimatedVoiceCapacity} voice sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Calls Today</p>
                <p className="text-2xl font-bold">{metrics.voiceSessionsToday}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{metrics.voiceSessionsWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            7-Day Usage Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dailyBreakdown.map((day) => (
              <div key={day.date} className="flex items-center gap-4">
                <div className="w-24 text-sm text-muted-foreground">
                  {format(new Date(day.date), "EEE, MMM d")}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Podcast className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">{day.podcasts}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{day.chats}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">{day.voiceSessions}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Podcast className="h-3 w-3 text-blue-500" /> Podcasts
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-green-500" /> Chats
            </div>
            <div className="flex items-center gap-2">
              <Mic className="h-3 w-3 text-purple-500" /> Voice
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scaling Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Scaling Thresholds
          </CardTitle>
          <CardDescription>
            When to upgrade infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Current Tier</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• ~150 podcasts/hour</li>
                  <li>• ~50-100 concurrent chats</li>
                  <li>• ~15 concurrent voice calls</li>
                </ul>
              </div>
              
              <div className="border rounded-lg p-4 border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">Upgrade at</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 500+ daily podcasts</li>
                  <li>• 1000+ active users</li>
                  <li>• Regular rate limit hits</li>
                </ul>
              </div>
              
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Actions Needed</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• ElevenLabs enterprise plan</li>
                  <li>• Lovable AI rate limit increase</li>
                  <li>• Queue scheduling optimization</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
