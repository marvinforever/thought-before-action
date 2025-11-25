import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, AlertCircle, CheckCircle2, Users, UserPlus, UsersRound, X, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useViewAs } from "@/contexts/ViewAsContext";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    employees_with_ids: string[];
    employees_without_ids: string[];
  }>;
  has_discrepancies: boolean;
}

interface PotentialCapability {
  name: string;
  category: string;
  justification: string;
  sample_quotes: string[];
  jd_count: number;
  profile_ids: string[];
}

interface CapabilityIntelligenceProps {
  onCreateCapability: (prefilledData: { 
    name: string; 
    category: string; 
    context: string;
    profileIds?: string[];
  }) => void;
}

export default function CapabilityIntelligence({ onCreateCapability }: CapabilityIntelligenceProps) {
  const [analyzingRoles, setAnalyzingRoles] = useState(false);
  const [roleAnalyses, setRoleAnalyses] = useState<RoleAnalysis[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  
  const [scanningGaps, setScanningGaps] = useState(false);
  const [potentialCapabilities, setPotentialCapabilities] = useState<PotentialCapability[]>([]);
  
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<RoleAnalysis["discrepancies"][0] | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  const handleAnalyzeRoles = async () => {
    setAnalyzingRoles(true);
    try {
      let companyId = viewAsCompanyId;

      // If not viewing as another company, get from user's profile
      if (!companyId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        companyId = profile?.company_id;
      }

      if (!companyId) throw new Error("No company found");

      const { data, error } = await supabase.functions.invoke('analyze-role-consistency', {
        body: { company_id: companyId }
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
      let companyId = viewAsCompanyId;

      // If not viewing as another company, get from user's profile
      if (!companyId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        companyId = profile?.company_id;
      }

      if (!companyId) throw new Error("No company found");

      const { data, error } = await supabase.functions.invoke('discover-capability-gaps', {
        body: { company_id: companyId }
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

  const handleOpenAssignDialog = (discrepancy: RoleAnalysis["discrepancies"][0]) => {
    setSelectedDiscrepancy(discrepancy);
    setSelectedEmployeeIds([]);
    setAssignDialogOpen(true);
  };

  const handleAssignToSelected = async () => {
    if (!selectedDiscrepancy || selectedEmployeeIds.length === 0) return;

    setAssigning(true);
    try {
      const assignments = selectedEmployeeIds.map(profileId => ({
        profile_id: profileId,
        capability_id: selectedDiscrepancy.capability_id,
        current_level: 'foundational' as const,
        target_level: 'advancing' as const,
      }));

      const { error } = await supabase
        .from('employee_capabilities')
        .insert(assignments);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Assigned ${selectedDiscrepancy.capability_name} to ${selectedEmployeeIds.length} employee(s)`
      });

      setAssignDialogOpen(false);
      handleAnalyzeRoles(); // Refresh the analysis
    } catch (error: any) {
      console.error("Error assigning capability:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign capability",
        variant: "destructive"
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignToAll = async (discrepancy: RoleAnalysis["discrepancies"][0]) => {
    if (!discrepancy.employees_without_ids || discrepancy.employees_without_ids.length === 0) return;

    try {
      const assignments = discrepancy.employees_without_ids.map(profileId => ({
        profile_id: profileId,
        capability_id: discrepancy.capability_id,
        current_level: 'foundational' as const,
        target_level: 'advancing' as const,
      }));

      const { error } = await supabase
        .from('employee_capabilities')
        .insert(assignments);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Assigned ${discrepancy.capability_name} to all ${discrepancy.employees_without_ids.length} missing employee(s)`
      });

      await handleAnalyzeRoles(); // Refresh the analysis to remove the discrepancy
    } catch (error: any) {
      console.error("Error assigning capability:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign capability",
        variant: "destructive"
      });
    }
  };

  const handleDismiss = (discrepancy: RoleAnalysis["discrepancies"][0]) => {
    // Remove this discrepancy from the current view
    setRoleAnalyses(prev => 
      prev.map(role => {
        if (role.role_title === selectedRole) {
          return {
            ...role,
            discrepancies: role.discrepancies.filter(d => d.capability_id !== discrepancy.capability_id)
          };
        }
        return role;
      })
    );

    toast({
      title: "Dismissed",
      description: `Removed ${discrepancy.capability_name} from inconsistency list`
    });
  };

  const handleUnassignFromAll = async (discrepancy: RoleAnalysis["discrepancies"][0]) => {
    if (!discrepancy.employees_with_ids || discrepancy.employees_with_ids.length === 0) return;

    try {
      // Get all employee_capabilities records for this capability and these employees
      const { data: existingCapabilities, error: fetchError } = await supabase
        .from('employee_capabilities')
        .select('id')
        .eq('capability_id', discrepancy.capability_id)
        .in('profile_id', discrepancy.employees_with_ids);

      if (fetchError) throw fetchError;

      if (!existingCapabilities || existingCapabilities.length === 0) {
        toast({
          title: "No records found",
          description: "No capability assignments to remove"
        });
        return;
      }

      // Delete the records
      const idsToDelete = existingCapabilities.map(cap => cap.id);
      const { error: deleteError } = await supabase
        .from('employee_capabilities')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;

      toast({
        title: "Success",
        description: `Removed ${discrepancy.capability_name} from all ${discrepancy.employees_with_ids.length} employee(s)`
      });

      await handleAnalyzeRoles(); // Refresh the analysis to remove the discrepancy
    } catch (error: any) {
      console.error("Error unassigning capability:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to unassign capability",
        variant: "destructive"
      });
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
                                
                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenAssignDialog(disc)}
                                    className="flex-1"
                                  >
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    Select & Assign
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAssignToAll(disc)}
                                    className="flex-1"
                                  >
                                    <UsersRound className="h-3 w-3 mr-1" />
                                    Assign to All
                                  </Button>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => handleUnassignFromAll(disc)}
                                        >
                                          <UserMinus className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Unassign from all employees</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDismiss(disc)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
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
                              context: `Justification: ${cap.justification}\n\nSample quotes from job descriptions:\n${cap.sample_quotes.slice(0, 3).map((q, i) => `${i + 1}. "${q}"`).join('\n')}`,
                              profileIds: cap.profile_ids
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

      {/* Select & Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign {selectedDiscrepancy?.capability_name}</DialogTitle>
            <DialogDescription>
              Select which employees should be assigned this capability
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedDiscrepancy?.employees_without_ids?.map((id, idx) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={`employee-${id}`}
                  checked={selectedEmployeeIds.includes(id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedEmployeeIds(prev => [...prev, id]);
                    } else {
                      setSelectedEmployeeIds(prev => prev.filter(eid => eid !== id));
                    }
                  }}
                />
                <label
                  htmlFor={`employee-${id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {selectedDiscrepancy.employees_without_names[idx]}
                </label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignToSelected}
              disabled={selectedEmployeeIds.length === 0 || assigning}
            >
              {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign to {selectedEmployeeIds.length} Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
