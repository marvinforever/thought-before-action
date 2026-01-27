import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Loader2, User } from "lucide-react";

interface CustomerOption {
  customer_name: string;
  total_revenue: number;
}

interface AddCustomerToTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  userId: string;
  existingCustomerNames: string[];
  onCustomerAdded: (customer: { customer_name: string; total_revenue: number }) => void;
}

export function AddCustomerToTrackerDialog({
  open,
  onOpenChange,
  companyId,
  userId,
  existingCustomerNames,
  onCustomerAdded,
}: AddCustomerToTrackerDialogProps) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (open && companyId && userId) {
      fetchAvailableCustomers();
    }
  }, [open, companyId, userId]);

  const fetchAvailableCustomers = async () => {
    setLoading(true);
    try {
      // Get the user's rep name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      const repName = profile?.full_name?.toUpperCase() || "";

      // Fetch all customers for this rep from 2025
      const allTransactions: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("customer_purchase_history")
          .select("customer_name, amount")
          .eq("company_id", companyId)
          .eq("season", "2025");

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

      // Aggregate by customer
      const customerTotals = new Map<string, number>();
      for (const t of allTransactions) {
        const existing = customerTotals.get(t.customer_name) || 0;
        customerTotals.set(t.customer_name, existing + (Number(t.amount) || 0));
      }

      // Convert to array and filter out existing
      const existingSet = new Set(existingCustomerNames.map(n => n.toLowerCase()));
      const available = Array.from(customerTotals.entries())
        .filter(([name]) => !existingSet.has(name.toLowerCase()))
        .map(([customer_name, total_revenue]) => ({ customer_name, total_revenue }))
        .sort((a, b) => b.total_revenue - a.total_revenue);

      setCustomers(available);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (customer: CustomerOption) => {
    setAdding(customer.customer_name);
    try {
      // Insert into call_plan_tracking
      const { error } = await supabase.from("call_plan_tracking").insert({
        profile_id: userId,
        customer_name: customer.customer_name,
        plan_year: new Date().getFullYear(),
        total_revenue: customer.total_revenue,
        call_1_completed: false,
        call_2_completed: false,
        call_3_completed: false,
        call_4_completed: false,
      });

      if (error) throw error;

      // Notify parent and remove from list
      onCustomerAdded(customer);
      setCustomers((prev) => prev.filter((c) => c.customer_name !== customer.customer_name));
    } catch (error) {
      console.error("Error adding customer:", error);
    } finally {
      setAdding(null);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const filteredCustomers = customers.filter((c) =>
    c.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Customer to Tracker</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {search ? "No matching customers found" : "All customers are already in your tracker"}
          </div>
        ) : (
          <ScrollArea className="h-[300px] -mx-2">
            <div className="space-y-1 px-2">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.customer_name}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{customer.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(customer.total_revenue)} 2025
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddCustomer(customer)}
                    disabled={adding === customer.customer_name}
                  >
                    {adding === customer.customer_name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
