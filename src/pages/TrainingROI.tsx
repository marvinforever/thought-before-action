import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Clock, 
  Target,
  ArrowLeft,
  Download,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useViewAs } from "@/contexts/ViewAsContext";
import { ViewAsCompanyBanner } from "@/components/ViewAsCompanyBanner";

interface ROIMetric {
  id: string;
  metric_type: string;
  current_value: number;
  baseline_value: number;
  period_start: string;
  period_end: string;
  notes: string;
  measured_at: string;
}

export default function TrainingROI() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [metrics, setMetrics] = useState<ROIMetric[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    checkAccess();
    loadMetrics();
  }, [viewAsCompanyId]);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    // Check if viewing as another company or using own profile
    if (viewAsCompanyId) {
      setCompanyId(viewAsCompanyId);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      toast({
        title: "Access Denied",
        description: "Admin access required to view ROI dashboard",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    setCompanyId(profile.company_id);
  };

  const loadMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine company ID
      let targetCompanyId = viewAsCompanyId;
      
      if (!targetCompanyId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (!profile?.company_id) return;
        targetCompanyId = profile.company_id;
      }

      const { data, error } = await supabase
        .from('training_roi_tracking')
        .select('*')
        .eq('company_id', targetCompanyId)
        .order('measured_at', { ascending: false });

      if (error) throw error;

      setMetrics(data || []);
    } catch (error: any) {
      console.error('Error loading metrics:', error);
      toast({
        title: "Error loading ROI data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!companyId) return;

    setGenerating(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Last 3 months

      const { data, error } = await supabase.functions.invoke('calculate-roi-metrics', {
        body: {
          companyId,
          periodStart: format(startDate, 'yyyy-MM-dd'),
          periodEnd: format(endDate, 'yyyy-MM-dd'),
        }
      });

      if (error) throw error;

      toast({
        title: "ROI Report Generated",
        description: "Your training ROI metrics have been calculated",
      });

      loadMetrics();
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Error generating report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const getLatestMetric = (type: string) => {
    return metrics.find(m => m.metric_type === type);
  };

  const calculateImprovement = (current: number, baseline: number) => {
    if (baseline === 0) return 0;
    return ((current - baseline) / baseline) * 100;
  };

  const formatMetricValue = (type: string, value: number) => {
    switch (type) {
      case 'retention_rate':
      case 'engagement_trend':
        return `${value.toFixed(1)}%`;
      case 'time_to_promotion':
      case 'burnout_incidents':
        return Math.round(value).toString();
      case 'training_spend':
        return `$${value.toFixed(0)}`;
      default:
        return value.toFixed(1);
    }
  };

  const retentionMetric = getLatestMetric('retention_rate');
  const promotionMetric = getLatestMetric('time_to_promotion');
  const engagementMetric = getLatestMetric('engagement_trend');
  const burnoutMetric = getLatestMetric('burnout_incidents');

  return (
    <div className="min-h-screen bg-background">
      <ViewAsCompanyBanner />
      
      {/* Header */}
      <div className="border-b bg-card/50">
        <div className="container max-w-7xl py-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Training ROI Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Measure the impact of proactive employee development
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
              <Button onClick={generateReport} disabled={generating || loading}>
                {generating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate New Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl py-8">
        {loading ? (
          <div className="text-center py-12">Loading ROI metrics...</div>
        ) : metrics.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No ROI Data Yet</h3>
              <p className="text-muted-foreground mb-6">
                Generate your first training ROI report to start tracking the impact of Jericho
              </p>
              <Button onClick={generateReport} disabled={generating}>
                {generating ? "Generating..." : "Generate First Report"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="retention">Retention</TabsTrigger>
              <TabsTrigger value="development">Development</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="cost-savings">Cost Savings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Retention Rate */}
                {retentionMetric && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Retention Rate</CardDescription>
                      <CardTitle className="text-3xl">
                        {formatMetricValue('retention_rate', retentionMetric.current_value)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {retentionMetric.current_value > retentionMetric.baseline_value ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        <span className={`text-sm ${retentionMetric.current_value > retentionMetric.baseline_value ? 'text-green-600' : 'text-destructive'}`}>
                          {calculateImprovement(retentionMetric.current_value, retentionMetric.baseline_value).toFixed(1)}% vs baseline
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Time to Promotion */}
                {promotionMetric && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Avg Time to Promotion</CardDescription>
                      <CardTitle className="text-3xl">
                        {Math.round(promotionMetric.current_value)} days
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {promotionMetric.current_value < promotionMetric.baseline_value ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {Math.abs(Math.round(promotionMetric.baseline_value - promotionMetric.current_value))} days faster
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Engagement Score */}
                {engagementMetric && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Engagement Score</CardDescription>
                      <CardTitle className="text-3xl">
                        {engagementMetric.current_value.toFixed(1)}/10
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {engagementMetric.current_value > engagementMetric.baseline_value ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm text-green-600">
                          +{(engagementMetric.current_value - engagementMetric.baseline_value).toFixed(1)} points
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Burnout Incidents */}
                {burnoutMetric && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Burnout Incidents</CardDescription>
                      <CardTitle className="text-3xl">
                        {Math.round(burnoutMetric.current_value)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {burnoutMetric.current_value < burnoutMetric.baseline_value ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm text-green-600">
                          -{Math.round(burnoutMetric.baseline_value - burnoutMetric.current_value)} incidents
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* ROI Summary */}
              <Card className="bg-gradient-to-r from-primary/10 to-accent/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Estimated Cost Savings & ROI
                  </CardTitle>
                  <CardDescription>
                    Based on proactive interventions and reduced turnover
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Employees Retained</p>
                      <p className="text-2xl font-bold">
                        {retentionMetric ? Math.round((retentionMetric.current_value - retentionMetric.baseline_value) * 10) : 0}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Est. Turnover Cost Saved</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${retentionMetric ? Math.round((retentionMetric.current_value - retentionMetric.baseline_value) * 10 * 75000).toLocaleString() : 0}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Productivity Gain</p>
                      <p className="text-2xl font-bold text-green-600">
                        {engagementMetric ? `+${((engagementMetric.current_value - engagementMetric.baseline_value) * 10).toFixed(0)}%` : '0%'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Other tabs would have detailed breakdowns */}
            <TabsContent value="retention">
              <Card>
                <CardHeader>
                  <CardTitle>Retention Analysis</CardTitle>
                  <CardDescription>Track how proactive development impacts employee retention</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Detailed retention charts and analysis coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="development">
              <Card>
                <CardHeader>
                  <CardTitle>Development Velocity</CardTitle>
                  <CardDescription>Measure how quickly employees progress through capability levels</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Capability progression analytics coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="engagement">
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Trends</CardTitle>
                  <CardDescription>Monitor employee engagement over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Engagement trend charts coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cost-savings">
              <Card>
                <CardHeader>
                  <CardTitle>Cost Savings Breakdown</CardTitle>
                  <CardDescription>Detailed analysis of ROI and cost savings</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Cost savings calculator coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
