import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Save, FolderTree } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Domain {
  id: string;
  name: string;
  description: string;
  display_order: number;
}

interface Capability {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface DomainMapping {
  capability_id: string;
  domain_id: string;
  is_primary: boolean;
}

export const CapabilityTaxonomyManager = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [mappings, setMappings] = useState<DomainMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Map<string, Set<string>>>(new Map());
  const [primaryChanges, setPrimaryChanges] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [domainsRes, capsRes, mappingsRes] = await Promise.all([
        supabase.from("capability_domains").select("*").order("display_order"),
        supabase.from("capabilities").select("id, name, category, description").order("name"),
        supabase.from("capability_domain_mappings").select("*")
      ]);

      if (domainsRes.error) throw domainsRes.error;
      if (capsRes.error) throw capsRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      setDomains(domainsRes.data || []);
      setCapabilities(capsRes.data || []);
      setMappings(mappingsRes.data || []);

      // Initialize pending changes from current mappings
      const initialMappings = new Map<string, Set<string>>();
      const initialPrimary = new Map<string, string>();
      
      (mappingsRes.data || []).forEach((m: DomainMapping) => {
        if (!initialMappings.has(m.capability_id)) {
          initialMappings.set(m.capability_id, new Set());
        }
        initialMappings.get(m.capability_id)!.add(m.domain_id);
        if (m.is_primary) {
          initialPrimary.set(m.capability_id, m.domain_id);
        }
      });
      
      setPendingChanges(initialMappings);
      setPrimaryChanges(initialPrimary);
    } catch (error) {
      console.error("Error loading taxonomy data:", error);
      toast({
        title: "Error",
        description: "Failed to load taxonomy data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCapabilityDomains = (capabilityId: string): Set<string> => {
    return pendingChanges.get(capabilityId) || new Set();
  };

  const getPrimaryDomain = (capabilityId: string): string | undefined => {
    return primaryChanges.get(capabilityId);
  };

  const toggleDomain = (capabilityId: string, domainId: string) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const currentDomains = new Set(newMap.get(capabilityId) || []);
      
      if (currentDomains.has(domainId)) {
        currentDomains.delete(domainId);
        // If we removed the primary, clear it
        if (primaryChanges.get(capabilityId) === domainId) {
          setPrimaryChanges(p => {
            const newP = new Map(p);
            newP.delete(capabilityId);
            return newP;
          });
        }
      } else {
        currentDomains.add(domainId);
        // If this is the first domain, make it primary
        if (currentDomains.size === 1) {
          setPrimaryChanges(p => {
            const newP = new Map(p);
            newP.set(capabilityId, domainId);
            return newP;
          });
        }
      }
      
      newMap.set(capabilityId, currentDomains);
      return newMap;
    });
  };

  const setPrimary = (capabilityId: string, domainId: string) => {
    setPrimaryChanges(prev => {
      const newMap = new Map(prev);
      newMap.set(capabilityId, domainId);
      return newMap;
    });
  };

  const saveAllChanges = async () => {
    setSaving(true);
    try {
      // Delete all existing mappings
      const { error: deleteError } = await supabase
        .from("capability_domain_mappings")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (deleteError) throw deleteError;

      // Build new mappings
      const newMappings: { capability_id: string; domain_id: string; is_primary: boolean }[] = [];
      
      pendingChanges.forEach((domainIds, capabilityId) => {
        domainIds.forEach(domainId => {
          newMappings.push({
            capability_id: capabilityId,
            domain_id: domainId,
            is_primary: primaryChanges.get(capabilityId) === domainId
          });
        });
      });

      if (newMappings.length > 0) {
        const { error: insertError } = await supabase
          .from("capability_domain_mappings")
          .insert(newMappings);

        if (insertError) throw insertError;
      }

      toast({
        title: "Saved",
        description: `Updated ${newMappings.length} domain assignments`,
      });

      // Reload to sync state
      loadData();
    } catch (error) {
      console.error("Error saving mappings:", error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredCapabilities = capabilities.filter(cap =>
    cap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cap.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAssignmentStats = () => {
    let assigned = 0;
    let unassigned = 0;
    capabilities.forEach(cap => {
      const domains = pendingChanges.get(cap.id);
      if (domains && domains.size > 0) {
        assigned++;
      } else {
        unassigned++;
      }
    });
    return { assigned, unassigned };
  };

  const stats = getAssignmentStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{domains.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Capabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{capabilities.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.assigned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.unassigned}</div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Domains
          </CardTitle>
          <CardDescription>Click checkboxes to assign capabilities to domains. Click domain badge to set as primary.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {domains.map((domain, idx) => (
              <Badge key={domain.id} variant="outline" className="text-xs">
                {idx + 1}. {domain.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Assignment Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Capability → Domain Assignments</CardTitle>
              <CardDescription>Assign each capability to one or more domains</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search capabilities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button onClick={saveAllChanges} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save All Changes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Capability</TableHead>
                  <TableHead className="w-[150px]">Current Category</TableHead>
                  {domains.map((domain, idx) => (
                    <TableHead key={domain.id} className="text-center w-[80px] text-xs">
                      {idx + 1}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCapabilities.map((cap) => {
                  const capDomains = getCapabilityDomains(cap.id);
                  const primaryDomain = getPrimaryDomain(cap.id);
                  
                  return (
                    <TableRow key={cap.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{cap.name}</span>
                          {capDomains.size === 0 && (
                            <span className="text-xs text-amber-600">No domain assigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {cap.category || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      {domains.map((domain) => {
                        const isAssigned = capDomains.has(domain.id);
                        const isPrimary = primaryDomain === domain.id;
                        
                        return (
                          <TableCell key={domain.id} className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Checkbox
                                checked={isAssigned}
                                onCheckedChange={() => toggleDomain(cap.id, domain.id)}
                              />
                              {isAssigned && (
                                <button
                                  onClick={() => setPrimary(cap.id, domain.id)}
                                  className={`text-[10px] px-1 rounded ${
                                    isPrimary 
                                      ? "bg-primary text-primary-foreground" 
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {isPrimary ? "★" : "○"}
                                </button>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
