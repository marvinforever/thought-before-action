import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Capability = Tables<"capabilities">;
type CapabilityLevel = Tables<"capability_levels">;

interface CapabilityWithLevels extends Capability {
  levels: CapabilityLevel[];
}

const Capabilities = () => {
  const [capabilities, setCapabilities] = useState<CapabilityWithLevels[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadCapabilities();
  }, []);

  const loadCapabilities = async () => {
    try {
      // Load capabilities with their levels
      const { data: capsData, error: capsError } = await supabase
        .from("capabilities")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (capsError) throw capsError;

      // Load all capability levels
      const { data: levelsData, error: levelsError } = await supabase
        .from("capability_levels")
        .select("*")
        .order("level", { ascending: true });

      if (levelsError) throw levelsError;

      // Combine capabilities with their levels
      const capabilitiesWithLevels = (capsData || []).map(cap => ({
        ...cap,
        levels: (levelsData || []).filter(level => level.capability_id === cap.id)
      }));

      setCapabilities(capabilitiesWithLevels);
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

  const categories = [
    "Leadership & Management",
    "Communication",
    "Technical/Functional",
    "Interpersonal",
    "Execution"
  ];

  const groupedCapabilities = categories.map(category => ({
    category,
    items: capabilities.filter(c => c.category === category)
  })).filter(group => group.items.length > 0);

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Standard Capabilities</h1>
        <p className="text-muted-foreground mt-2">
          View the standard capability framework across all domains. Approve the pending migration to see the full framework.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>
            {capabilities.length} capabilities loaded
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
    </div>
  );
};

export default Capabilities;
