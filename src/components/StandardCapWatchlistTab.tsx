import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, AlertCircle, Loader2, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WatchlistCapability {
  id: string;
  name: string;
  category: string;
  description: string;
  is_custom: boolean;
  companies_using_count: number;
  companies: Array<{
    id: string;
    name: string;
  }>;
  has_resource_gap: boolean;
}

export const StandardCapWatchlistTab = () => {
  const [watchlistCapabilities, setWatchlistCapabilities] = useState<WatchlistCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      setLoading(true);

      // Get custom capabilities used by 3+ companies
      const { data: capabilities, error: capError } = await supabase
        .from('capabilities')
        .select('*')
        .eq('is_custom', true)
        .eq('status', 'approved')
        .gte('companies_using_count', 3)
        .order('companies_using_count', { ascending: false });

      if (capError) throw capError;

      // For each capability, get the companies using it
      const watchlistWithCompanies = await Promise.all(
        (capabilities || []).map(async (cap) => {
          const { data: stats } = await supabase
            .from('capability_usage_stats')
            .select(`
              company_id,
              companies:company_id (
                id,
                name
              )
            `)
            .eq('capability_id', cap.id);

          // Check for resource gaps
          const { data: gaps } = await supabase
            .from('capability_resource_gaps')
            .select('id')
            .eq('capability_id', cap.id)
            .is('resolved_at', null)
            .limit(1);

          return {
            ...cap,
            companies: stats?.map((s: any) => s.companies).filter(Boolean) || [],
            has_resource_gap: (gaps && gaps.length > 0) || false
          };
        })
      );

      setWatchlistCapabilities(watchlistWithCompanies);
    } catch (error) {
      console.error('Error loading watchlist:', error);
      toast({
        title: "Error",
        description: "Failed to load watchlist",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (capabilityId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update capability to mark as standard (non-custom)
      const { error } = await supabase
        .from('capabilities')
        .update({ 
          is_custom: false,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', capabilityId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Capability promoted to standard library",
      });

      loadWatchlist();
    } catch (error) {
      console.error('Error promoting capability:', error);
      toast({
        title: "Error",
        description: "Failed to promote capability",
        variant: "destructive",
      });
    }
  };

  const toggleRow = (capId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(capId)) {
      newExpanded.delete(capId);
    } else {
      newExpanded.add(capId);
    }
    setExpandedRows(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Standard Capability Watchlist
          </CardTitle>
          <CardDescription>
            Custom capabilities used by 3+ companies. Consider promoting to standard library.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {watchlistCapabilities.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No capabilities meet the promotion criteria yet
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlistCapabilities.map((cap) => (
                  <>
                    <TableRow key={cap.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(cap.id)}
                        >
                          {expandedRows.has(cap.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{cap.name}</TableCell>
                      <TableCell>{cap.category}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {cap.companies_using_count} companies
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cap.has_resource_gap && (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            No Resources
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          onClick={() => handlePromote(cap.id)}
                          disabled={cap.has_resource_gap}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Promote to Standard
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(cap.id) && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="p-4 bg-muted rounded-lg space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">Description</h4>
                              <p className="text-sm text-muted-foreground">{cap.description}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Companies Using This Capability</h4>
                              <div className="flex flex-wrap gap-2">
                                {cap.companies.map((company) => (
                                  <Badge key={company.id} variant="outline">
                                    {company.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {cap.has_resource_gap && (
                              <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  This capability has no assigned resources. Add resources before promoting to standard library.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
