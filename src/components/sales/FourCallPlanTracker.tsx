import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CustomerCallCard } from "./CustomerCallCard";
import { AddCustomerToTrackerDialog } from "./AddCustomerToTrackerDialog";
import { Printer, RefreshCw, Loader2, Users, TrendingUp, CheckCircle2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CallPlanData {
  id?: string;
  customer_name: string;
  total_revenue: number;
  acreage?: number;
  crops?: string;
  call_1_completed: boolean;
  call_1_date?: string;
  call_1_notes?: string;
  call_2_completed: boolean;
  call_2_date?: string;
  call_2_notes?: string;
  call_3_completed: boolean;
  call_3_date?: string;
  call_3_notes?: string;
  call_4_completed: boolean;
  call_4_date?: string;
  call_4_notes?: string;
}

interface FourCallPlanTrackerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  userId: string;
  userName?: string;
}

type FilterMode = "pareto" | "all" | "incomplete" | "completed";

export function FourCallPlanTracker({
  open,
  onOpenChange,
  companyId,
  userId,
  userName,
}: FourCallPlanTrackerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CallPlanData[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("pareto");
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const fetchParetoCustomers = useCallback(async () => {
    setLoading(true);
    try {
      // Get the user's name to filter by rep
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      const repName = profile?.full_name?.toUpperCase() || "";
      
      // Helpful debug context when troubleshooting customer load issues
      console.debug("[FourCallPlanTracker] Loading customers", { companyId, userId, repName, currentYear });

      // Fetch customer purchase history for this rep
      const allTransactions: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("customer_purchase_history")
          .select("customer_name, amount")
          .eq("company_id", companyId)
          .eq("season", "2025"); // Only current season
        
        // Filter by rep name if we have one
        if (repName) {
          query = query.ilike("rep_name", repName);
        }
        
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allTransactions.push(...data);
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Aggregate 2025 by customer
      const customerTotals = new Map<string, { revenue: number }>();
      for (const t of allTransactions) {
        const existing = customerTotals.get(t.customer_name) || { revenue: 0 };
        existing.revenue += Number(t.amount) || 0;
        customerTotals.set(t.customer_name, existing);
      }

      // Sort by revenue descending
      const sorted = Array.from(customerTotals.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue);

      // Calculate Pareto cutoff (top 20% of customers)
      const paretoCount = Math.max(1, Math.ceil(sorted.length * 0.2));
      const paretoCustomers = sorted.slice(0, paretoCount);

      // Fetch existing tracking data
      const { data: existingTracking, error: trackingError } = await supabase
        .from("call_plan_tracking")
        .select("*")
        .eq("profile_id", userId)
        .eq("plan_year", currentYear);

      if (trackingError) throw trackingError;

      const trackingMap = new Map(
        (existingTracking || []).map((t) => [t.customer_name, t])
      );

      // Merge Pareto customers with tracking data
      const merged: CallPlanData[] = paretoCustomers.map(([name, data]) => {
        const tracking = trackingMap.get(name);
        return {
          id: tracking?.id,
          customer_name: name,
          total_revenue: data.revenue,
          acreage: tracking?.acreage ?? undefined,
          crops: tracking?.crops ?? undefined,
          call_1_completed: tracking?.call_1_completed || false,
          call_1_date: tracking?.call_1_date,
          call_1_notes: tracking?.call_1_notes,
          call_2_completed: tracking?.call_2_completed || false,
          call_2_date: tracking?.call_2_date,
          call_2_notes: tracking?.call_2_notes,
          call_3_completed: tracking?.call_3_completed || false,
          call_3_date: tracking?.call_3_date,
          call_3_notes: tracking?.call_3_notes,
          call_4_completed: tracking?.call_4_completed || false,
          call_4_date: tracking?.call_4_date,
          call_4_notes: tracking?.call_4_notes,
        };
      });

      setCustomers(merged);
    } catch (error: any) {
      const message =
        error?.message ||
        error?.error_description ||
        (typeof error === "string" ? error : "Unknown error");

      console.error("[FourCallPlanTracker] Error fetching customers:", error);
      toast({
        title: "Error loading customers",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, userId, currentYear, toast]);

  useEffect(() => {
    if (open && companyId && userId) {
      fetchParetoCustomers();
    }
  }, [open, companyId, userId, fetchParetoCustomers]);

  const handleUpdateCustomer = async (customerName: string, updates: Partial<CallPlanData>) => {
    setSaving(true);
    try {
      const customer = customers.find((c) => c.customer_name === customerName);
      if (!customer) return;

      const upsertData = {
        profile_id: userId,
        customer_name: customerName,
        plan_year: currentYear,
        total_revenue: customer.total_revenue,
        acreage: customer.acreage,
        crops: customer.crops,
        ...updates,
      };

      if (customer.id) {
        // Update existing
        await supabase
          .from("call_plan_tracking")
          .update(upsertData)
          .eq("id", customer.id);
      } else {
        // Insert new
        const { data } = await supabase
          .from("call_plan_tracking")
          .insert(upsertData)
          .select("id")
          .single();
        
        if (data) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.customer_name === customerName ? { ...c, ...updates, id: data.id } : c
            )
          );
          return;
        }
      }

      // Update local state
      setCustomers((prev) =>
        prev.map((c) =>
          c.customer_name === customerName ? { ...c, ...updates } : c
        )
      );
    } catch (error) {
      console.error("Error updating tracking:", error);
      toast({
        title: "Error saving",
        description: "Failed to save your changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCustomerAdded = (customer: { customer_name: string; total_revenue: number }) => {
    const newCustomer: CallPlanData = {
      customer_name: customer.customer_name,
      total_revenue: customer.total_revenue,
      call_1_completed: false,
      call_2_completed: false,
      call_3_completed: false,
      call_4_completed: false,
    };
    setCustomers((prev) => [...prev, newCustomer].sort((a, b) => b.total_revenue - a.total_revenue));
  };

  // Filter customers based on mode
  const filteredCustomers = customers.filter((c) => {
    if (filterMode === "completed") {
      return c.call_1_completed && c.call_2_completed && c.call_3_completed && c.call_4_completed;
    }
    if (filterMode === "incomplete") {
      return !c.call_1_completed || !c.call_2_completed || !c.call_3_completed || !c.call_4_completed;
    }
    return true; // "pareto" or "all"
  });

  // Stats
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.total_revenue, 0);
  const completedAllFour = customers.filter(
    (c) => c.call_1_completed && c.call_2_completed && c.call_3_completed && c.call_4_completed
  ).length;
  const totalCallsCompleted = customers.reduce((sum, c) => {
    return sum + 
      (c.call_1_completed ? 1 : 0) + 
      (c.call_2_completed ? 1 : 0) + 
      (c.call_3_completed ? 1 : 0) + 
      (c.call_4_completed ? 1 : 0);
  }, 0);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col print:max-w-none print:max-h-none print:h-auto">
        <DialogHeader className="print:text-center print:border-b print:pb-4 print:mb-4">
          <DialogTitle className="flex items-center justify-between print:block">
            <span className="text-xl font-bold">
              4-Call Plan Tracker {userName ? `- ${userName}` : ""} - 2025 Season
            </span>
            <div className="flex items-center gap-2 print:hidden">
              {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
              <Button variant="outline" size="sm" onClick={fetchParetoCustomers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
            </div>
          </DialogTitle>
          
          {/* Stats Row */}
          <div className="flex flex-wrap gap-4 mt-4 print:justify-center">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>{totalCustomers}</strong> priority customers
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>{formatCurrency(totalRevenue)}</strong> 2025
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>{totalCallsCompleted}</strong> calls completed
              </span>
            </div>
            <Badge variant={completedAllFour === totalCustomers ? "default" : "secondary"}>
              {completedAllFour}/{totalCustomers} fully completed
            </Badge>
          </div>
          
          {/* Filter */}
          <div className="flex items-center gap-2 mt-3 print:hidden">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pareto">Top 20% by Revenue</SelectItem>
                <SelectItem value="incomplete">Incomplete only</SelectItem>
                <SelectItem value="completed">Completed only</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-2">
              Showing {filteredCustomers.length} of {totalCustomers}
            </span>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12 text-center">
            <div>
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No customers found</p>
              <p className="text-muted-foreground">
                {filterMode === "completed" 
                  ? "No customers have completed all 4 calls yet"
                  : "No customer purchase history available"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto -mx-6 px-6 print:overflow-visible">
            <div className="space-y-4 pb-4 print:space-y-6">
              {filteredCustomers.map((customer) => (
                <CustomerCallCard
                  key={customer.customer_name}
                  customer={customer}
                  companyId={companyId}
                  userId={userId}
                  onUpdate={(updates) => handleUpdateCustomer(customer.customer_name, updates)}
                />
              ))}
            </div>
          </div>
        )}

          <AddCustomerToTrackerDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            companyId={companyId}
            userId={userId}
            existingCustomerNames={customers.map((c) => c.customer_name)}
            onCustomerAdded={handleCustomerAdded}
          />
        </DialogContent>
      </Dialog>
    );
  }
