import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Eye, Users, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface InterestIndicator {
  id: string;
  profile_id: string;
  item_type: string;
  item_title: string;
  item_details: any;
  indicated_at: string;
  manager_viewed: boolean;
  admin_viewed: boolean;
  profile: {
    full_name: string;
    email: string;
  };
}

export const EmployeeInterestIndicators = () => {
  const [indicators, setIndicators] = useState<InterestIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadIndicators();
  }, []);

  const loadIndicators = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is manager or admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      const { data: managerAssignments } = await supabase
        .from('manager_assignments')
        .select('id')
        .eq('manager_id', user.id)
        .limit(1);

      setIsManager((managerAssignments && managerAssignments.length > 0) || profile?.is_admin || false);

      // Fetch indicators without FK join (FK is missing in DB schema)
      const { data: indicatorsData, error } = await supabase
        .from('roadmap_interest_indicators')
        .select('*')
        .order('indicated_at', { ascending: false });

      if (error) throw error;

      let enriched: any[] = (indicatorsData as any) || [];

      // Try to attach profile info in a separate query if possible
      try {
        const profileIds = Array.from(new Set(enriched.map((i: any) => i.profile_id).filter(Boolean)));
        if (profileIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', profileIds);

          const byId = new Map((profilesData || []).map((p: any) => [p.id, p]));
          enriched = enriched.map((i: any) => ({
            ...i,
            profile: byId.get(i.profile_id)
              ? { full_name: byId.get(i.profile_id).full_name, email: byId.get(i.profile_id).email }
              : undefined,
          }));
        }
      } catch (_) {
        // Non-fatal: continue without profile details
      }

      setIndicators(enriched);

    } catch (error) {
      console.error('Error loading indicators:', error);
      toast({
        title: "Error",
        description: "Failed to load interest indicators",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsViewed = async (indicatorId: string, isAdmin: boolean) => {
    try {
      const updateField = isAdmin ? 'admin_viewed' : 'manager_viewed';
      
      const { error } = await supabase
        .from('roadmap_interest_indicators')
        .update({ [updateField]: true })
        .eq('id', indicatorId);

      if (error) throw error;

      setIndicators(prev => prev.map(ind => 
        ind.id === indicatorId 
          ? { ...ind, [updateField]: true }
          : ind
      ));

      toast({
        title: "Marked as viewed",
        description: "Interest indicator has been acknowledged",
      });
    } catch (error: any) {
      console.error('Error marking as viewed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update indicator",
        variant: "destructive",
      });
    }
  };

  const getItemTypeColor = (type: string) => {
    switch (type) {
      case 'priority_focus':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'future_investment':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
      case 'quick_win':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'priority_focus':
        return 'Priority Focus';
      case 'future_investment':
        return 'Future Investment';
      case 'quick_win':
        return 'Quick Win';
      default:
        return type;
    }
  };

  if (!isManager) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading interest indicators...</p>
        </CardContent>
      </Card>
    );
  }

  const unviewedCount = indicators.filter(ind => !ind.manager_viewed && !ind.admin_viewed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Employee Development Interests
            </CardTitle>
            <CardDescription>
              Team members who have indicated interest in specific growth opportunities
            </CardDescription>
          </div>
          {unviewedCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unviewedCount} New
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {indicators.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No interest indicators yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When employees indicate interest in development opportunities, they'll appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {indicators.map((indicator) => (
              <Card key={indicator.id} className={!indicator.manager_viewed && !indicator.admin_viewed ? 'border-primary' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getItemTypeColor(indicator.item_type)}>
                          {getItemTypeLabel(indicator.item_type)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {indicator.profile?.full_name || 'Unknown'}
                        </span>
                      </div>
                      <p className="font-medium mb-1">{indicator.item_title}</p>
                      {indicator.item_details?.reasoning && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {indicator.item_details.reasoning}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(indicator.indicated_at), { addSuffix: true })}
                        </span>
                        {indicator.manager_viewed && (
                          <span className="text-green-600 dark:text-green-400">Manager Viewed</span>
                        )}
                        {indicator.admin_viewed && (
                          <span className="text-green-600 dark:text-green-400">Admin Viewed</span>
                        )}
                      </div>
                    </div>
                    {(!indicator.manager_viewed || !indicator.admin_viewed) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsViewed(indicator.id, true)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Mark Viewed
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};