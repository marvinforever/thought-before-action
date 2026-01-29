import { useState, useEffect, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Building2, DollarSign, Calendar, ArrowRight, Leaf, Users, GripVertical, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CustomerDetailDialog } from "./CustomerDetailDialog";
import { PurchaseHistoryBadge } from "./PurchaseHistoryBadge";
import { cn } from "@/lib/utils";

interface PipelineViewProps {
  userId: string;
  stages: { key: string; label: string; color: string }[];
  companyId?: string | null;
  onDealsChange?: () => void;
  enableFieldMaps?: boolean;
}

interface TargetCategories {
  primary?: string;
  secondary?: string;
  tertiary?: string;
}

interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  value: number | null;
  expected_close_date: string | null;
  company_id: string | null;
  priority: number;
  estimated_acres: number | null;
  customer_type: string | null;
  target_categories: TargetCategories | null;
  sales_companies?: { name: string } | null;
}

export const PipelineView = ({ userId, stages, companyId, onDealsChange, enableFieldMaps = false }: PipelineViewProps) => {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

  const fetchDeals = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    const { data, error } = await supabase
      .from("sales_deals")
      .select(`
        *,
        sales_companies(name)
      `)
      .eq("profile_id", userId)
      .order("priority", { ascending: true });

    if (error) {
      toast({ title: "Error loading deals", variant: "destructive" });
    } else {
      // Cast to Deal[] since target_categories from DB is Json type
      setDeals((data || []) as unknown as Deal[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, [userId]);

  const moveDeal = async (dealId: string, newStage: string) => {
    const { error } = await supabase
      .from("sales_deals")
      .update({ stage: newStage as "prospecting" | "discovery" | "proposal" | "closing" | "follow_up" })
      .eq("id", dealId);

    if (error) {
      toast({ title: "Error moving deal", variant: "destructive" });
    } else {
      toast({ title: "Deal moved" });
      fetchDeals();
      onDealsChange?.();
    }
  };

  const deleteDeal = async (dealId: string) => {
    const { error } = await supabase
      .from("sales_deals")
      .delete()
      .eq("id", dealId);

    if (error) {
      toast({ title: "Error deleting deal", variant: "destructive" });
    } else {
      toast({ title: "Deal deleted" });
      fetchDeals();
      onDealsChange?.();
    }
    setDealToDelete(null);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dealId);
    // Add a slight delay to show the dragging state
    setTimeout(() => {
      const element = e.target as HTMLElement;
      element.style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    setDraggedDealId(null);
    setDragOverStage(null);
    const element = e.target as HTMLElement;
    element.style.opacity = "1";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Only clear if we're leaving the stage container entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("text/plain");
    
    if (dealId && draggedDealId) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.stage !== stageKey) {
        await moveDeal(dealId, stageKey);
      }
    }
    
    setDraggedDealId(null);
    setDragOverStage(null);
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
        <div 
          key={stage.key} 
          className="space-y-3"
          onDragOver={(e) => handleDragOver(e, stage.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, stage.key)}
        >
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

          {/* Deals Drop Zone */}
          <div 
            className={cn(
              "space-y-2 min-h-[200px] rounded-lg transition-all duration-200 p-1 -m-1",
              dragOverStage === stage.key && draggedDealId && deals.find(d => d.id === draggedDealId)?.stage !== stage.key
                ? "bg-primary/10 border-2 border-dashed border-primary"
                : "border-2 border-transparent"
            )}
          >
            {getStageDeals(stage.key).map(deal => (
              <Card 
                key={deal.id} 
                className={cn(
                  "cursor-grab hover:shadow-md transition-all active:cursor-grabbing",
                  draggedDealId === deal.id && "opacity-50 scale-95"
                )}
                draggable
                onDragStart={(e) => handleDragStart(e, deal.id)}
                onDragEnd={handleDragEnd}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDealToDelete(deal)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Deal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Target categories, customer type, and purchase history badges */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {deal.sales_companies?.name && (
                      <PurchaseHistoryBadge 
                        customerName={deal.sales_companies.name}
                        companyId={companyId || undefined}
                      />
                    )}
                    {deal.target_categories?.primary && (
                      <Badge variant="secondary" className="text-xs py-0 h-5">
                        <Leaf className="h-3 w-3 mr-1" />
                        {deal.target_categories.primary}
                      </Badge>
                    )}
                    {deal.customer_type && (
                      <Badge 
                        variant={deal.customer_type === 'prospect' ? 'outline' : 'default'}
                        className="text-xs py-0 h-5"
                      >
                        {deal.customer_type === 'prospect' ? 'Prospect' : 'Customer'}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {deal.estimated_acres && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {deal.estimated_acres.toLocaleString()} ac
                      </span>
                    )}
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
              <div className={cn(
                "text-center py-8 text-muted-foreground text-xs border-2 border-dashed rounded-lg transition-colors",
                dragOverStage === stage.key ? "border-primary bg-primary/5" : ""
              )}>
                {dragOverStage === stage.key ? "Drop here" : "No deals"}
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
        companyId={companyId || undefined}
        enableFieldMaps={enableFieldMaps}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!dealToDelete} onOpenChange={(open) => !open && setDealToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{dealToDelete?.deal_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => dealToDelete && deleteDeal(dealToDelete.id)}
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
