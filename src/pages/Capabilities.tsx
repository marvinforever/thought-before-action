import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import CreateCapabilityDialog from "@/components/CreateCapabilityDialog";
import CapabilityIntelligence from "@/components/CapabilityIntelligence";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Capability = Tables<"capabilities">;
type CapabilityLevel = Tables<"capability_levels">;

interface CapabilityWithLevels extends Capability {
  levels: CapabilityLevel[];
}

const Capabilities = () => {
  const [capabilities, setCapabilities] = useState<CapabilityWithLevels[]>([]);
  const [customCapabilities, setCustomCapabilities] = useState<CapabilityWithLevels[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCapability, setEditingCapability] = useState<CapabilityWithLevels | null>(null);
  const [deletingCapability, setDeletingCapability] = useState<CapabilityWithLevels | null>(null);
  const [prefilledData, setPrefilledData] = useState<{ name: string; category: string; context: string } | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    checkUserRole();
    loadCapabilities();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasManagerRole = roles?.some(r => 
        r.role === 'manager' || r.role === 'admin' || r.role === 'super_admin'
      );
      setIsManager(!!hasManagerRole);
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  const loadCapabilities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      // Load standard capabilities (not custom)
      const { data: standardCaps, error: standardError } = await supabase
        .from("capabilities")
        .select("*")
        .or("is_custom.is.null,is_custom.eq.false")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (standardError) throw standardError;

      // Load custom capabilities for this company
      const { data: customCaps, error: customError } = await supabase
        .from("capabilities")
        .select("*")
        .eq("is_custom", true)
        .eq("created_by_company_id", profile?.company_id)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (customError) throw customError;

      // Load all capability levels
      const { data: levelsData, error: levelsError } = await supabase
        .from("capability_levels")
        .select("*")
        .order("created_at", { ascending: true });

      if (levelsError) throw levelsError;

      // Combine capabilities with their levels
      const standardWithLevels = (standardCaps || []).map(cap => ({
        ...cap,
        levels: (levelsData || []).filter(level => level.capability_id === cap.id)
      }));

      const customWithLevels = (customCaps || []).map(cap => ({
        ...cap,
        levels: (levelsData || []).filter(level => level.capability_id === cap.id)
      }));

      setCapabilities(standardWithLevels);
      setCustomCapabilities(customWithLevels);
    } catch (error) {
      console.error("Error loading capabilities:", error);
      toast({
        title: "Error",
        description: "Failed to load capabilities",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCapability = async (capability: CapabilityWithLevels) => {
    try {
      const { error } = await supabase
        .from("capabilities")
        .delete()
        .eq("id", capability.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Capability deleted successfully"
      });

      setDeletingCapability(null);
      loadCapabilities();
    } catch (error: any) {
      console.error("Error deleting capability:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete capability",
        variant: "destructive"
      });
    }
  };

  // Dynamically get unique categories from capabilities
  const uniqueCategories = Array.from(
    new Set(capabilities.map(c => c.category).filter(Boolean))
  ).sort();

  const groupedCapabilities = uniqueCategories.map(category => ({
    category,
    items: capabilities.filter(c => c.category === category)
  }));

  const getLevelColor = (level: string) => {
    switch (level) {
      case "foundational":
        return "bg-blue-500/10 text-blue-700 border-blue-200";
      case "advancing":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "independent":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200";
      case "mastery":
        return "bg-purple-500/10 text-purple-700 border-purple-200";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-200";
    }
  };

  const getLevelLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Capabilities</h1>
          <p className="text-muted-foreground mt-2">
            View standard capabilities, create custom ones, and discover gaps
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Custom Capability
          </Button>
        )}
      </div>

      <Tabs defaultValue="library" className="space-y-6">
        <TabsList>
          <TabsTrigger value="library">Capability Library</TabsTrigger>
          <TabsTrigger value="intelligence">Capability Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-6">

      {/* Custom Capabilities Section */}
      {customCapabilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your Company Capabilities
              <Badge variant="secondary">{customCapabilities.length}</Badge>
            </CardTitle>
            <CardDescription>
              Custom capabilities created for your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {Array.from(new Set(customCapabilities.map(c => c.category).filter(Boolean)))
                .sort()
                .map(category => {
                  const items = customCapabilities.filter(c => c.category === category);
                  return (
                    <div key={category}>
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        {category}
                        <Badge variant="secondary">{items.length}</Badge>
                      </h2>
                      <Accordion type="single" collapsible className="space-y-2">
                        {items.map((capability) => (
                          <AccordionItem key={capability.id} value={capability.id} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex flex-col items-start text-left flex-1">
                                <div className="flex items-center gap-2 w-full">
                                  <h3 className="font-semibold flex-1">{capability.name}</h3>
                                  <Badge variant="outline" className="ml-2">Custom</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {capability.description}
                                </p>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="pt-4 space-y-4">
                                {isManager && (
                                  <div className="flex gap-2 mb-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingCapability(capability)}
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setDeletingCapability(capability)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </Button>
                                  </div>
                                )}
                                {capability.full_description && (
                                  <div className="bg-muted/50 p-4 rounded-lg">
                                    <h4 className="font-medium mb-2">Full Definition</h4>
                                    <p className="text-sm">{capability.full_description}</p>
                                  </div>
                                )}
                                
                                {capability.levels.length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-3">Progression Levels</h4>
                                    <div className="space-y-3">
                                      {capability.levels.map((level) => (
                                        <div key={level.id} className={`p-4 rounded-lg border ${getLevelColor(level.level)}`}>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline" className="font-semibold">
                                              {getLevelLabel(level.level)}
                                            </Badge>
                                          </div>
                                          <p className="text-sm">{level.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standard Capabilities Section */}
      <Card>
        <CardHeader>
          <CardTitle>Standard Capabilities</CardTitle>
          <CardDescription>
            {capabilities.length} standard capabilities available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {groupedCapabilities.map((group) => (
              <div key={group.category}>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  {group.category}
                  <Badge variant="secondary">{group.items.length}</Badge>
                </h2>
                <Accordion type="single" collapsible className="space-y-2">
                  {group.items.map((capability) => (
                    <AccordionItem key={capability.id} value={capability.id} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-col items-start text-left">
                          <h3 className="font-semibold">{capability.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {capability.description}
                          </p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pt-4 space-y-4">
                          {capability.full_description && (
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Full Definition</h4>
                              <p className="text-sm">{capability.full_description}</p>
                            </div>
                          )}
                          
                          {capability.levels.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3">Progression Levels</h4>
                              <div className="space-y-3">
                                {capability.levels.map((level) => (
                                  <div key={level.id} className={`p-4 rounded-lg border ${getLevelColor(level.level)}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="font-semibold">
                                        {getLevelLabel(level.level)}
                                      </Badge>
                                    </div>
                                    <p className="text-sm">{level.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="intelligence">
          <CapabilityIntelligence 
            onCreateCapability={(data) => {
              setPrefilledData(data);
              setShowCreateDialog(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <CreateCapabilityDialog
        open={showCreateDialog || !!editingCapability}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingCapability(null);
          setPrefilledData(undefined);
        }}
        onCapabilityCreated={() => {
          loadCapabilities();
          setPrefilledData(undefined);
        }}
        editingCapability={editingCapability}
        prefilledData={prefilledData}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCapability} onOpenChange={() => setDeletingCapability(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Capability?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCapability?.name}"? This will remove it from all employees who have been assigned this capability. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCapability && handleDeleteCapability(deletingCapability)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Capabilities;
