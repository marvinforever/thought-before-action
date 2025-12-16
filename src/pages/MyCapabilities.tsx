import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, Loader2 } from "lucide-react";
import InteractiveCapabilityCard from "@/components/InteractiveCapabilityCard";
import { RequestCapabilityLevelDialog } from "@/components/RequestCapabilityLevelDialog";
import { SelfAssessCapabilitiesDialog } from "@/components/SelfAssessCapabilitiesDialog";
import { CapabilityMasteryMeter } from "@/components/CapabilityMasteryMeter";
import { useViewAs } from "@/contexts/ViewAsContext";

type EmployeeCapability = {
  id: string;
  current_level: string;
  target_level: string;
  priority: number;
  ai_reasoning: string | null;
  capability: {
    id: string;
    name: string;
    category: string;
    description: string;
  };
  level_descriptions?: Array<{
    level: string;
    description: string;
  }>;
};

export default function MyCapabilities() {
  const [capabilities, setCapabilities] = useState<EmployeeCapability[]>([]);
  const [capabilityResources, setCapabilityResources] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<EmployeeCapability | null>(null);
  const [selfAssessDialogOpen, setSelfAssessDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const { toast } = useToast();
  const { viewAsCompanyId } = useViewAs();

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    loadCapabilities();
    loadCapabilityResources();
  }, [viewAsCompanyId]);

  const loadCapabilities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let targetUserId = user.id;
      
      if (viewAsCompanyId) {
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", viewAsCompanyId)
          .eq("is_admin", true)
          .limit(1)
          .single();
        
        if (adminProfile) {
          targetUserId = adminProfile.id;
        }
      }

      const { data, error } = await supabase
        .from("employee_capabilities")
        .select(`
          id,
          capability_id,
          current_level,
          target_level,
          priority,
          ai_reasoning,
          capability:capabilities(
            id,
            name,
            category,
            description
          )
        `)
        .eq("profile_id", targetUserId)
        .order("priority", { ascending: true });

      if (error) throw error;

      const capabilityIds = data?.map((ec: any) => ec.capability_id) || [];
      const { data: levelData, error: levelError } = await supabase
        .from("capability_levels")
        .select("capability_id, level, description")
        .in("capability_id", capabilityIds);

      if (levelError) {
        console.error("Error loading level descriptions:", levelError);
      }

      const levelsByCapability = new Map<string, any[]>();
      levelData?.forEach((level: any) => {
        if (!levelsByCapability.has(level.capability_id)) {
          levelsByCapability.set(level.capability_id, []);
        }
        levelsByCapability.get(level.capability_id)?.push({
          level: level.level,
          description: level.description
        });
      });

      const formattedData = (data as any[])?.map((ec: any) => ({
        ...ec,
        level_descriptions: levelsByCapability.get(ec.capability_id) || []
      })) || [];

      setCapabilities(formattedData);
    } catch (error: any) {
      console.error("Error loading capabilities:", error);
      toast({
        title: "Error loading capabilities",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCapabilityResources = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let targetUserId = user.id;
      
      if (viewAsCompanyId) {
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", viewAsCompanyId)
          .eq("is_admin", true)
          .limit(1)
          .single();
        
        if (adminProfile) {
          targetUserId = adminProfile.id;
        }
      }

      const { data: empCaps } = await supabase
        .from("employee_capabilities")
        .select("id, capability_id")
        .eq("profile_id", targetUserId);

      if (!empCaps) return;

      const { data: recommendations } = await supabase
        .from("content_recommendations")
        .select(`
          employee_capability_id,
          expires_at,
          resource:resources(
            id,
            title,
            description,
            content_type,
            external_url,
            rating,
            capability_level
          )
        `)
        .eq("profile_id", targetUserId)
        .gt("expires_at", new Date().toISOString())
        .in("employee_capability_id", empCaps.map(c => c.id));

      if (!recommendations) return;

      const grouped: Record<string, any[]> = {};
      empCaps.forEach(empCap => {
        const capResources = recommendations
          .filter(r => r.employee_capability_id === empCap.id)
          .map(r => r.resource)
          .filter(Boolean)
          .slice(0, 3);
        if (empCap.capability_id) {
          grouped[empCap.capability_id] = capResources;
        }
      });

      setCapabilityResources(grouped);
    } catch (error) {
      console.error("Error loading capability resources:", error);
    }
  };

  const handleRequestLevelChange = (capabilityId: string) => {
    const cap = capabilities.find(c => c.id === capabilityId);
    if (cap) {
      setSelectedCapability(cap);
      setRequestDialogOpen(true);
    }
  };

  const handleResourceClick = async (resourceId: string) => {
    console.log("Resource clicked:", resourceId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-primary p-8 text-primary-foreground shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full -ml-24 -mb-24" />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">My Capabilities</h1>
          <p className="text-primary-foreground/90 text-lg">
            Track your skills and professional development progress
          </p>
        </div>
      </div>

      {/* Capability Mastery Meter */}
      {capabilities.length > 0 && <CapabilityMasteryMeter capabilities={capabilities} />}

      {capabilities.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  My Capabilities
                </CardTitle>
                <CardDescription>
                  Focus areas for your professional development
                </CardDescription>
              </div>
              <Button
                onClick={() => setSelfAssessDialogOpen(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Self-Assess
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {capabilities.map((cap) => (
                <InteractiveCapabilityCard
                  key={cap.id}
                  id={cap.id}
                  name={cap.capability.name}
                  category={cap.capability.category}
                  description={cap.capability.description}
                  currentLevel={cap.current_level}
                  targetLevel={cap.target_level}
                  aiReasoning={cap.ai_reasoning}
                  resources={capabilityResources[cap.capability.id] || []}
                  levelDescriptions={cap.level_descriptions || []}
                  onRequestLevelChange={handleRequestLevelChange}
                  onResourceClick={handleResourceClick}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No capabilities assigned yet. Your manager will assign capabilities based on your role.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Request Capability Level Dialog */}
      {selectedCapability && (
        <RequestCapabilityLevelDialog
          open={requestDialogOpen}
          onOpenChange={setRequestDialogOpen}
          employeeCapability={{
            id: selectedCapability.id,
            capability_id: selectedCapability.capability.id,
            current_level: selectedCapability.current_level,
            capability_name: selectedCapability.capability.name,
          }}
        />
      )}

      {/* Self-Assess Capabilities Dialog */}
      <SelfAssessCapabilitiesDialog
        open={selfAssessDialogOpen}
        onOpenChange={setSelfAssessDialogOpen}
        profileId={currentUserId}
      />
    </div>
  );
}
