import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, CheckCircle, AlertCircle, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";

type Review = {
  id: string;
  profile_id: string;
  review_date: string;
  review_type: string;
  status: string;
  manager_notes: string | null;
  employee_notes: string | null;
  ai_draft: string | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  overall_rating: number | null;
  manager_completed_at: string | null;
  employee_acknowledged_at: string | null;
  profiles: {
    full_name: string;
    email: string;
  };
};

export function ReviewsTab() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [managerNotes, setManagerNotes] = useState("");
  const [strengths, setStrengths] = useState("");
  const [areasForImprovement, setAreasForImprovement] = useState("");
  const [overallRating, setOverallRating] = useState<number>(3);
  const [generatingAI, setGeneratingAI] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all team members
      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select("employee_id")
        .eq("manager_id", user.id);

      const employeeIds = assignments?.map(a => a.employee_id) || [];

      if (employeeIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get all reviews for team members
      const { data, error } = await supabase
        .from("performance_reviews")
        .select(`
          *,
          profiles!performance_reviews_profile_id_fkey (
            full_name,
            email
          )
        `)
        .in("profile_id", employeeIds)
        .order("review_date", { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading reviews",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReview = (review: Review) => {
    setSelectedReview(review);
    setManagerNotes(review.manager_notes || "");
    setStrengths(review.strengths || "");
    setAreasForImprovement(review.areas_for_improvement || "");
    setOverallRating(review.overall_rating || 3);
  };

  const generateAIDraft = async () => {
    if (!selectedReview) return;
    
    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-performance-review", {
        body: { profileId: selectedReview.profile_id, reviewId: selectedReview.id },
      });

      if (error) throw error;

      if (data?.draft) {
        setManagerNotes(data.draft);
        toast({
          title: "AI Draft Generated",
          description: "Review the AI-generated draft and make any adjustments needed",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error generating draft",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const completeReview = async () => {
    if (!selectedReview) return;

    try {
      const { error } = await supabase
        .from("performance_reviews")
        .update({
          manager_notes: managerNotes,
          strengths,
          areas_for_improvement: areasForImprovement,
          overall_rating: overallRating,
          status: "completed",
          manager_completed_at: new Date().toISOString(),
        })
        .eq("id", selectedReview.id);

      if (error) throw error;

      toast({
        title: "Review Completed",
        description: "Performance review has been saved and shared with the employee",
      });

      setSelectedReview(null);
      loadReviews();
    } catch (error: any) {
      toast({
        title: "Error completing review",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      scheduled: { variant: "secondary", label: "Scheduled" },
      completed: { variant: "default", label: "Completed" },
      acknowledged: { variant: "outline", label: "Acknowledged" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const scheduledReviews = reviews.filter(r => r.status === "scheduled");
  const completedReviews = reviews.filter(r => r.status !== "scheduled");

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading reviews...
        </CardContent>
      </Card>
    );
  }

  if (selectedReview) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Performance Review</CardTitle>
              <CardDescription>
                {selectedReview.profiles.full_name} - {format(new Date(selectedReview.review_date), "MMM d, yyyy")}
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={() => setSelectedReview(null)}>
              Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Manager Notes</label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateAIDraft}
                disabled={generatingAI}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generatingAI ? "Generating..." : "Generate AI Draft"}
              </Button>
            </div>
            <Textarea
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              placeholder="Overall performance assessment..."
              className="min-h-[120px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Strengths</label>
            <Textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="Key strengths demonstrated..."
              className="mt-2 min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Areas for Improvement</label>
            <Textarea
              value={areasForImprovement}
              onChange={(e) => setAreasForImprovement(e.target.value)}
              placeholder="Development opportunities..."
              className="mt-2 min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Overall Rating</label>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  variant={overallRating === rating ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOverallRating(rating)}
                >
                  {rating}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              1 = Needs Improvement, 3 = Meets Expectations, 5 = Exceeds Expectations
            </p>
          </div>

          {selectedReview.employee_notes && (
            <div>
              <label className="text-sm font-medium">Employee Notes</label>
              <div className="mt-2 p-4 bg-muted rounded-lg">
                <p className="text-sm">{selectedReview.employee_notes}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={completeReview} className="flex-1">
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Review
            </Button>
            <Button variant="outline" onClick={() => setSelectedReview(null)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="scheduled" className="space-y-4">
      <TabsList>
        <TabsTrigger value="scheduled">
          Scheduled ({scheduledReviews.length})
        </TabsTrigger>
        <TabsTrigger value="completed">
          Completed ({completedReviews.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="scheduled" className="space-y-4">
        {scheduledReviews.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled reviews</p>
              <p className="text-sm mt-1">Schedule reviews from the team overview</p>
            </CardContent>
          </Card>
        ) : (
          scheduledReviews.map((review) => (
            <Card key={review.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{review.profiles.full_name}</h4>
                      {getStatusBadge(review.status)}
                      <Badge variant="outline">{review.review_type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(review.review_date), "MMM d, yyyy")}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due soon
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => handleSelectReview(review)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Complete Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <TabsContent value="completed" className="space-y-4">
        {completedReviews.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No completed reviews yet</p>
            </CardContent>
          </Card>
        ) : (
          completedReviews.map((review) => (
            <Card key={review.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{review.profiles.full_name}</h4>
                      {getStatusBadge(review.status)}
                      <Badge variant="outline">{review.review_type}</Badge>
                      {review.overall_rating && (
                        <Badge variant="secondary">
                          Rating: {review.overall_rating}/5
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(review.review_date), "MMM d, yyyy")}
                      </div>
                      {review.manager_completed_at && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completed {format(new Date(review.manager_completed_at), "MMM d")}
                        </div>
                      )}
                      {review.employee_acknowledged_at ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Acknowledged
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertCircle className="h-3 w-3" />
                          Pending acknowledgment
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => handleSelectReview(review)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
