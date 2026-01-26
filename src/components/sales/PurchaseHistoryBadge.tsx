import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DollarSign, Package, Calendar, Loader2 } from "lucide-react";

interface PurchaseHistoryBadgeProps {
  customerName: string;
  companyId?: string;
}

interface PurchaseSummary {
  totalRevenue: number;
  transactionCount: number;
  topProducts: { name: string; total: number; count: number }[];
  seasons: string[];
  hasHistory: boolean;
}

export const PurchaseHistoryBadge = ({ customerName, companyId }: PurchaseHistoryBadgeProps) => {
  const [summary, setSummary] = useState<PurchaseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customerName) {
      fetchPurchaseHistory();
    }
  }, [customerName, companyId]);

  const fetchPurchaseHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-customer-purchase-summary', {
        body: { customerName, companyId }
      });

      if (error) throw error;
      setSummary(data);
    } catch (err) {
      console.error('Error fetching purchase history badge:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <Badge variant="outline" className="text-xs py-0 h-5 opacity-50">
        <Loader2 className="h-3 w-3 animate-spin" />
      </Badge>
    );
  }

  if (!summary?.hasHistory) {
    return null; // Don't show badge if no history
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge 
          variant="secondary" 
          className="text-xs py-0 h-5 bg-green-100 text-green-700 border-green-200 cursor-pointer hover:bg-green-200 transition-colors"
        >
          <DollarSign className="h-3 w-3 mr-0.5" />
          {formatCurrency(summary.totalRevenue)}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Purchase History</span>
            <span className="text-xs text-muted-foreground">{summary.transactionCount} orders</span>
          </div>
          
          {summary.topProducts.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                Top Products
              </span>
              {summary.topProducts.slice(0, 3).map((product, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="truncate flex-1 mr-2">{product.name}</span>
                  <span className="font-medium">{formatCurrency(product.total)}</span>
                </div>
              ))}
            </div>
          )}

          {summary.seasons.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              {summary.seasons.slice(-3).map(season => (
                <Badge key={season} variant="outline" className="text-[10px] py-0 h-4">
                  {season}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
