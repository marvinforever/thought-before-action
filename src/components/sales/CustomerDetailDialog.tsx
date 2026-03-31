import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MapPin, Calendar, DollarSign, Users, FileText, TrendingUp, History, Phone, Mail, Map, Package, ShoppingCart, Presentation } from "lucide-react";
import { format } from "date-fns";
import { FieldMapAnalyzer } from "./FieldMapAnalyzer";
import { PitchDeckGenerator } from "./PitchDeckGenerator";

interface CustomerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  companyId?: string;
  enableFieldMaps?: boolean;
}

interface Customer {
  id: string;
  name: string;
  location?: string;
  industry?: string;
  website?: string;
  employee_count?: string;
  annual_revenue?: string;
  notes?: string;
  customer_since?: number;
  grower_history?: string;
  operation_details?: any;
  created_at: string;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  is_primary?: boolean;
  is_decision_maker?: boolean;
  notes?: string;
}

interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  value: number | null;
  expected_close_date: string | null;
  probability?: number;
  notes?: string;
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

export const CustomerDetailDialog = ({ open, onOpenChange, customerId, companyId, enableFieldMaps = false }: CustomerDetailDialogProps) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseSummary | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPitchDeck, setShowPitchDeck] = useState(false);

  useEffect(() => {
    if (open && customerId) {
      loadCustomerData();
    }
  }, [open, customerId]);

  const loadCustomerData = async () => {
    if (!customerId) return;
    setLoading(true);

    const [customerRes, contactsRes, dealsRes] = await Promise.all([
      supabase.from('sales_companies').select('*').eq('id', customerId).single(),
      supabase.from('sales_contacts').select('*').eq('company_id', customerId).order('is_primary', { ascending: false }),
      supabase.from('sales_deals').select('*').eq('company_id', customerId).order('created_at', { ascending: false }),
    ]);

    if (customerRes.data) {
      setCustomer(customerRes.data);
      // Fetch purchase history after we have customer name
      loadPurchaseHistory(customerRes.data.name);
    }
    if (contactsRes.data) setContacts(contactsRes.data);
    if (dealsRes.data) setDeals(dealsRes.data);
    
    setLoading(false);
  };

  const loadPurchaseHistory = async (customerName: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-customer-purchase-summary', {
        body: { customerName, companyId }
      });
      if (error) throw error;
      setPurchaseHistory(data);
    } catch (err) {
      console.error('Error loading purchase history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospecting: 'bg-blue-500',
      discovery: 'bg-purple-500',
      proposal: 'bg-amber-500',
      closing: 'bg-green-500',
      follow_up: 'bg-teal-500',
    };
    return colors[stage] || 'bg-gray-500';
  };

  const totalDealValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const activeDeals = deals.filter(d => d.stage !== 'follow_up');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {loading ? "Loading..." : customer?.name || "Customer Details"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : customer ? (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className={`grid w-full ${enableFieldMaps ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="deals">Deals</TabsTrigger>
              {enableFieldMaps && (
                <TabsTrigger value="fieldmaps" className="flex items-center gap-1">
                  <Map className="h-3 w-3" />
                  Field Maps
                </TabsTrigger>
              )}
              <TabsTrigger value="history" className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                Purchases
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="overview" className="mt-0 space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
                      <p className="text-lg font-bold">${totalDealValue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Pipeline</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <TrendingUp className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                      <p className="text-lg font-bold">{activeDeals.length}</p>
                      <p className="text-xs text-muted-foreground">Active Deals</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <Calendar className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                      <p className="text-lg font-bold">{customer.customer_since || '—'}</p>
                      <p className="text-xs text-muted-foreground">Customer Since</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Pitch Deck Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPitchDeck(true)}
                  className="w-full gap-2"
                >
                  <Presentation className="h-4 w-4" />
                  Create Product Pitch Deck
                </Button>

                {/* Details */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {customer.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.location}</span>
                      </div>
                    )}
                    {customer.industry && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.industry}</span>
                      </div>
                    )}
                    {customer.employee_count && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.employee_count} employees</span>
                      </div>
                    )}
                    {customer.annual_revenue && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.annual_revenue} annual revenue</span>
                      </div>
                    )}
                    {customer.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-muted-foreground">{customer.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Operation Details (for growers) */}
                {customer.operation_details && typeof customer.operation_details === 'object' && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Operation Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {(customer.operation_details as Record<string, any>).total_acres && (
                        <p><strong>Total Acres:</strong> {(customer.operation_details as Record<string, any>).total_acres}</p>
                      )}
                      {(customer.operation_details as Record<string, any>).crops && (
                        <p><strong>Crops:</strong> {JSON.stringify((customer.operation_details as Record<string, any>).crops)}</p>
                      )}
                      {(customer.operation_details as Record<string, any>).key_quote && (
                        <div className="mt-2 p-3 bg-muted rounded-lg italic">
                          "{(customer.operation_details as Record<string, any>).key_quote}"
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="contacts" className="mt-0 space-y-3">
                {contacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No contacts added yet</p>
                  </div>
                ) : (
                  contacts.map(contact => (
                    <Card key={contact.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{contact.name}</p>
                            {contact.role && <p className="text-sm text-muted-foreground">{contact.role}</p>}
                          </div>
                          <div className="flex gap-1">
                            {contact.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                            {contact.is_decision_maker && <Badge className="text-xs">Decision Maker</Badge>}
                          </div>
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                          {contact.notes && (
                            <p className="text-muted-foreground mt-2">{contact.notes}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="deals" className="mt-0 space-y-3">
                {deals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No deals yet</p>
                  </div>
                ) : (
                  deals.map(deal => (
                    <Card key={deal.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{deal.deal_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`h-2 w-2 rounded-full ${getStageColor(deal.stage)}`} />
                              <span className="text-sm text-muted-foreground capitalize">{deal.stage.replace('_', ' ')}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            {deal.value && (
                              <p className="font-bold text-green-600">${Number(deal.value).toLocaleString()}</p>
                            )}
                            {deal.expected_close_date && (
                              <p className="text-xs text-muted-foreground">
                                Close: {format(new Date(deal.expected_close_date), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                        {deal.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{deal.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {enableFieldMaps && (
                <TabsContent value="fieldmaps" className="mt-0">
                  {customerId && companyId && (
                    <FieldMapAnalyzer
                      customerId={customerId}
                      customerName={customer.name}
                      companyId={companyId}
                      customerContext={{
                        name: customer.name,
                        location: customer.location,
                        operationDetails: customer.operation_details,
                        crops: (customer.operation_details as Record<string, any>)?.crops 
                          ? JSON.stringify((customer.operation_details as Record<string, any>).crops)
                          : undefined,
                        totalAcres: (customer.operation_details as Record<string, any>)?.total_acres,
                      }}
                    />
                  )}
                </TabsContent>
              )}

              <TabsContent value="history" className="mt-0 space-y-4">
                {/* Purchase History from customer_purchase_history */}
                {loadingHistory ? (
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ) : purchaseHistory?.hasHistory ? (
                  <>
                    {/* Revenue Summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <Card>
                        <CardContent className="p-3 text-center">
                          <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
                          <p className="text-lg font-bold">{formatCurrency(purchaseHistory.totalRevenue)}</p>
                          <p className="text-xs text-muted-foreground">Total Revenue</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3 text-center">
                          <Package className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                          <p className="text-lg font-bold">{purchaseHistory.transactionCount}</p>
                          <p className="text-xs text-muted-foreground">Transactions</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3 text-center">
                          <TrendingUp className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                          <p className="text-lg font-bold">{purchaseHistory.seasons.length}</p>
                          <p className="text-xs text-muted-foreground">Seasons Active</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Products Purchased */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Products Purchased
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {purchaseHistory.topProducts.map((product, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
                            <span className="truncate flex-1 mr-2">{product.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{product.count} orders</span>
                              <span className="font-medium text-green-600">{formatCurrency(product.total)}</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Seasons */}
                    {purchaseHistory.seasons.length > 0 && (
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Seasons Active
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {purchaseHistory.seasons.map(season => (
                              <Badge key={season} variant="secondary">
                                {season}
                              </Badge>
                            ))}
                          </div>
                          {purchaseHistory.lastPurchaseDate && (
                            <p className="text-xs text-muted-foreground mt-3">
                              Last purchase: {new Date(purchaseHistory.lastPurchaseDate).toLocaleDateString()}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center py-4 text-muted-foreground">
                        <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No purchase history found</p>
                        <p className="text-xs mt-1">This appears to be a new prospect</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Relationship History (grower_history notes) */}
                {customer.grower_history && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Relationship Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap">
                        {customer.grower_history}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Customer not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
