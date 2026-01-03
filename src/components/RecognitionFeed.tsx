import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Award, Zap, Trophy, Star, Target, Sparkles, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecognitionItem {
  id: string;
  title: string;
  description: string;
  category: string | null;
  impact_level: string | null;
  is_quick_kudos: boolean;
  created_at: string;
  visibility: string;
  given_by_name: string;
  given_to_name: string;
  capability_name: string | null;
}

interface RecognitionFeedProps {
  companyId?: string;
  limit?: number;
  showHeader?: boolean;
}

export function RecognitionFeed({ companyId, limit = 10, showHeader = true }: RecognitionFeedProps) {
  const [recognitions, setRecognitions] = useState<RecognitionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecognitions();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("recognition-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "recognition_notes",
        },
        () => {
          loadRecognitions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const loadRecognitions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's company
      let targetCompanyId = companyId;
      if (!targetCompanyId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();
        targetCompanyId = profile?.company_id;
      }

      if (!targetCompanyId) return;

      const { data, error } = await supabase
        .from("recognition_notes")
        .select(`
          id,
          title,
          description,
          category,
          impact_level,
          is_quick_kudos,
          created_at,
          visibility,
          capability_id,
          giver:profiles!recognition_notes_given_by_fkey(full_name),
          receiver:profiles!recognition_notes_given_to_fkey(full_name),
          capability:capabilities(name)
        `)
        .eq("company_id", targetCompanyId)
        .in("visibility", ["team", "company"])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formatted = data?.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        impact_level: r.impact_level,
        is_quick_kudos: r.is_quick_kudos,
        created_at: r.created_at,
        visibility: r.visibility,
        given_by_name: r.giver?.full_name || "Someone",
        given_to_name: r.receiver?.full_name || "Someone",
        capability_name: r.capability?.name || null,
      })) || [];

      setRecognitions(formatted);
    } catch (error) {
      console.error("Error loading recognition feed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadRecognitions();
  };

  const getImpactIcon = (level: string | null) => {
    switch (level) {
      case "exceptional": return <Trophy className="h-4 w-4 text-amber-500" />;
      case "significant": return <Star className="h-4 w-4 text-primary" />;
      default: return <Sparkles className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getImpactColor = (level: string | null) => {
    switch (level) {
      case "exceptional": return "bg-amber-500/10 border-amber-500/20";
      case "significant": return "bg-primary/10 border-primary/20";
      default: return "bg-muted/50 border-muted";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Recognition Feed
              </CardTitle>
              <CardDescription>
                Celebrating wins across the team
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent>
        {recognitions.length === 0 ? (
          <div className="text-center py-8">
            <Award className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No recognitions yet</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to celebrate a win!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {recognitions.map((recognition, index) => (
                <motion.div
                  key={recognition.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-lg border ${getImpactColor(recognition.impact_level)}`}
                >
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(recognition.given_to_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">{recognition.given_by_name}</span>
                            {" recognized "}
                            <span className="font-medium">{recognition.given_to_name}</span>
                          </p>
                          <p className="font-medium mt-1 flex items-center gap-1">
                            {recognition.is_quick_kudos && <Zap className="h-4 w-4 text-amber-500" />}
                            {recognition.title}
                          </p>
                        </div>
                        {getImpactIcon(recognition.impact_level)}
                      </div>

                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {recognition.description}
                      </p>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {recognition.category && (
                          <Badge variant="secondary" className="text-xs">
                            {recognition.category}
                          </Badge>
                        )}
                        {recognition.capability_name && (
                          <Badge variant="outline" className="text-xs">
                            <Target className="h-3 w-3 mr-1" />
                            {recognition.capability_name}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(recognition.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
