import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, DollarSign, Users, TrendingUp, MousePointerClick } from "lucide-react";

interface Partner {
  id: string;
  name: string;
  email: string;
  company: string | null;
  referral_code: string;
  commission_rate: number;
  status: string;
  created_at: string;
}

interface Lead {
  id: string;
  partner_id: string;
  lead_email: string | null;
  lead_company: string | null;
  status: string;
  deal_value: number | null;
  converted_at: string | null;
  created_at: string;
}

interface Payout {
  id: string;
  partner_id: string;
  lead_id: string;
  amount: number;
  status: string;
  paid_at: string | null;
}

export default function ReferralAdminTab() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [updateLeadOpen, setUpdateLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newPartner, setNewPartner] = useState({ name: '', email: '', company: '' });
  const [leadUpdate, setLeadUpdate] = useState({ status: '', deal_value: '' });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [partnersRes, leadsRes, payoutsRes] = await Promise.all([
        supabase.from('referral_partners').select('*').order('created_at', { ascending: false }),
        supabase.from('referral_leads').select('*').order('created_at', { ascending: false }),
        supabase.from('referral_payouts').select('*').order('created_at', { ascending: false }),
      ]);

      setPartners(partnersRes.data || []);
      setLeads(leadsRes.data || []);
      setPayouts(payoutsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.email) {
      toast({ title: "Error", description: "Name and email are required", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from('referral_partners').insert({
        name: newPartner.name,
        email: newPartner.email,
        company: newPartner.company || null,
        referral_code: generateCode(),
        user_id: null, // Manual partner without login
      });

      if (error) throw error;

      toast({ title: "Partner added", description: "They can start referring immediately." });
      setNewPartner({ name: '', email: '', company: '' });
      setAddPartnerOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    try {
      const updates: any = { status: leadUpdate.status };
      if (leadUpdate.deal_value) {
        updates.deal_value = parseFloat(leadUpdate.deal_value);
      }
      if (leadUpdate.status === 'converted') {
        updates.converted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('referral_leads')
        .update(updates)
        .eq('id', selectedLead.id);

      if (error) throw error;

      // If converted with deal value, create payout record
      if (leadUpdate.status === 'converted' && leadUpdate.deal_value) {
        const partner = partners.find(p => p.id === selectedLead.partner_id);
        const commission = parseFloat(leadUpdate.deal_value) * (partner?.commission_rate || 0.1);
        
        await supabase.from('referral_payouts').insert({
          partner_id: selectedLead.partner_id,
          lead_id: selectedLead.id,
          amount: commission,
          status: 'pending',
        });
      }

      toast({ title: "Lead updated" });
      setUpdateLeadOpen(false);
      setSelectedLead(null);
      setLeadUpdate({ status: '', deal_value: '' });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleMarkPaid = async (payoutId: string) => {
    try {
      const { error } = await supabase
        .from('referral_payouts')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payoutId);

      if (error) throw error;
      toast({ title: "Marked as paid" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Calculate stats
  const totalClicks = leads.length;
  const totalDemos = leads.filter(l => ['demo_booked', 'trial', 'converted'].includes(l.status)).length;
  const totalConverted = leads.filter(l => l.status === 'converted').length;
  const totalOwed = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0);

  const getPartnerStats = (partnerId: string) => {
    const partnerLeads = leads.filter(l => l.partner_id === partnerId);
    const partnerPayouts = payouts.filter(p => p.partner_id === partnerId);
    return {
      clicks: partnerLeads.length,
      demos: partnerLeads.filter(l => ['demo_booked', 'trial', 'converted'].includes(l.status)).length,
      conversions: partnerLeads.filter(l => l.status === 'converted').length,
      owed: partnerPayouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0),
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'clicked':
        return <Badge variant="outline">Clicked</Badge>;
      case 'demo_booked':
        return <Badge className="bg-blue-500/20 text-blue-600">Demo</Badge>;
      case 'trial':
        return <Badge className="bg-amber-500/20 text-amber-600">Trial</Badge>;
      case 'converted':
        return <Badge className="bg-emerald-500/20 text-emerald-600">Converted</Badge>;
      case 'churned':
        return <Badge variant="destructive">Churned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-4">Loading referral data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{partners.length}</p>
                <p className="text-sm text-muted-foreground">Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MousePointerClick className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalClicks}</p>
                <p className="text-sm text-muted-foreground">Total Clicks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{totalConverted}</p>
                <p className="text-sm text-muted-foreground">Conversions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">${totalOwed.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Owed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partners Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Partners</CardTitle>
            <CardDescription>Manage your referral partners</CardDescription>
          </div>
          <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Partner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Partner Manually</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newPartner.name}
                    onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                    placeholder="john@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company (Optional)</Label>
                  <Input
                    value={newPartner.company}
                    onChange={(e) => setNewPartner({ ...newPartner, company: e.target.value })}
                    placeholder="Acme Corp"
                  />
                </div>
                <Button onClick={handleAddPartner} className="w-full">Add Partner</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Partner</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Code</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Clicks</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Demos</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Converts</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Owed</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => {
                  const stats = getPartnerStats(partner.id);
                  return (
                    <tr key={partner.id} className="border-b">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{partner.name}</p>
                          <p className="text-sm text-muted-foreground">{partner.company || partner.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm">{partner.referral_code}</code>
                      </td>
                      <td className="py-3 px-2 text-center">{stats.clicks}</td>
                      <td className="py-3 px-2 text-center">{stats.demos}</td>
                      <td className="py-3 px-2 text-center">{stats.conversions}</td>
                      <td className="py-3 px-2 text-right font-medium">
                        {stats.owed > 0 ? (
                          <span className="text-amber-600">${stats.owed.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">$0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {partners.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No partners yet. Add one or share your registration link.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Leads Section */}
      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
          <CardDescription>Track referred leads and update their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Lead</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Referred By</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Deal Value</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const partner = partners.find(p => p.id === lead.partner_id);
                  return (
                    <tr key={lead.id} className="border-b">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{lead.lead_company || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{lead.lead_email || 'No email'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-sm">{partner?.name || 'Unknown'}</td>
                      <td className="py-3 px-2">{getStatusBadge(lead.status)}</td>
                      <td className="py-3 px-2 text-right">
                        {lead.deal_value ? `$${Number(lead.deal_value).toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedLead(lead);
                            setLeadUpdate({ status: lead.status, deal_value: lead.deal_value?.toString() || '' });
                            setUpdateLeadOpen(true);
                          }}
                        >
                          Update
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No leads yet. They'll appear when someone clicks a referral link.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Update Lead Dialog */}
      <Dialog open={updateLeadOpen} onOpenChange={setUpdateLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={leadUpdate.status} onValueChange={(v) => setLeadUpdate({ ...leadUpdate, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clicked">Clicked</SelectItem>
                  <SelectItem value="demo_booked">Demo Booked</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deal Value (Annual)</Label>
              <Input
                type="number"
                value={leadUpdate.deal_value}
                onChange={(e) => setLeadUpdate({ ...leadUpdate, deal_value: e.target.value })}
                placeholder="4800"
              />
              <p className="text-xs text-muted-foreground">
                Commission will be calculated at 10% when converted
              </p>
            </div>
            <Button onClick={handleUpdateLead} className="w-full">Update Lead</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Payouts */}
      {payouts.filter(p => p.status === 'pending').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Payouts</CardTitle>
            <CardDescription>Commission payments waiting to be sent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payouts.filter(p => p.status === 'pending').map((payout) => {
                const partner = partners.find(p => p.id === payout.partner_id);
                const lead = leads.find(l => l.id === payout.lead_id);
                return (
                  <div key={payout.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{partner?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        For: {lead?.lead_company || 'Unknown'} - ${Number(payout.amount).toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => handleMarkPaid(payout.id)}>
                      Mark Paid
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
