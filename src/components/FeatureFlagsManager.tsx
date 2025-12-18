import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Flag, Building2, User, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FeatureFlag {
  id: string;
  flag_name: string;
  description: string | null;
  is_enabled: boolean;
  created_at: string;
}

interface CompanyFlag {
  id: string;
  company_id: string;
  flag_id: string;
  is_enabled: boolean;
  enabled_at: string | null;
  company_name?: string;
  flag_name?: string;
}

interface Company {
  id: string;
  name: string;
}

export const FeatureFlagsManager = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyFlags, setCompanyFlags] = useState<CompanyFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load feature flags
      const { data: flagsData, error: flagsError } = await supabase
        .from("feature_flags")
        .select("*")
        .order("flag_name");

      if (flagsError) throw flagsError;
      setFlags(flagsData || []);

      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Load company feature flags
      const { data: companyFlagsData, error: companyFlagsError } = await supabase
        .from("company_feature_flags")
        .select(`
          id,
          company_id,
          flag_id,
          is_enabled,
          enabled_at
        `);

      if (companyFlagsError) throw companyFlagsError;
      setCompanyFlags(companyFlagsData || []);

    } catch (error) {
      console.error("Error loading feature flags:", error);
      toast({
        title: "Error",
        description: "Failed to load feature flags",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleGlobalFlag = async (flagId: string, currentValue: boolean) => {
    setTogglingFlag(flagId);
    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({ is_enabled: !currentValue })
        .eq("id", flagId);

      if (error) throw error;

      setFlags(flags.map(f => 
        f.id === flagId ? { ...f, is_enabled: !currentValue } : f
      ));

      toast({
        title: "Success",
        description: `Feature flag ${!currentValue ? "enabled" : "disabled"} globally`,
      });
    } catch (error) {
      console.error("Error toggling flag:", error);
      toast({
        title: "Error",
        description: "Failed to update feature flag",
        variant: "destructive",
      });
    } finally {
      setTogglingFlag(null);
    }
  };

  const toggleCompanyFlag = async (flagId: string, companyId: string, currentValue: boolean) => {
    setTogglingFlag(`${companyId}-${flagId}`);
    try {
      const existingFlag = companyFlags.find(
        cf => cf.company_id === companyId && cf.flag_id === flagId
      );

      if (existingFlag) {
        // Update existing
        const { error } = await supabase
          .from("company_feature_flags")
          .update({ 
            is_enabled: !currentValue,
            enabled_at: !currentValue ? new Date().toISOString() : null
          })
          .eq("id", existingFlag.id);

        if (error) throw error;

        setCompanyFlags(companyFlags.map(cf =>
          cf.id === existingFlag.id ? { ...cf, is_enabled: !currentValue } : cf
        ));
      } else {
        // Create new
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
          .from("company_feature_flags")
          .insert({
            company_id: companyId,
            flag_id: flagId,
            is_enabled: true,
            enabled_at: new Date().toISOString(),
            enabled_by: user?.id
          })
          .select()
          .single();

        if (error) throw error;

        setCompanyFlags([...companyFlags, data]);
      }

      const companyName = companies.find(c => c.id === companyId)?.name || "Company";
      const flagName = flags.find(f => f.id === flagId)?.flag_name || "Feature";

      toast({
        title: "Success",
        description: `${flagName} ${!currentValue ? "enabled" : "disabled"} for ${companyName}`,
      });
    } catch (error) {
      console.error("Error toggling company flag:", error);
      toast({
        title: "Error",
        description: "Failed to update company feature flag",
        variant: "destructive",
      });
    } finally {
      setTogglingFlag(null);
    }
  };

  const getCompanyFlagStatus = (flagId: string, companyId: string): boolean => {
    const companyFlag = companyFlags.find(
      cf => cf.company_id === companyId && cf.flag_id === flagId
    );
    
    if (companyFlag) {
      return companyFlag.is_enabled;
    }
    
    // Fall back to global flag status
    const globalFlag = flags.find(f => f.id === flagId);
    return globalFlag?.is_enabled || false;
  };

  const getFlagIcon = (flagName: string) => {
    switch (flagName) {
      case "sms_engagement":
        return "📱";
      case "daily_podcast":
        return "🎙️";
      case "outbound_voice_calls":
        return "📞";
      case "calendar_integration":
        return "📅";
      case "executive_assistant":
        return "🤖";
      case "diagnostic_pulse_sms":
        return "❤️";
      default:
        return "🚩";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Feature Flags</h2>
          <p className="text-muted-foreground">
            Control beta features globally or per-company
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="global" className="w-full">
        <TabsList>
          <TabsTrigger value="global">
            <Flag className="h-4 w-4 mr-2" />
            Global Flags
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="h-4 w-4 mr-2" />
            Per-Company
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Feature Flags</CardTitle>
              <CardDescription>
                Enable or disable features for all companies. Per-company settings will override these.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Toggle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getFlagIcon(flag.flag_name)}</span>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {flag.flag_name}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {flag.description || "No description"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={flag.is_enabled ? "default" : "secondary"}>
                          {flag.is_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={flag.is_enabled}
                          onCheckedChange={() => toggleGlobalFlag(flag.id, flag.is_enabled)}
                          disabled={togglingFlag === flag.id}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company-Specific Flags</CardTitle>
              <CardDescription>
                Override global settings for specific companies. Useful for beta testing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCompanyId && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead>Global Status</TableHead>
                      <TableHead>Company Status</TableHead>
                      <TableHead className="text-right">Toggle for Company</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flags.map((flag) => {
                      const companyStatus = getCompanyFlagStatus(flag.id, selectedCompanyId);
                      const hasOverride = companyFlags.some(
                        cf => cf.company_id === selectedCompanyId && cf.flag_id === flag.id
                      );

                      return (
                        <TableRow key={flag.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{getFlagIcon(flag.flag_name)}</span>
                              <code className="text-sm bg-muted px-2 py-1 rounded">
                                {flag.flag_name}
                              </code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={flag.is_enabled ? "default" : "secondary"}>
                              {flag.is_enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={companyStatus ? "default" : "secondary"}>
                                {companyStatus ? "Enabled" : "Disabled"}
                              </Badge>
                              {hasOverride && (
                                <Badge variant="outline" className="text-xs">
                                  Override
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={companyStatus}
                              onCheckedChange={() => toggleCompanyFlag(flag.id, selectedCompanyId, companyStatus)}
                              disabled={togglingFlag === `${selectedCompanyId}-${flag.id}`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {!selectedCompanyId && (
                <div className="text-center py-8 text-muted-foreground">
                  Select a company to manage their feature flags
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
