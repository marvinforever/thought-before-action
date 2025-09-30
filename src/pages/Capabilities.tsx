import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Capability = Tables<"capabilities">;

const Capabilities = () => {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadCapabilities();
  }, []);

  const loadCapabilities = async () => {
    try {
      const { data, error } = await supabase
        .from("capabilities")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setCapabilities(data || []);
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

  const domains = [
    "Leadership & Management",
    "Communication",
    "Technical/Functional",
    "Interpersonal",
    "Execution"
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case "foundational":
        return "bg-blue-500/10 text-blue-500";
      case "advancing":
        return "bg-green-500/10 text-green-500";
      case "independent":
        return "bg-yellow-500/10 text-yellow-500";
      case "mastery":
        return "bg-purple-500/10 text-purple-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
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
          <div className="space-y-4">
            {capabilities.map((capability) => (
              <div key={capability.id} className="border-b pb-4 last:border-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{capability.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {capability.description}
                    </p>
                  </div>
                  {capability.category && (
                    <Badge variant="outline">{capability.category}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Capabilities;
