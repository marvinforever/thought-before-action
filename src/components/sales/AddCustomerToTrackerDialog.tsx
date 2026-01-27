import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Loader2, User, UserPlus, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerOption {
  customer_name: string;
  total_revenue: number;
  source: "history" | "company" | "manual";
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
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");

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
      const existingSet = new Set(existingCustomerNames.map(n => n.toLowerCase()));

      // Fetch customers from purchase history (2025)
      const historyCustomers = await fetchFromPurchaseHistory(companyId, repName, existingSet);
      
      // Fetch companies from sales_companies (CRM)
      const crmCompanies = await fetchFromSalesCompanies(userId, existingSet);

      // Merge and deduplicate (history takes precedence for revenue)
      const customerMap = new Map<string, CustomerOption>();
      
      for (const c of historyCustomers) {
        customerMap.set(c.customer_name.toLowerCase(), c);
      }
      
      for (const c of crmCompanies) {
        const key = c.customer_name.toLowerCase();
        if (!customerMap.has(key)) {
          customerMap.set(key, c);
        }
      }

      const merged = Array.from(customerMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue);

      setCustomers(merged);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFromPurchaseHistory = async (
    companyId: string,
    repName: string,
    existingSet: Set<string>
  ): Promise<CustomerOption[]> => {
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

    return Array.from(customerTotals.entries())
      .filter(([name]) => !existingSet.has(name.toLowerCase()))
      .map(([customer_name, total_revenue]) => ({ 
        customer_name, 
        total_revenue,
        source: "history" as const
      }));
  };

  const fetchFromSalesCompanies = async (
    userId: string,
    existingSet: Set<string>
  ): Promise<CustomerOption[]> => {
    const { data, error } = await supabase
      .from("sales_companies")
      .select("name")
      .eq("profile_id", userId);

    if (error) {
      console.error("Error fetching sales companies:", error);
      return [];
    }

    return (data || [])
      .filter(c => !existingSet.has(c.name.toLowerCase()))
      .map(c => ({
        customer_name: c.name,
        total_revenue: 0,
        source: "company" as const
      }));
  };

  const handleAddCustomer = async (customer: CustomerOption) => {
    setAdding(customer.customer_name);
    try {
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

      onCustomerAdded(customer);
      setCustomers((prev) => prev.filter((c) => c.customer_name !== customer.customer_name));
      toast({
        title: "Customer added",
        description: `${customer.customer_name} has been added to your tracker`,
      });
    } catch (error: any) {
      console.error("Error adding customer:", error);
      toast({
        title: "Error adding customer",
        description: error.message || "Failed to add customer",
        variant: "destructive",
      });
    } finally {
      setAdding(null);
    }
  };

  const handleAddNewCustomer = async () => {
    const trimmedName = newCustomerName.trim();
    if (!trimmedName) {
      toast({
        title: "Name required",
        description: "Please enter a customer name",
        variant: "destructive",
      });
      return;
    }

    // Check if already exists
    const existingSet = new Set(existingCustomerNames.map(n => n.toLowerCase()));
    if (existingSet.has(trimmedName.toLowerCase())) {
      toast({
        title: "Already tracked",
        description: "This customer is already in your tracker",
        variant: "destructive",
      });
      return;
    }

    setAddingNew(true);
    try {
      const { error } = await supabase.from("call_plan_tracking").insert({
        profile_id: userId,
        customer_name: trimmedName,
        plan_year: new Date().getFullYear(),
        total_revenue: 0,
        call_1_completed: false,
        call_2_completed: false,
        call_3_completed: false,
        call_4_completed: false,
      });

      if (error) throw error;

      onCustomerAdded({ customer_name: trimmedName, total_revenue: 0 });
      setNewCustomerName("");
      toast({
        title: "Customer added",
        description: `${trimmedName} has been added to your tracker`,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding new customer:", error);
      toast({
        title: "Error adding customer",
        description: error.message || "Failed to add customer",
        variant: "destructive",
      });
    } finally {
      setAddingNew(false);
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing" className="gap-2">
              <Building2 className="h-4 w-4" />
              Existing
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-2">
              <UserPlus className="h-4 w-4" />
              New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3">
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
                <p>{search ? "No matching customers found" : "No customers available"}</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => setActiveTab("new")}
                >
                  Add a new customer instead
                </Button>
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
                          {customer.source === "company" ? (
                            <Building2 className="h-4 w-4 text-primary" />
                          ) : (
                            <User className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{customer.customer_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {customer.total_revenue > 0 
                              ? `${formatCurrency(customer.total_revenue)} 2025`
                              : customer.source === "company" 
                                ? "From Companies" 
                                : "No 2025 revenue"
                            }
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
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add a new customer or prospect that isn't in your existing data yet.
            </p>
            
            <div className="space-y-3">
              <Input
                placeholder="Customer / Prospect Name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddNewCustomer();
                  }
                }}
              />
              
              <Button 
                onClick={handleAddNewCustomer} 
                disabled={addingNew || !newCustomerName.trim()}
                className="w-full"
              >
                {addingNew ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add to Tracker
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
