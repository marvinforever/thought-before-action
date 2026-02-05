import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, ChevronsUpDown, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Customer {
  id: string;
  name: string;
}

interface CustomerSelectorProps {
  userId: string | null;
  selectedCustomerId: string | null;
  selectedCustomerName: string | null;
  onSelect: (customerId: string | null, customerName: string | null) => void;
}

export function CustomerSelector({
  userId,
  selectedCustomerId,
  selectedCustomerName,
  onSelect,
}: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from("sales_companies")
          .select("id, name")
          .eq("profile_id", userId)
          .order("name");
        
        setCustomers(data || []);
      } catch (error) {
        console.error("Error fetching customers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [userId]);

  const handleSelect = (customer: Customer | null) => {
    if (customer) {
      onSelect(customer.id, customer.name);
    } else {
      onSelect(null, null);
    }
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-[220px] justify-between text-left font-normal",
              selectedCustomerId 
                ? "border-primary bg-primary/5" 
                : "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {selectedCustomerName || "All Customers"}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search customers..." />
            <CommandList>
              <CommandEmpty>
                {loading ? "Loading..." : "No customers found."}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all-customers"
                  onSelect={() => handleSelect(null)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !selectedCustomerId ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-medium">All Customers</span>
                </CommandItem>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.name}
                    onSelect={() => handleSelect(customer)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCustomerId === customer.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {customer.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedCustomerId && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onSelect(null, null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
