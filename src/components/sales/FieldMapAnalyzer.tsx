import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Map, 
  Loader2, 
  Sparkles, 
  Target, 
  MessageSquare, 
  Lightbulb,
  X,
  Image as ImageIcon,
  Trash2
} from "lucide-react";
import { format } from "date-fns";

interface FieldMapAnalyzerProps {
  customerId: string;
  customerName: string;
  companyId: string;
  customerContext?: {
    name?: string;
    location?: string;
    operationDetails?: any;
    crops?: string;
    totalAcres?: string;
  };
  onAnalysisComplete?: () => void;
}

interface Analysis {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  map_type: string | null;
  field_name: string | null;
  key_insights: string | null;
  sales_opportunities: string[] | null;
  analysis_result: any;
  created_at: string;
}

const MAP_TYPES = [
  { value: "yield_map", label: "Yield Map" },
  { value: "soil_map", label: "Soil Map" },
  { value: "satellite", label: "Satellite Imagery" },
  { value: "planting_map", label: "Planting Map" },
  { value: "application_map", label: "Application Map" },
  { value: "drainage_map", label: "Drainage/Tile Map" },
  { value: "other", label: "Other" },
];

export const FieldMapAnalyzer = ({ 
  customerId, 
  customerName, 
  companyId, 
  customerContext,
  onAnalysisComplete 
}: FieldMapAnalyzerProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mapType, setMapType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load existing analyses on mount
  useState(() => {
    loadAnalyses();
  });

  const loadAnalyses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('field_map_analyses')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (data) {
      setAnalyses(data);
    }
    if (error) {
      console.error('Error loading analyses:', error);
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PNG, JPG, WebP, or PDF file.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const analyzeMap = async () => {
    if (!selectedFile) return;

    setAnalyzing(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(selectedFile);
      const imageBase64 = await base64Promise;

      // Upload file to storage first
      const filePath = `${companyId}/${customerId}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('field-maps')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('field-maps')
        .getPublicUrl(filePath);

      // Call the analysis edge function
      const { data, error } = await supabase.functions.invoke('analyze-field-map', {
        body: {
          imageBase64,
          imageType: selectedFile.type,
          mapType,
          fieldName,
          customerContext,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Analysis failed');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Save analysis to database
      const { error: saveError } = await supabase
        .from('field_map_analyses')
        .insert({
          company_id: companyId,
          customer_id: customerId,
          profile_id: user?.id,
          file_url: urlData.publicUrl,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          map_type: mapType || null,
          field_name: fieldName || null,
          analysis_result: data.structured,
          sales_opportunities: data.opportunities,
          key_insights: data.analysis,
          raw_ai_response: data.analysis,
        });

      if (saveError) throw saveError;

      toast({
        title: "Analysis Complete! 🌾",
        description: "Field map analyzed successfully. Check out the sales opportunities!",
      });

      // Reset form and reload
      setSelectedFile(null);
      setPreviewUrl(null);
      setMapType("");
      setFieldName("");
      loadAnalyses();
      onAnalysisComplete?.();

    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze the field map. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const deleteAnalysis = async (id: string, fileUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/field-maps/');
      if (urlParts[1]) {
        await supabase.storage.from('field-maps').remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('field_map_analyses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Analysis deleted" });
      loadAnalyses();
      if (selectedAnalysis?.id === id) {
        setSelectedAnalysis(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* File Input */}
            <div 
              className="flex flex-col items-center justify-center p-6 cursor-pointer rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              {previewUrl ? (
                <div className="relative">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-h-48 rounded-lg object-contain"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : selectedFile ? (
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-8 w-8 text-primary" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Upload Field Map</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WebP, or PDF (max 10MB)
                  </p>
                </>
              )}
            </div>

            {/* Map Details */}
            {selectedFile && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="mapType" className="text-xs">Map Type</Label>
                  <Select value={mapType} onValueChange={setMapType}>
                    <SelectTrigger id="mapType" className="h-9">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MAP_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fieldName" className="text-xs">Field Name (optional)</Label>
                  <Input
                    id="fieldName"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="e.g., North 40"
                    className="h-9"
                  />
                </div>
              </div>
            )}

            {/* Analyze Button */}
            {selectedFile && (
              <Button
                onClick={analyzeMap}
                disabled={analyzing}
                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Field Map...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze for Sales Opportunities
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Previous Analyses */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : analyses.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Map className="h-4 w-4" />
            Previous Analyses ({analyses.length})
          </h4>
          
          <div className="grid gap-3">
            {analyses.map((analysis) => (
              <Card 
                key={analysis.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedAnalysis?.id === analysis.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedAnalysis(
                  selectedAnalysis?.id === analysis.id ? null : analysis
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                      {analysis.file_url && !analysis.file_type?.includes('pdf') ? (
                        <img 
                          src={analysis.file_url} 
                          alt={analysis.file_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Map className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm truncate">
                            {analysis.field_name || analysis.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(analysis.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnalysis(analysis.id, analysis.file_url);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Tags */}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {analysis.map_type && (
                          <Badge variant="secondary" className="text-xs py-0">
                            {MAP_TYPES.find(t => t.value === analysis.map_type)?.label || analysis.map_type}
                          </Badge>
                        )}
                        {analysis.sales_opportunities && analysis.sales_opportunities.length > 0 && (
                          <Badge className="text-xs py-0 bg-green-500/20 text-green-700">
                            {analysis.sales_opportunities.length} opportunities
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Analysis */}
                  {selectedAnalysis?.id === analysis.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Sales Opportunities */}
                      {analysis.sales_opportunities && analysis.sales_opportunities.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold flex items-center gap-1 mb-2 text-green-600">
                            <Target className="h-3 w-3" />
                            SALES OPPORTUNITIES
                          </h5>
                          <ul className="space-y-1">
                            {analysis.sales_opportunities.map((opp, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>{opp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Full Analysis */}
                      {analysis.key_insights && (
                        <div>
                          <h5 className="text-xs font-semibold flex items-center gap-1 mb-2">
                            <Lightbulb className="h-3 w-3" />
                            FULL ANALYSIS
                          </h5>
                          <ScrollArea className="h-48 rounded-lg bg-muted/50 p-3">
                            <div className="text-sm whitespace-pre-wrap prose prose-sm max-w-none">
                              {analysis.key_insights}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {/* Use in Chat */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Copy talking points to clipboard
                          const talkingPoints = analysis.sales_opportunities?.join('\n• ') || '';
                          navigator.clipboard.writeText(`Field Map Insights for ${customerName}:\n• ${talkingPoints}`);
                          toast({
                            title: "Copied to clipboard!",
                            description: "Paste these talking points into your conversation.",
                          });
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Copy Talking Points
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Map className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No field maps analyzed yet</p>
          <p className="text-xs mt-1">Upload a yield map, soil map, or satellite image to identify sales opportunities</p>
        </div>
      )}
    </div>
  );
};
