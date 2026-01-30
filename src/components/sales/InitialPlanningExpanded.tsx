import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Package, ChevronDown, ChevronUp, Save, Edit2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

interface ProductSummary {
  product_description: string;
  amount: number;
  quantity: number;
}

interface InitialPlanningExpandedProps {
  customerName: string;
  companyId: string;
  userId: string;
  totalRevenue: number;
  notes: string;
  onNotesChange: (notes: string) => void;
  savedPrecallPlan?: string;
  onPrecallPlanChange?: (plan: string) => void;
}

export function InitialPlanningExpanded({
  customerName,
  companyId,
  userId,
  totalRevenue,
  notes,
  onNotesChange,
  savedPrecallPlan,
  onPrecallPlanChange,
}: InitialPlanningExpandedProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(savedPrecallPlan || null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editablePlan, setEditablePlan] = useState(savedPrecallPlan || "");
  const [savingPlan, setSavingPlan] = useState(false);

  // Sync with saved plan when prop changes
  useEffect(() => {
    if (savedPrecallPlan) {
      setGeneratedPlan(savedPrecallPlan);
      setEditablePlan(savedPrecallPlan);
    }
  }, [savedPrecallPlan]);

  useEffect(() => {
    fetchProducts();
  }, [customerName, companyId, userId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Get the user's rep name for filtering
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      const repName = profile?.full_name?.toUpperCase() || "";

      // Fetch all 2025 transactions for this customer
      const allTransactions: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("customer_purchase_history")
          .select("product_description, amount, quantity")
          .eq("company_id", companyId)
          .eq("customer_name", customerName)
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

      // Aggregate by product
      const productMap = new Map<string, { amount: number; quantity: number }>();
      for (const t of allTransactions) {
        const desc = t.product_description || "Unknown Product";
        const existing = productMap.get(desc) || { amount: 0, quantity: 0 };
        existing.amount += Number(t.amount) || 0;
        existing.quantity += Number(t.quantity) || 0;
        productMap.set(desc, existing);
      }

      // Convert to array and sort by revenue
      const productList: ProductSummary[] = Array.from(productMap.entries())
        .map(([product_description, data]) => ({
          product_description,
          amount: data.amount,
          quantity: data.quantity,
        }))
        .sort((a, b) => b.amount - a.amount);

      setProducts(productList);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error loading products",
        description: "Could not load purchase history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (productName: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.add(productName);
      }
      return next;
    });
  };

  const selectAllProducts = () => {
    setSelectedProducts(new Set(products.map((p) => p.product_description)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const generatePrecallPlan = async () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "No products selected",
        description: "Select at least one product to generate a plan",
        variant: "destructive",
      });
      return;
    }

    setGeneratingPlan(true);
    try {
      const selectedProductData = products.filter((p) =>
        selectedProducts.has(p.product_description)
      );

      const { data, error } = await supabase.functions.invoke("generate-precall-plan", {
        body: {
          customerName,
          selectedProducts: selectedProductData,
          allProducts: products,
          totalRevenue,
          companyId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGeneratedPlan(data.plan);
      setEditablePlan(data.plan);
      // Immediately notify parent that precall plan changed so it marks as unsaved
      onPrecallPlanChange?.(data.plan);
      toast({
        title: "Plan generated",
        description: "Your pre-call plan is ready. Click 'Save Changes' below to persist it.",
      });
    } catch (error: any) {
      console.error("Error generating plan:", error);
      toast({
        title: "Error generating plan",
        description: error.message || "Could not generate pre-call plan",
        variant: "destructive",
      });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const displayedProducts = showAllProducts ? products : products.slice(0, 5);
  const hasMoreProducts = products.length > 5;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading products...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-3 border-t pt-3">
      {/* Product Selection Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            2025 Products ({products.length})
          </h4>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAllProducts} className="h-7 text-xs">
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs">
              Clear
            </Button>
          </div>
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No 2025 purchases found for this customer.</p>
        ) : (
          <div className="space-y-1">
            {displayedProducts.map((product) => (
              <div
                key={product.product_description}
                className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                  selectedProducts.has(product.product_description)
                    ? "bg-primary/10 border-primary/30"
                    : "bg-background hover:bg-muted/50"
                }`}
                onClick={() => toggleProduct(product.product_description)}
              >
                <Checkbox
                  checked={selectedProducts.has(product.product_description)}
                  onCheckedChange={() => toggleProduct(product.product_description)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.product_description}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{product.quantity.toLocaleString()} units</span>
                  <Badge variant="secondary" className="font-mono">
                    {formatCurrency(product.amount)}
                  </Badge>
                </div>
              </div>
            ))}

            {hasMoreProducts && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllProducts(!showAllProducts)}
                className="w-full mt-1 text-xs"
              >
                {showAllProducts ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show {products.length - 5} More Products
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Generate Plan Button */}
      {products.length > 0 && (
        <Button
          onClick={generatePrecallPlan}
          disabled={generatingPlan || selectedProducts.size === 0}
          className="w-full"
          variant={selectedProducts.size > 0 ? "default" : "secondary"}
        >
          {generatingPlan ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Plan...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Pre-Call Plan ({selectedProducts.size} products)
            </>
          )}
        </Button>
      )}

      {/* Generated Plan Display */}
      {generatedPlan && (
        <div className="bg-muted/50 rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Pre-Call Plan
            </h4>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-7 text-xs"
              >
                {isEditing ? (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </>
                ) : (
                  <>
                    <Edit2 className="h-3 w-3 mr-1" />
                    Edit
                  </>
                )}
              </Button>
              {onPrecallPlanChange && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSavePlan}
                  disabled={savingPlan}
                  className="h-7 text-xs"
                >
                  {savingPlan ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {isEditing ? (
            <Textarea
              value={editablePlan}
              onChange={(e) => setEditablePlan(e.target.value)}
              className="h-80 text-sm font-mono resize-none"
              placeholder="Edit your pre-call plan..."
            />
          ) : (
            <div 
              className="h-80 overflow-y-auto border rounded-md bg-background p-3"
              style={{ overflowY: 'scroll' }}
            >
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{editablePlan || generatedPlan}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Notes Section */}
      <div>
        <h4 className="text-sm font-medium mb-2">Your Notes</h4>
        <Textarea
          placeholder="Add your own notes for this initial planning call..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-[80px] text-sm resize-none"
        />
      </div>
    </div>
  );

  async function handleSavePlan() {
    if (!onPrecallPlanChange) return;
    setSavingPlan(true);
    try {
      onPrecallPlanChange(editablePlan);
      setGeneratedPlan(editablePlan);
      toast({
        title: "Edits applied",
        description: "Click 'Save Changes' on the customer card to persist to database.",
      });
    } catch (error) {
      toast({
        title: "Error applying edits",
        variant: "destructive",
      });
    } finally {
      setSavingPlan(false);
    }
  }
}
