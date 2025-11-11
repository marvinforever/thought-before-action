import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Rocket, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DemoSetupResult {
  success: boolean;
  demo_company_id: string;
  demo_company_name: string;
  employees_created: number;
  employees: Array<{ name: string; email: string; role: string }>;
  demo_managers: Array<{ email: string; password: string }>;
  strategic_report_id: string;
  cohorts_created: number;
  message: string;
}

export default function SuperAdminDemo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoSetupResult | null>(null);

  const handleSetupDemo = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Not authenticated");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke('setup-demo-company', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      setResult(data as DemoSetupResult);
      toast.success("Demo company created successfully!");
    } catch (error: any) {
      console.error('Error setting up demo:', error);
      toast.error(error.message || "Failed to create demo company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/super-admin')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Super Admin
        </Button>
        <h1 className="text-3xl font-bold mb-2">Demo Company Setup</h1>
        <p className="text-muted-foreground">
          Create a fully populated demo company for tire-kicking users
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Setup New Demo Company</CardTitle>
          <CardDescription>
            This will create a demo company with 10 fake employees, fully populated growth plans,
            strategic learning design report, and demo manager accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSetupDemo}
            disabled={loading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Demo Company...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-5 w-5" />
                Create Demo Company
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6">
          <Alert>
            <AlertDescription className="text-lg font-semibold">
              {result.message}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Demo Company Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company Name</p>
                  <p className="font-semibold">{result.demo_company_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company ID</p>
                  <p className="font-mono text-sm">{result.demo_company_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employees Created</p>
                  <p className="font-semibold">{result.employees_created}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Training Cohorts</p>
                  <p className="font-semibold">{result.cohorts_created}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demo Manager Accounts</CardTitle>
              <CardDescription>
                Use these credentials to log in with manager-level access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.demo_managers.map((manager, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-mono text-sm">{manager.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Password</p>
                        <p className="font-mono text-sm">{manager.password}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demo Employees ({result.employees.length})</CardTitle>
              <CardDescription>
                All employees have fully populated growth plans and diagnostic data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.employees.map((emp, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <p className="font-semibold">{emp.name}</p>
                    <p className="text-sm text-muted-foreground">{emp.role}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">{emp.email}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What's Included</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Personal vision and 3-year goals for each employee</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>90-day targets (professional, personal, company goals)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Active habits with streak tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>8-12 capabilities per employee with AI reasoning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Recent achievements and diagnostic responses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Complete Strategic Learning Design Report</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>5 training cohorts with budget scenarios and ROI projections</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Manager assignments for full team visibility</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
