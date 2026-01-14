import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Building2, DollarSign, Calendar, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CustomerDetailDialog } from "./CustomerDetailDialog";

interface PipelineViewProps {
  userId: string;
  stages: { key: string; label: string; color: string }[];
  companyId?: string | null;
}

interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  value: number | null;
  expected_close_date: string | null;
  company_id: string | null;
  priority: number;
  sales_companies?: { name: string } | null;
}

export const PipelineView = ({ userId, stages, companyId }: PipelineViewProps) => {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);

  const fetchDeals = async () => {
    let query = supabase
      .from("sales_deals")
      .select(`
        *,
        sales_companies(name)
      `)
      .order("priority", { ascending: true });

    // If viewing as a company, filter by company_id; otherwise filter by profile_id
    if (companyId) {
      query = query.eq("company_id", companyId);
    } else {
      query = query.eq("profile_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error loading deals", variant: "destructive" });
    } else {
      setDeals(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId || companyId) fetchDeals();
  }, [userId, companyId]);

  const moveDeal = async (dealId: string, newStage: string) => {
    const { error } = await supabase
      .from("sales_deals")
      .update({ stage: newStage as "prospecting" | "discovery" | "proposal" | "closing" | "follow_up" })
      .eq("id", dealId);

    if (error) {
      toast({ title: "Error moving deal", variant: "destructive" });
    } else {
      toast({ title: "Deal moved successfully" });
      fetchDeals();
    }
  };

  const getStageDeals = (stageKey: string) => 
    deals.filter(d => d.stage === stageKey);

  const getStageValue = (stageKey: string) =>
    getStageDeals(stageKey).reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading pipeline...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stages.map((stage, idx) => (
        <div key={stage.key} className="space-y-3">
          {/* Stage Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${stage.color}`} />
              <h3 className="font-semibold text-sm">{stage.label}</h3>
              <Badge variant="secondary" className="text-xs">
                {getStageDeals(stage.key).length}
              </Badge>
            </div>
          </div>
          
          {/* Stage Value */}
          <p className="text-xs text-muted-foreground">
            ${getStageValue(stage.key).toLocaleString()}
          </p>

          {/* Deals */}
          <div className="space-y-2 min-h-[200px]">
            {getStageDeals(stage.key).map(deal => (
              <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{deal.deal_name}</p>
                      {deal.sales_companies?.name && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (deal.company_id) {
                              setSelectedCustomerId(deal.company_id);
                              setShowCustomerDetail(true);
                            }
                          }}
                          className="text-xs text-muted-foreground flex items-center gap-1 mt-1 hover:text-primary transition-colors"
                        >
                          <Building2 className="h-3 w-3" />
                          <span className="underline decoration-dotted">{deal.sales_companies.name}</span>
                        </button>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {stages.filter(s => s.key !== stage.key).map(s => (
                          <DropdownMenuItem 
                            key={s.key}
                            onClick={() => moveDeal(deal.id, s.key)}
                          >
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Move to {s.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {deal.value && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {Number(deal.value).toLocaleString()}
                      </span>
                    )}
                    {deal.expected_close_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(deal.expected_close_date), "MMM d")}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {getStageDeals(stage.key).length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs border-2 border-dashed rounded-lg">
                No deals
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        open={showCustomerDetail}
        onOpenChange={setShowCustomerDetail}
        customerId={selectedCustomerId}
      />
    </div>
  );
};
