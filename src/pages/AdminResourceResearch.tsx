import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, CheckCircle2, AlertCircle, BookOpen, Video, Mic, GraduationCap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Capability {
  id: string;
  name: string;
  description: string;
  resource_count?: number;
}

interface ResearchedResource {
  title: string;
  description: string;
  url: string;
  content_type: 'book' | 'video' | 'podcast' | 'course';
  author_or_creator?: string;
  capability_name: string;
  capability_level?: string;
  duration_minutes?: number;
  url_valid?: boolean;
}

interface ResearchResult {
  capability_id: string;
  capability_name: string;
  resources: ResearchedResource[];
  stats: {
    total: number;
    valid_urls: number;
    invalid_urls: number;
    by_type: Record<string, number>;
  };
}

export default function AdminResourceResearch() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCapability, setCurrentCapability] = useState("");
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCapabilities();
  }, []);

  const fetchCapabilities = async () => {
    const { data: caps, error } = await supabase
      .from('capabilities')
      .select('id, name, description')
      .order('name');

    if (error) {
      toast({ title: "Error loading capabilities", variant: "destructive" });
      return;
    }

    // Get resource counts
    const { data: resourceCounts } = await supabase
      .from('resource_capabilities')
      .select('capability_id');

    const countMap = new Map<string, number>();
    resourceCounts?.forEach((rc) => {
      countMap.set(rc.capability_id, (countMap.get(rc.capability_id) || 0) + 1);
    });

    const capsWithCounts = caps?.map((c) => ({
      ...c,
      resource_count: countMap.get(c.id) || 0
    })) || [];

    setCapabilities(capsWithCounts);
  };

  const filteredCapabilities = capabilities.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredCapabilities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCapabilities.map((c) => c.id)));
    }
  };

  const researchSelected = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "No capabilities selected", variant: "destructive" });
      return;
    }

    setIsResearching(true);
    setProgress(0);
    setResults([]);

    const selected = capabilities.filter((c) => selectedIds.has(c.id));
    const total = selected.length;
    const newResults: ResearchResult[] = [];

    for (let i = 0; i < selected.length; i++) {
      const cap = selected[i];
      setCurrentCapability(cap.name);
      setProgress(((i + 1) / total) * 100);

      try {
        const { data, error } = await supabase.functions.invoke('research-capability-resources', {
          body: {
            capability_id: cap.id,
            capability_name: cap.name,
            description: cap.description
          }
        });

        if (error) throw error;

        newResults.push(data);
        setResults([...newResults]);

        toast({
          title: `✓ ${cap.name}`,
          description: `Found ${data.resources.length} resources (${data.stats.valid_urls} verified)`
        });

      } catch (error) {
        console.error('Research error:', error);
        toast({
          title: `Error researching ${cap.name}`,
          description: error.message,
          variant: "destructive"
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsResearching(false);
    setCurrentCapability("");
  };

  const importResults = async () => {
    setIsImporting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "User not found", variant: "destructive" });
      setIsImporting(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      toast({ title: "Company not found", variant: "destructive" });
      setIsImporting(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const result of results) {
      for (const resource of result.resources) {
        // Skip invalid URLs if desired
        if (!resource.url_valid) {
          console.log(`Skipping invalid URL: ${resource.url}`);
          continue;
        }

        try {
          // Insert resource
          const { data: insertedResource, error: resourceError } = await supabase
            .from('resources')
            .insert({
              title: resource.title,
              description: resource.description,
              url: resource.url,
              content_type: resource.content_type,
              company_id: profile.company_id,
              estimated_time_minutes: resource.duration_minutes
            })
            .select()
            .single();

          if (resourceError) throw resourceError;

          // Link to capability
          const { error: linkError } = await supabase
            .from('resource_capabilities')
            .insert({
              resource_id: insertedResource.id,
              capability_id: result.capability_id
            });

          if (linkError) throw linkError;

          successCount++;
        } catch (error) {
          console.error('Import error:', error);
          errorCount++;
        }
      }
    }

    setIsImporting(false);
    toast({
      title: "Import complete",
      description: `${successCount} resources imported, ${errorCount} errors`
    });

    if (successCount > 0) {
      navigate('/resources');
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'book': return <BookOpen className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'podcast': return <Mic className="h-4 w-4" />;
      case 'course': return <GraduationCap className="h-4 w-4" />;
      default: return null;
    }
  };

  const totalResources = results.reduce((sum, r) => sum + r.resources.length, 0);
  const validResources = results.reduce((sum, r) => sum + r.stats.valid_urls, 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Resource Research Assistant</h1>
        <p className="text-muted-foreground mt-2">
          Let Jericho research and populate your resource library automatically
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Capability Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Select Capabilities</CardTitle>
              <CardDescription>
                {selectedIds.size} of {capabilities.length} selected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search capabilities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={selectAll} variant="outline" size="sm" className="flex-1">
                  {selectedIds.size === filteredCapabilities.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  onClick={researchSelected}
                  disabled={selectedIds.size === 0 || isResearching}
                  size="sm"
                  className="flex-1"
                >
                  {isResearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Researching...
                    </>
                  ) : (
                    `Research (${selectedIds.size})`
                  )}
                </Button>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredCapabilities.map((cap) => (
                    <div
                      key={cap.id}
                      className="flex items-start space-x-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => toggleSelection(cap.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(cap.id)}
                        onCheckedChange={() => toggleSelection(cap.id)}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="font-medium text-sm">{cap.name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {cap.resource_count || 0} resources
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right Column: Progress & Results */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Research Progress & Results</CardTitle>
              <CardDescription>
                {results.length > 0 && (
                  <span>
                    Found {totalResources} resources ({validResources} verified URLs)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isResearching && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Researching: {currentCapability}
                    </span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {results.length > 0 && (
                <>
                  <div className="flex justify-end">
                    <Button
                      onClick={importResults}
                      disabled={isImporting}
                      size="lg"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        `Import ${validResources} Resources`
                      )}
                    </Button>
                  </div>

                  <ScrollArea className="h-[600px]">
                    <div className="space-y-6">
                      {results.map((result) => (
                        <div key={result.capability_id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{result.capability_name}</h3>
                            <Badge>
                              {result.stats.valid_urls}/{result.stats.total} valid
                            </Badge>
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Creator</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="w-20">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.resources.map((resource, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>
                                    {resource.url_valid ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-amber-600" />
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <a
                                      href={resource.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:underline"
                                    >
                                      {resource.title}
                                    </a>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {resource.author_or_creator}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {getContentIcon(resource.content_type)}
                                      <span className="text-sm capitalize">
                                        {resource.content_type}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={resource.url_valid ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {resource.url_valid ? 'Valid' : 'Check'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}

              {!isResearching && results.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select capabilities and click "Research" to begin</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
