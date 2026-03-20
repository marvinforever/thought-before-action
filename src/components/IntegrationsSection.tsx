import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Link2, 
  Unlink, 
  Calendar, 
  Mail, 
  MessageSquare, 
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Integration {
  id: string;
  integration_type: string;
  external_email: string | null;
  connected_at: string;
  last_sync_at: string | null;
  sync_status: string;
  sync_error: string | null;
  scopes: string[] | null;
}

interface IntegrationConfig {
  type: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  features: string[];
  comingSoon?: boolean;
}

const INTEGRATION_CONFIGS: IntegrationConfig[] = [
  {
    type: "google",
    name: "Google Workspace",
    description: "Calendar events and Gmail context",
    icon: Calendar,
    color: "text-red-500",
    features: ["Calendar sync", "Email context", "Meeting prep"],
    comingSoon: false,
  },
  {
    type: "microsoft",
    name: "Microsoft 365",
    description: "Outlook calendar and email integration",
    icon: Mail,
    color: "text-blue-500",
    features: ["Outlook calendar", "Email threads", "Teams context"],
    comingSoon: true,
  },
  {
    type: "slack",
    name: "Slack",
    description: "Channel context and direct messaging",
    icon: MessageSquare,
    color: "text-purple-500",
    features: ["Channel awareness", "DM context", "Status sync"],
    comingSoon: true,
  },
  {
    type: "salesforce",
    name: "Salesforce",
    description: "CRM data and customer context",
    icon: TrendingUp,
    color: "text-blue-600",
    features: ["Deal context", "Customer history", "Pipeline sync"],
    comingSoon: true,
  },
];

const getSyncStatusBadge = (status: string, error?: string | null) => {
  switch (status) {
    case "synced":
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Synced
        </Badge>
      );
    case "syncing":
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          Syncing
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20" title={error || undefined}>
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
  }
};

export function IntegrationsSection() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("profile_id", user.id);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error("Error loading integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integrationType: string) => {
    setConnecting(integrationType);
    try {
      // For now, show coming soon message
      // Once OAuth is implemented, this will redirect to the OAuth flow
      toast({
        title: "Coming Soon",
        description: `${INTEGRATION_CONFIGS.find(c => c.type === integrationType)?.name} integration is coming soon. We're working on it!`,
      });
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect integration",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integrationId: string, integrationType: string) => {
    setDisconnecting(integrationType);
    try {
      const { error } = await supabase
        .from("user_integrations")
        .delete()
        .eq("id", integrationId);

      if (error) throw error;

      setIntegrations(prev => prev.filter(i => i.id !== integrationId));
      toast({
        title: "Disconnected",
        description: `${INTEGRATION_CONFIGS.find(c => c.type === integrationType)?.name} has been disconnected.`,
      });
    } catch (error: any) {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect integration",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(null);
    }
  };

  const getConnectedIntegration = (type: string) => {
    return integrations.find(i => i.integration_type === type);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connect Your Work Tools
          </CardTitle>
          <CardDescription>Loading integrations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Connect Your Work Tools
        </CardTitle>
        <CardDescription>
          Give Jericho visibility into your work context for proactive assistance with meetings, emails, and relationships.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {INTEGRATION_CONFIGS.map((config) => {
          const connected = getConnectedIntegration(config.type);
          const Icon = config.icon;
          const isConnecting = connecting === config.type;
          const isDisconnecting = disconnecting === config.type;

          return (
            <div
              key={config.type}
              className={cn(
                "flex items-start gap-4 p-4 rounded-lg border transition-colors",
                connected ? "bg-muted/30 border-primary/20" : "hover:bg-muted/50"
              )}
            >
              <div className={cn("p-2 rounded-lg bg-muted", config.color)}>
                <Icon className="h-6 w-6" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{config.name}</h3>
                  {config.comingSoon && !connected && (
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  )}
                  {connected && getSyncStatusBadge(connected.sync_status, connected.sync_error)}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {config.description}
                </p>
                
                {connected ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Connected as <span className="font-medium">{connected.external_email}</span>
                    </p>
                    {connected.last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Last synced {formatDistanceToNow(new Date(connected.last_sync_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {config.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs font-normal">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0">
                {connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(connected.id, config.type)}
                    disabled={isDisconnecting}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isDisconnecting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="h-4 w-4 mr-1" />
                        Disconnect
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant={config.comingSoon ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleConnect(config.type)}
                    disabled={isConnecting || config.comingSoon}
                  >
                    {isConnecting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-1" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            🔒 Your data is encrypted and only used to help Jericho understand your work context.
            <br />
            You can disconnect at any time and your synced data will be deleted.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
