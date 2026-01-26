import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Trash2, Edit, MessageSquare, Leaf } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EditDealDialog } from "./EditDealDialog";
import { DealCoachDialog } from "./DealCoachDialog";

interface DealsTableProps {
  userId: string;
}

const stageColors: Record<string, string> = {
  prospecting: "bg-blue-500",
  discovery: "bg-purple-500",
  proposal: "bg-amber-500",
  closing: "bg-green-500",
  follow_up: "bg-teal-500",
};

const stageLabels: Record<string, string> = {
  prospecting: "Prospecting",
  discovery: "Discovery",
  proposal: "Proposal",
  closing: "Closing",
  follow_up: "Follow Up",
};

export const DealsTable = ({ userId }: DealsTableProps) => {
  const { toast } = useToast();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [coachingDeal, setCoachingDeal] = useState<any>(null);

  const fetchDeals = async () => {
    let query = supabase
      .from("sales_deals")
      .select(`
        *,
        sales_companies(name),
        sales_contacts(name)
      `)
      .eq("profile_id", userId)
      .order("created_at", { ascending: false });

    if (stageFilter !== "all") {
      query = query.eq("stage", stageFilter as any);
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
    if (userId) fetchDeals();
  }, [userId, stageFilter]);

  const deleteDeal = async (dealId: string) => {
    if (!confirm("Are you sure you want to delete this deal?")) return;

    const { error } = await supabase
      .from("sales_deals")
      .delete()
      .eq("id", dealId);

    if (error) {
      toast({ title: "Error deleting deal", variant: "destructive" });
    } else {
      toast({ title: "Deal deleted" });
      fetchDeals();
    }
  };

  const filteredDeals = deals.filter(deal =>
    deal.deal_name.toLowerCase().includes(search.toLowerCase()) ||
    deal.sales_companies?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading deals...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="prospecting">Prospecting</SelectItem>
            <SelectItem value="discovery">Discovery</SelectItem>
            <SelectItem value="proposal">Proposal</SelectItem>
            <SelectItem value="closing">Closing</SelectItem>
            <SelectItem value="follow_up">Follow Up</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Acres</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No deals found. Add your first deal to get started!
                </TableCell>
              </TableRow>
            ) : (
              filteredDeals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-medium">{deal.deal_name}</TableCell>
                  <TableCell>{deal.sales_companies?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge className={`${stageColors[deal.stage]} text-white`}>
                      {stageLabels[deal.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {deal.customer_type ? (
                      <Badge variant={deal.customer_type === 'prospect' ? 'outline' : 'default'}>
                        {deal.customer_type === 'prospect' ? 'Prospect' : 'Customer'}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {deal.estimated_acres ? deal.estimated_acres.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell>
                    {deal.target_categories?.primary ? (
                      <Badge variant="secondary" className="text-xs">
                        <Leaf className="h-3 w-3 mr-1" />
                        {deal.target_categories.primary}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {deal.value ? `$${Number(deal.value).toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCoachingDeal(deal)}
                        title="Get AI coaching"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingDeal(deal)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDeal(deal.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingDeal && (
        <EditDealDialog
          deal={editingDeal}
          open={!!editingDeal}
          onOpenChange={(open) => !open && setEditingDeal(null)}
          onSuccess={() => {
            setEditingDeal(null);
            fetchDeals();
          }}
        />
      )}

      {coachingDeal && (
        <DealCoachDialog
          deal={coachingDeal}
          open={!!coachingDeal}
          onOpenChange={(open) => !open && setCoachingDeal(null)}
        />
      )}
    </div>
  );
};
