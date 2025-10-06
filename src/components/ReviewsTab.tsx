import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, CheckCircle, AlertCircle, FileText, Sparkles, Mic, Upload, Loader2 } from "lucide-react";
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
  const [overallRating, setOverallRating] = useState<number>(5);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    setOverallRating(review.overall_rating || 5);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudioFile(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      
      toast({
        title: "Recording started",
        description: "Click stop when you're done with the review discussion",
      });
    } catch (error: any) {
      toast({
        title: "Recording failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an audio file",
        variant: "destructive",
      });
      return;
    }

    await processAudioFile(file);
  };

  const processAudioFile = async (audioBlob: Blob) => {
    if (!selectedReview) return;

    setTranscribing(true);
    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });

      // Transcribe audio
      toast({
        title: "Transcribing audio...",
        description: "This may take a moment",
      });

      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke(
        "transcribe-audio",
        { body: { audio: base64Audio } }
      );

      if (transcriptionError) throw transcriptionError;

      toast({
        title: "Extracting review content...",
        description: "Jericho is analyzing the conversation",
      });

      // Extract structured content from transcription
      const { data: extractedData, error: extractionError } = await supabase.functions.invoke(
        "extract-review-content",
        { 
          body: { 
            transcription: transcriptionData.text,
            employeeName: selectedReview.profiles.full_name
          } 
        }
      );

      if (extractionError) throw extractionError;

      // Populate form fields
      if (extractedData?.data) {
        setManagerNotes(extractedData.data.manager_notes || "");
        setStrengths(extractedData.data.strengths || "");
        setAreasForImprovement(extractedData.data.areas_for_improvement || "");
        setOverallRating(extractedData.data.overall_rating || 5);

        toast({
          title: "Review content extracted!",
          description: "Review the extracted content and make any adjustments",
        });
      }
    } catch (error: any) {
      console.error("Error processing audio:", error);
      toast({
        title: "Error processing audio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTranscribing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
          {/* Audio Upload Section */}
          <div className="p-4 bg-accent/5 border-2 border-dashed border-accent/20 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">Upload Review Recording</h3>
                <p className="text-xs text-muted-foreground">Record or upload audio to auto-populate review fields</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={transcribing}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={transcribing || recording}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Audio
              </Button>
              <Button
                variant={recording ? "destructive" : "outline"}
                size="sm"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className="flex-1"
              >
                {recording ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Record
                  </>
                )}
              </Button>
            </div>
            {transcribing && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-accent">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing audio and extracting content...</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Manager Notes</label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateAIDraft}
                disabled={generatingAI || transcribing}
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
            <label className="text-sm font-medium">Overall Rating (1-10)</label>
            <div className="grid grid-cols-10 gap-1 mt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                <Button
                  key={rating}
                  variant={overallRating === rating ? "accent" : "outline"}
                  size="sm"
                  onClick={() => setOverallRating(rating)}
                  className="px-2"
                >
                  {rating}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              1-3 = Needs Improvement | 4-6 = Meets Expectations | 7-8 = Exceeds Expectations | 9-10 = Exceptional
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
                          Rating: {review.overall_rating}/10
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
