import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, User, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  company_id: string;
  is_admin: boolean;
  role: string | null;
}

interface DataAccessResult {
  table: string;
  description: string;
  count: number;
  status: "success" | "empty" | "error";
  error?: string;
  sampleData?: unknown[];
}

interface AdminUserDebugPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = supabase as any;

// Helper to safely query tables - bypasses complex type inference
async function safeQuery(
  tableName: string, 
  selectFields: string, 
  filterColumn: string, 
  filterValue: string,
  limit = 5
): Promise<{ data: unknown[] | null; error: string | null }> {
  try {
    const result = await client
      .from(tableName)
      .select(selectFields)
      .eq(filterColumn, filterValue)
      .limit(limit);
    
    return { data: result.data, error: result.error?.message || null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export function AdminUserDebugPanel({ open, onOpenChange }: AdminUserDebugPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugging, setDebugging] = useState(false);
  const [results, setResults] = useState<DataAccessResult[]>([]);
  const [managerInfo, setManagerInfo] = useState<{ isManager: boolean; directReports: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await client
        .from("profiles")
        .select("id, full_name, email, company_id, is_admin, role")
        .eq("is_active", true)
        .order("full_name");

      if (result.error) throw result.error;
      setUsers(result.data || []);
    } catch (error: unknown) {
      const err = error as { message: string };
      toast({
        title: "Error loading users",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const debugUserDataAccess = async (user: UserProfile) => {
    setSelectedUser(user);
    setDebugging(true);
    setResults([]);

    const accessResults: DataAccessResult[] = [];

    try {
      // Check if user is a manager
      const managerResult = await safeQuery("manager_assignments", "id", "manager_id", user.id, 100);
      const isManager = !managerResult.error && (managerResult.data?.length || 0) > 0;
      setManagerInfo({ 
        isManager, 
        directReports: managerResult.data?.length || 0 
      });

      // 1. Check goals
      const goalsResult = await safeQuery("goals", "id, title", "profile_id", user.id);
      accessResults.push({
        table: "goals",
        description: "Personal growth goals",
        count: goalsResult.error ? 0 : (goalsResult.data?.length || 0),
        status: goalsResult.error ? "error" : (goalsResult.data?.length ? "success" : "empty"),
        error: goalsResult.error || undefined,
        sampleData: goalsResult.data?.slice(0, 2)
      });

      // 2. Check employee capabilities
      const capsResult = await safeQuery("employee_capabilities", "id, capability_id, current_level", "profile_id", user.id);
      accessResults.push({
        table: "employee_capabilities",
        description: "Assigned capabilities",
        count: capsResult.error ? 0 : (capsResult.data?.length || 0),
        status: capsResult.error ? "error" : (capsResult.data?.length ? "success" : "empty"),
        error: capsResult.error || undefined
      });

      // 3. Check recognition received
      const recResult = await safeQuery("recognition_notes", "id, title", "given_to", user.id);
      accessResults.push({
        table: "recognition_notes (received)",
        description: "Recognition received",
        count: recResult.error ? 0 : (recResult.data?.length || 0),
        status: recResult.error ? "error" : (recResult.data?.length ? "success" : "empty"),
        error: recResult.error || undefined
      });

      // 4. Check diagnostic responses
      const diagResult = await safeQuery("diagnostic_responses", "id, submitted_at", "profile_id", user.id);
      accessResults.push({
        table: "diagnostic_responses",
        description: "Diagnostic survey responses",
        count: diagResult.error ? 0 : (diagResult.data?.length || 0),
        status: diagResult.error ? "error" : (diagResult.data?.length ? "success" : "empty"),
        error: diagResult.error || undefined
      });

      // 5. Check conversations (Jericho chats)
      const convResult = await safeQuery("conversations", "id, title, created_at", "profile_id", user.id);
      accessResults.push({
        table: "conversations",
        description: "Jericho chat conversations",
        count: convResult.error ? 0 : (convResult.data?.length || 0),
        status: convResult.error ? "error" : (convResult.data?.length ? "success" : "empty"),
        error: convResult.error || undefined
      });

      // Manager-specific checks
      if (isManager) {
        // 6. Check 1:1 notes as manager
        const oooResult = await safeQuery("one_on_one_notes", "id, meeting_date, employee_id", "manager_id", user.id, 10);
        accessResults.push({
          table: "one_on_one_notes (as manager)",
          description: "1:1 meeting notes created",
          count: oooResult.error ? 0 : (oooResult.data?.length || 0),
          status: oooResult.error ? "error" : (oooResult.data?.length ? "success" : "empty"),
          error: oooResult.error || undefined,
          sampleData: oooResult.data?.slice(0, 3)
        });

        // 7. Check performance reviews assigned
        const revResult = await safeQuery("performance_reviews", "id, status, employee_id", "manager_id", user.id);
        accessResults.push({
          table: "performance_reviews (assigned)",
          description: "Performance reviews to complete",
          count: revResult.error ? 0 : (revResult.data?.length || 0),
          status: revResult.error ? "error" : (revResult.data?.length ? "success" : "empty"),
          error: revResult.error || undefined
        });

        // 8. Check capability level requests to review
        const reqResult = await safeQuery("capability_level_requests", "id, status", "company_id", user.company_id);
        accessResults.push({
          table: "capability_level_requests",
          description: "Pending capability requests in company",
          count: reqResult.error ? 0 : (reqResult.data?.length || 0),
          status: reqResult.error ? "error" : (reqResult.data?.length ? "success" : "empty"),
          error: reqResult.error || undefined
        });
      }

      // Check as employee for 1:1 notes
      const myOooResult = await safeQuery("one_on_one_notes", "id, meeting_date", "employee_id", user.id);
      accessResults.push({
        table: "one_on_one_notes (as employee)",
        description: "1:1 notes about this user",
        count: myOooResult.error ? 0 : (myOooResult.data?.length || 0),
        status: myOooResult.error ? "error" : (myOooResult.data?.length ? "success" : "empty"),
        error: myOooResult.error || undefined
      });

      setResults(accessResults);
    } catch (error: unknown) {
      const err = error as { message: string };
      toast({
        title: "Error debugging user",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDebugging(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: DataAccessResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "empty":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            User Data Access Debugger
          </DialogTitle>
          <DialogDescription>
            Select a user to see what data they can access. Helps diagnose "I can't see my data" issues.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* User List */}
          <div className="w-1/3 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="flex-1 border rounded-md">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => debugUserDataAccess(user)}
                      className={`w-full text-left p-2 rounded-md hover:bg-muted transition-colors ${
                        selectedUser?.id === user.id ? "bg-muted border border-primary" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        {user.is_admin && (
                          <Badge variant="secondary" className="text-xs">Admin</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Results Panel */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedUser ? (
              <>
                <Card className="mb-3">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{selectedUser.full_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                      </div>
                      <div className="flex gap-2">
                        {selectedUser.role && (
                          <Badge variant="outline">{selectedUser.role}</Badge>
                        )}
                        {managerInfo?.isManager && (
                          <Badge className="bg-primary">
                            <Users className="h-3 w-3 mr-1" />
                            Manager ({managerInfo.directReports})
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <ScrollArea className="flex-1">
                  {debugging ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Checking data access...</span>
                    </div>
                  ) : results.length > 0 ? (
                    <div className="space-y-2 pr-3">
                      {results.map((result, idx) => (
                        <Card key={idx} className={result.status === "error" ? "border-destructive" : ""}>
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2">
                                {getStatusIcon(result.status)}
                                <div>
                                  <p className="text-sm font-medium">{result.table}</p>
                                  <p className="text-xs text-muted-foreground">{result.description}</p>
                                  {result.error && (
                                    <p className="text-xs text-destructive mt-1">{result.error}</p>
                                  )}
                                  {result.sampleData && result.sampleData.length > 0 && (
                                    <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-x-auto">
                                      {JSON.stringify(result.sampleData, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                              <Badge variant={result.count > 0 ? "default" : "secondary"}>
                                {result.count} records
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      <Separator className="my-4" />
                      
                      <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
                        <p className="font-medium mb-1">Debugging Tips:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li><span className="text-amber-500">⚠️ Empty</span> = No data exists for this user</li>
                          <li><span className="text-destructive">⚠️ Error</span> = RLS policy may be blocking access</li>
                          <li>Manager-only tables only show if user has direct reports</li>
                          <li>Check if user's auth.uid matches their profile.id</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      Click a user to check their data access
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a user from the list to debug their data access</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
