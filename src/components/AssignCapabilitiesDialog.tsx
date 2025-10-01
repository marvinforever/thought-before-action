import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface AssignCapabilitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
  };
}

interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface SelectedCapability {
  capability_id: string;
  current_level: "beginner" | "intermediate" | "advanced" | "expert";
  target_level: "beginner" | "intermediate" | "advanced" | "expert";
  priority: number;
}

const levels = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

export function AssignCapabilitiesDialog({ open, onOpenChange, employee }: AssignCapabilitiesDialogProps) {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCapabilities, setSelectedCapabilities] = useState<Map<string, SelectedCapability>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCapabilities();
    }
  }, [open, employee.id]);

  const loadCapabilities = async () => {
    try {
      setLoading(true);

      // Load all capabilities
      const { data: capabilitiesData, error: capError } = await supabase
        .from("capabilities")
        .select("id, name, description, category")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (capError) throw capError;

      setCapabilities(capabilitiesData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load capabilities",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCapability = (capabilityId: string) => {
    const newSelected = new Map(selectedCapabilities);
    if (newSelected.has(capabilityId)) {
      newSelected.delete(capabilityId);
    } else {
      newSelected.set(capabilityId, {
        capability_id: capabilityId,
        current_level: "beginner",
        target_level: "intermediate",
        priority: 3,
      });
    }
    setSelectedCapabilities(newSelected);
  };

  const handleUpdateSelection = (capabilityId: string, field: keyof SelectedCapability, value: any) => {
    const newSelected = new Map(selectedCapabilities);
    const current = newSelected.get(capabilityId);
    if (current) {
      newSelected.set(capabilityId, { ...current, [field]: value });
      setSelectedCapabilities(newSelected);
    }
  };

  const handleAssign = async () => {
    if (selectedCapabilities.size === 0) {
      toast({
        title: "No capabilities selected",
        description: "Please select at least one capability to assign",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const assignments = Array.from(selectedCapabilities.values()).map(sel => ({
        profile_id: employee.id,
        capability_id: sel.capability_id,
        current_level: sel.current_level,
        target_level: sel.target_level,
        priority: sel.priority,
      }));

      const { error } = await supabase
        .from("employee_capabilities")
        .insert(assignments);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Assigned ${assignments.length} capability(ies) to ${employee.full_name}`,
      });

      setSelectedCapabilities(new Map());
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign capabilities",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter capabilities based on search and category
  const filteredCapabilities = capabilities.filter(cap => {
    // Category filter
    if (selectedCategory !== "all" && cap.category !== selectedCategory) {
      return false;
    }
    
    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cap.name.toLowerCase().includes(query) ||
      cap.description?.toLowerCase().includes(query) ||
      cap.category?.toLowerCase().includes(query)
    );
  });

  // Get all unique categories for the dropdown
  const allCategories = Array.from(
    new Set(capabilities.map(c => c.category).filter(Boolean))
  ).sort();

  // Group capabilities by category
  const uniqueCategories = Array.from(
    new Set(filteredCapabilities.map(c => c.category).filter(Boolean))
  ).sort();

  const groupedCapabilities = uniqueCategories.map(category => ({
    category,
    items: filteredCapabilities.filter(c => c.category === category)
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Assign Capabilities to {employee.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search capabilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Categories ({capabilities.length})</SelectItem>
              {allCategories.map(category => {
                const count = capabilities.filter(c => c.category === category).length;
                return (
                  <SelectItem key={category} value={category}>
                    {category} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4 h-[60vh]">
            <div className="space-y-6 pb-4">
              {groupedCapabilities.map(group => (
                <div key={group.category} className="space-y-3">
                  <h3 className="font-semibold text-lg sticky top-0 bg-background py-2">
                    {group.category}
                  </h3>
                  <div className="space-y-3">
                    {group.items.map(capability => {
                      const isSelected = selectedCapabilities.has(capability.id);
                      const selection = selectedCapabilities.get(capability.id);

                      return (
                        <div key={capability.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleCapability(capability.id)}
                              id={`cap-${capability.id}`}
                            />
                            <div className="flex-1">
                              <label htmlFor={`cap-${capability.id}`} className="font-medium cursor-pointer">
                                {capability.name}
                              </label>
                              <p className="text-sm text-muted-foreground mt-1">{capability.description}</p>
                            </div>
                          </div>

                          {isSelected && selection && (
                            <div className="ml-7 grid grid-cols-3 gap-3 pt-3 border-t">
                              <div className="space-y-2">
                                <Label htmlFor={`current-${capability.id}`} className="text-xs">Current Level</Label>
                                <Select
                                  value={selection.current_level}
                                  onValueChange={(value) => handleUpdateSelection(capability.id, "current_level", value)}
                                >
                                  <SelectTrigger id={`current-${capability.id}`} className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {levels.map(level => (
                                      <SelectItem key={level.value} value={level.value}>
                                        {level.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`target-${capability.id}`} className="text-xs">Target Level</Label>
                                <Select
                                  value={selection.target_level}
                                  onValueChange={(value) => handleUpdateSelection(capability.id, "target_level", value)}
                                >
                                  <SelectTrigger id={`target-${capability.id}`} className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {levels.map(level => (
                                      <SelectItem key={level.value} value={level.value}>
                                        {level.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`priority-${capability.id}`} className="text-xs">Priority (1-5)</Label>
                                <Input
                                  id={`priority-${capability.id}`}
                                  type="number"
                                  min="1"
                                  max="5"
                                  value={selection.priority}
                                  onChange={(e) => handleUpdateSelection(capability.id, "priority", parseInt(e.target.value) || 3)}
                                  className="h-8"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">
              {selectedCapabilities.size} capability(ies) selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={submitting || selectedCapabilities.size === 0}>
                {submitting ? "Assigning..." : "Assign Capabilities"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
