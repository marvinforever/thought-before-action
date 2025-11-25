import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RoleAnalysis {
  role_title: string;
  employee_count: number;
  employees: Array<{ profile_id: string; full_name: string; email: string }>;
  total_capabilities: number;
  consistent_capabilities: number;
  consistency_score: number;
  discrepancies: Array<{
    capability_id: string;
    capability_name: string;
    capability_category: string;
    employees_with: number;
    employees_without: number;
    employees_with_names: string[];
    employees_without_names: string[];
  }>;
  has_discrepancies: boolean;
}

interface PotentialCapability {
  name: string;
  category: string;
  justification: string;
  sample_quotes: string[];
  jd_count: number;
}

interface CapabilityIntelligenceProps {
  onCreateCapability: (prefilledData: { name: string; category: string; context: string }) => void;
}

export default function CapabilityIntelligence({ onCreateCapability }: CapabilityIntelligenceProps) {
  const [analyzingRoles, setAnalyzingRoles] = useState(false);
  const [roleAnalyses, setRoleAnalyses] = useState<RoleAnalysis[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  
  const [scanningGaps, setScanningGaps] = useState(false);
  const [potentialCapabilities, setPotentialCapabilities] = useState<PotentialCapability[]>([]);
  
  const { toast } = useToast();

  const handleAnalyzeRoles = async () => {
    setAnalyzingRoles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase.functions.invoke('analyze-role-consistency', {
        body: { company_id: profile.company_id }
      });

      if (error) throw error;

      setRoleAnalyses(data.role_analyses || []);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${data.roles_with_discrepancies} roles with capability inconsistencies`
      });
    } catch (error: any) {
      console.error("Error analyzing roles:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze role consistency",
        variant: "destructive"
      });
    } finally {
      setAnalyzingRoles(false);
    }
  };

  const handleScanForGaps = async () => {
    setScanningGaps(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase.functions.invoke('discover-capability-gaps', {
        body: { company_id: profile.company_id }
      });

      if (error) throw error;

      setPotentialCapabilities(data.potential_capabilities || []);
      
      toast({
        title: "Scan Complete",
        description: `Found ${data.potential_capabilities?.length || 0} potential new capabilities`
      });
    } catch (error: any) {
      console.error("Error scanning for gaps:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to scan for capability gaps",
        variant: "destructive"
      });
    } finally {
      setScanningGaps(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const selectedRoleData = roleAnalyses.find(r => r.role_title === selectedRole);

  return (
    <Tabs defaultValue="consistency" className="space-y-6">
      <TabsList>
        <TabsTrigger value="consistency">Role Consistency</TabsTrigger>
        <TabsTrigger value="gaps">Capability Gap Discovery</TabsTrigger>
      </TabsList>

      {/* Role Consistency Tab */}
      <TabsContent value="consistency" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Role Consistency Analysis
            </CardTitle>
            <CardDescription>
              Compare capabilities across employees with similar job titles to identify inconsistencies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleAnalyzeRoles} 
              disabled={analyzingRoles}
              className="w-full sm:w-auto"
            >
              {analyzingRoles ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Roles...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Analyze Role Consistency
                </>
              )}
            </Button>

            {roleAnalyses.length > 0 && (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Found <strong>{roleAnalyses.filter(r => r.has_discrepancies).length}</strong> roles with capability inconsistencies across <strong>{roleAnalyses.length}</strong> total roles analyzed.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Role to Review</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roleAnalyses.map((role) => (
                        <SelectItem key={role.role_title} value={role.role_title}>
                          {role.role_title} ({role.employee_count} employees) - {role.consistency_score}% consistent
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRoleData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{selectedRoleData.role_title}</span>
                        <Badge variant={selectedRoleData.consistency_score >= 80 ? "default" : "destructive"}>
                          {selectedRoleData.consistency_score}% Consistent
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {selectedRoleData.employee_count} employees • {selectedRoleData.total_capabilities} total capabilities
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="font-medium">Consistent</span>
                          </div>
                          <p className="text-2xl font-bold">{selectedRoleData.consistent_capabilities}</p>
                          <p className="text-sm text-muted-foreground">All employees have these</p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <span className="font-medium">Inconsistent</span>
                          </div>
                          <p className="text-2xl font-bold">{selectedRoleData.discrepancies.length}</p>
                          <p className="text-sm text-muted-foreground">Partially assigned</p>
                        </div>
                      </div>

                      {selectedRoleData.discrepancies.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Capability Discrepancies</h4>
                          <div className="space-y-2">
                            {selectedRoleData.discrepancies.map((disc, idx) => (
                              <div key={idx} className="p-3 border rounded-lg space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{disc.capability_name}</p>
                                    <p className="text-sm text-muted-foreground">{disc.capability_category}</p>
                                  </div>
                                  <Badge variant="outline">
                                    {disc.employees_with}/{selectedRoleData.employee_count}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <p className="font-medium text-green-700 mb-1">Has Capability:</p>
                                    <ul className="list-disc list-inside text-muted-foreground">
                                      {disc.employees_with_names.map((name, i) => (
                                        <li key={i}>{name}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="font-medium text-red-700 mb-1">Missing:</p>
                                    <ul className="list-disc list-inside text-muted-foreground">
                                      {disc.employees_without_names.map((name, i) => (
                                        <li key={i}>{name}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Capability Gap Discovery Tab */}
      <TabsContent value="gaps" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Capability Gap Discovery
            </CardTitle>
            <CardDescription>
              Analyze job descriptions to find skills that aren't covered by existing capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleScanForGaps} 
              disabled={scanningGaps}
              className="w-full sm:w-auto"
            >
              {scanningGaps ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning Job Descriptions...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Scan for Capability Gaps
                </>
              )}
            </Button>

            {potentialCapabilities.length > 0 && (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Found <strong>{potentialCapabilities.length}</strong> potential new capabilities in your job descriptions
                  </AlertDescription>
                </Alert>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Capability Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Mentioned In</TableHead>
                      <TableHead>Justification</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {potentialCapabilities.map((cap, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{cap.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{cap.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{cap.jd_count} JDs</Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {cap.justification}
                          </p>
                          {cap.sample_quotes.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer text-primary">
                                View sample quotes
                              </summary>
                              <ul className="mt-1 space-y-1">
                                {cap.sample_quotes.slice(0, 2).map((quote, i) => (
                                  <li key={i} className="text-xs text-muted-foreground italic">
                                    "{quote.substring(0, 100)}..."
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCreateCapability({
                              name: cap.name,
                              category: cap.category,
                              context: `Justification: ${cap.justification}\n\nSample quotes from job descriptions:\n${cap.sample_quotes.slice(0, 3).map((q, i) => `${i + 1}. "${q}"`).join('\n')}`
                            })}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!scanningGaps && potentialCapabilities.length === 0 && (
              <Alert>
                <AlertDescription>
                  No results yet. Click "Scan for Capability Gaps" to analyze your job descriptions.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
