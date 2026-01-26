import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, History, DollarSign, Package, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PurchaseHistoryCardProps {
  customerName: string;
  companyId?: string;
  defaultOpen?: boolean;
  compact?: boolean;
}

interface PurchaseSummary {
  customerName: string;
  matchedNames: string[];
  totalRevenue: number;
  transactionCount: number;
  topProducts: { name: string; total: number; count: number }[];
  seasons: string[];
  lastPurchaseDate: string | null;
  hasHistory: boolean;
}

export const PurchaseHistoryCard = ({ 
  customerName, 
  companyId,
  defaultOpen = false,
  compact = false 
}: PurchaseHistoryCardProps) => {
  const [summary, setSummary] = useState<PurchaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerName) {
      fetchPurchaseHistory();
    }
  }, [customerName, companyId]);

  const fetchPurchaseHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-customer-purchase-summary', {
        body: { customerName, companyId }
      });

      if (fnError) throw fnError;
      setSummary(data);
    } catch (err) {
      console.error('Error fetching purchase history:', err);
      setError('Could not load purchase history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <Card className={cn("bg-muted/30", compact && "p-2")}>
        <CardContent className={cn("p-4", compact && "p-2")}>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary?.hasHistory) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="h-4 w-4" />
            <span>No purchase history found — this appears to be a new prospect</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Badge variant="secondary" className="text-xs py-0.5 px-2 gap-1">
        <DollarSign className="h-3 w-3" />
        {formatCurrency(summary.totalRevenue)}
      </Badge>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-200/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-green-600" />
                Purchase History
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                  {formatCurrency(summary.totalRevenue)}
                </Badge>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-3 pt-0 space-y-3">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-background/50 rounded-lg p-2">
                <DollarSign className="h-4 w-4 mx-auto text-green-600 mb-1" />
                <p className="text-sm font-bold">{formatCurrency(summary.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
              <div className="bg-background/50 rounded-lg p-2">
                <Package className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                <p className="text-sm font-bold">{summary.transactionCount}</p>
                <p className="text-xs text-muted-foreground">Transactions</p>
              </div>
              <div className="bg-background/50 rounded-lg p-2">
                <TrendingUp className="h-4 w-4 mx-auto text-purple-600 mb-1" />
                <p className="text-sm font-bold">{summary.seasons.length}</p>
                <p className="text-xs text-muted-foreground">Seasons Active</p>
              </div>
            </div>

            {/* Top Products */}
            {summary.topProducts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Top Products</p>
                <div className="space-y-1">
                  {summary.topProducts.slice(0, 5).map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-background/50 rounded px-2 py-1">
                      <span className="truncate flex-1 mr-2">{product.name}</span>
                      <span className="font-medium text-green-600">{formatCurrency(product.total)}</span>
                    </div>
                  ))}
                  {summary.topProducts.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{summary.topProducts.length - 5} more products
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Seasons */}
            {summary.seasons.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {summary.seasons.map(season => (
                  <Badge key={season} variant="outline" className="text-xs py-0 h-5">
                    {season}
                  </Badge>
                ))}
              </div>
            )}

            {/* Last Purchase */}
            {summary.lastPurchaseDate && (
              <p className="text-xs text-muted-foreground">
                Last purchase: {new Date(summary.lastPurchaseDate).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
