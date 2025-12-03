import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, FolderTree, Filter } from "lucide-react";
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
  id: string;
  capability_id: string;
  domain_id: string;
  is_primary: boolean;
}

export const CapabilityTaxonomyManager = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [mappings, setMappings] = useState<DomainMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>("all");
  const [pendingChanges, setPendingChanges] = useState<Map<string, string>>(new Map());
  const [approvedCaps, setApprovedCaps] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
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
      const initialMappings = new Map<string, string>();
      (mappingsRes.data || []).forEach((m: DomainMapping) => {
        if (m.is_primary) {
          initialMappings.set(m.capability_id, m.domain_id);
        }
      });
      setPendingChanges(initialMappings);
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

  const getCapabilityDomain = (capabilityId: string): string | undefined => {
    return pendingChanges.get(capabilityId);
  };

  const getDomainName = (domainId: string): string => {
    return domains.find(d => d.id === domainId)?.name || "Unknown";
  };

  const changeDomain = (capabilityId: string, domainId: string) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      newMap.set(capabilityId, domainId);
      return newMap;
    });
    // Remove from approved if changed
    setApprovedCaps(prev => {
      const newSet = new Set(prev);
      newSet.delete(capabilityId);
      return newSet;
    });
  };

  const approveCap = (capabilityId: string) => {
    setApprovedCaps(prev => {
      const newSet = new Set(prev);
      newSet.add(capabilityId);
      return newSet;
    });
  };

  const rejectCap = (capabilityId: string) => {
    // Just remove approval - user should change the domain
    setApprovedCaps(prev => {
      const newSet = new Set(prev);
      newSet.delete(capabilityId);
      return newSet;
    });
  };

  const approveAllVisible = () => {
    const visible = getFilteredCapabilities();
    setApprovedCaps(prev => {
      const newSet = new Set(prev);
      visible.forEach(cap => newSet.add(cap.id));
      return newSet;
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // Delete all existing mappings
      const { error: deleteError } = await supabase
        .from("capability_domain_mappings")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) throw deleteError;

      // Build new mappings from pending changes
      const newMappings: { capability_id: string; domain_id: string; is_primary: boolean }[] = [];
      
      pendingChanges.forEach((domainId, capabilityId) => {
        newMappings.push({
          capability_id: capabilityId,
          domain_id: domainId,
          is_primary: true
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

  const getFilteredCapabilities = () => {
    if (selectedDomainFilter === "all") {
      return capabilities;
    }
    if (selectedDomainFilter === "unassigned") {
      return capabilities.filter(cap => !pendingChanges.has(cap.id));
    }
    return capabilities.filter(cap => pendingChanges.get(cap.id) === selectedDomainFilter);
  };

  const getStats = () => {
    const byDomain = new Map<string, number>();
    domains.forEach(d => byDomain.set(d.id, 0));
    
    let unassigned = 0;
    let approved = 0;

    capabilities.forEach(cap => {
      const domainId = pendingChanges.get(cap.id);
      if (domainId) {
        byDomain.set(domainId, (byDomain.get(domainId) || 0) + 1);
      } else {
        unassigned++;
      }
      if (approvedCaps.has(cap.id)) {
        approved++;
      }
    });

    return { byDomain, unassigned, approved };
  };

  const stats = getStats();
  const filteredCaps = getFilteredCapabilities();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="text-2xl font-bold text-green-600">{capabilities.length - stats.unassigned}</div>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Domain Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {domains.map((domain) => (
              <Badge 
                key={domain.id} 
                variant="outline" 
                className="text-xs cursor-pointer hover:bg-accent"
                onClick={() => setSelectedDomainFilter(domain.id)}
              >
                {domain.name}: {stats.byDomain.get(domain.id) || 0}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Review Interface */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Review Domain Assignments</CardTitle>
              <CardDescription>Filter by domain, review AI suggestions, and adjust as needed</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedDomainFilter} onValueChange={setSelectedDomainFilter}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Filter by domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Capabilities ({capabilities.length})</SelectItem>
                    <SelectItem value="unassigned">Unassigned ({stats.unassigned})</SelectItem>
                    {domains.map(domain => (
                      <SelectItem key={domain.id} value={domain.id}>
                        {domain.name} ({stats.byDomain.get(domain.id) || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={approveAllVisible} size="sm">
                <Check className="h-4 w-4 mr-2" />
                Approve All Visible
              </Button>
              <Button onClick={saveChanges} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredCaps.map((cap) => {
                const currentDomainId = getCapabilityDomain(cap.id);
                const isApproved = approvedCaps.has(cap.id);
                
                return (
                  <div 
                    key={cap.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isApproved ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-card'
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="font-medium truncate">{cap.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Original category: {cap.category || "None"}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Select 
                        value={currentDomainId || ""} 
                        onValueChange={(value) => changeDomain(cap.id, value)}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Select domain" />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.map(domain => (
                            <SelectItem key={domain.id} value={domain.id}>
                              {domain.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant={isApproved ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => approveCap(cap.id)}
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => rejectCap(cap.id)}
                          title="Needs review"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {filteredCaps.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No capabilities found for this filter
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
