import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, LogOut, MousePointerClick, Calendar, DollarSign, TrendingUp, Handshake, CheckCircle2, Users, Target, ArrowLeft } from "lucide-react";

interface Partner {
  id: string;
  name: string;
  email: string;
  company: string | null;
  referral_code: string;
  commission_rate: number;
  status: string;
}

interface Lead {
  id: string;
  lead_email: string | null;
  lead_company: string | null;
  contact_name: string | null;
  status: string;
  deal_value: number | null;
  created_at: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
}

export default function PartnerDashboard() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const referralBaseUrl = "https://www.askjericho.com";
  const referralLink = partner ? `${referralBaseUrl}/?ref=${partner.referral_code}` : "";

  useEffect(() => {
    loadPartnerData();
  }, []);

  const generateReferralCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const loadPartnerData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/partner/login');
        return;
      }

      setUser(currentUser);

      // Load partner record
      const { data: partnerData, error: partnerError } = await supabase
        .from('referral_partners')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (partnerError) {
        console.error(partnerError);
        setLoading(false);
        return;
      }

      if (!partnerData) {
        // User is not a partner yet - they'll see the enrollment page
        setLoading(false);
        return;
      }

      setPartner(partnerData);

      // Load leads
      const { data: leadsData } = await supabase
        .from('referral_leads')
        .select('*')
        .eq('partner_id', partnerData.id)
        .order('created_at', { ascending: false });

      setLeads(leadsData || []);

      // Load payouts
      const { data: payoutsData } = await supabase
        .from('referral_payouts')
        .select('*')
        .eq('partner_id', partnerData.id)
        .order('created_at', { ascending: false });

      setPayouts(payoutsData || []);
    } catch (error) {
      console.error('Error loading partner data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!user) return;
    
    setEnrolling(true);
    try {
      const referralCode = generateReferralCode();
      const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Partner";

      const { error: enrollErr } = await supabase.from("referral_partners").insert({
        user_id: user.id,
        name: displayName,
        email: user.email,
        phone: null,
        company: null,
        referral_code: referralCode,
      });

      if (enrollErr) throw enrollErr;

      // Add partner role
      await supabase.from("user_roles").upsert(
        { user_id: user.id, role: "partner" },
        { onConflict: "user_id,role" }
      );

      toast({
        title: "Welcome to the Partner Program! 🎉",
        description: "You're now enrolled. Start sharing your referral link!",
      });

      // Reload to show the dashboard
      loadPartnerData();
    } catch (error: any) {
      toast({
        title: "Enrollment failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it with your network." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/partner/login');
  };

  // Calculate stats
  const clickCount = leads.length;
  const demoCount = leads.filter(l => ['demo_booked', 'trial', 'converted'].includes(l.status)).length;
  const convertedCount = leads.filter(l => l.status === 'converted').length;
  const totalEarnings = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingEarnings = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0);
  const paidEarnings = payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'clicked':
        return <Badge variant="outline" className="border-slate-500 text-slate-400">Clicked</Badge>;
      case 'demo_booked':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Demo Booked</Badge>;
      case 'trial':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">In Trial</Badge>;
      case 'converted':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Converted</Badge>;
      case 'churned':
        return <Badge variant="destructive">Churned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Show enrollment page for non-partners
  if (!partner && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Back button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard/my-growth-plan')}
            className="text-slate-400 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jericho
          </Button>

          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6">
              <Handshake className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-sm">Partner Program</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Help Leaders Grow. <span className="text-emerald-400">Get Rewarded.</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Earn <span className="text-emerald-400 font-semibold">10% commission</span> on every organization you refer to Jericho. Simple. Transparent. Lucrative.
            </p>
          </div>

          {/* Benefits */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur mb-8">
            <CardHeader>
              <CardTitle className="text-white">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Get Your Unique Link</h3>
                  <p className="text-slate-400 text-sm">Join with one click and receive your personal referral link instantly.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Share With Your Network</h3>
                  <p className="text-slate-400 text-sm">Send your link to leaders who need better clarity, accountability, and growth systems.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Earn 10% Commission</h3>
                  <p className="text-slate-400 text-sm">When they become a customer, you earn 10% of their first year. No cap on earnings.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <Button
              size="lg"
              onClick={handleEnroll}
              disabled={enrolling}
              className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6"
            >
              {enrolling ? (
                "Enrolling..."
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Join the Partner Program
                </>
              )}
            </Button>
            <p className="text-slate-500 text-sm mt-4">
              Joining as {user.email}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/my-growth-plan')}
              className="text-slate-400 hover:text-white"
              title="Back to Jericho"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Partner Dashboard</h1>
              <p className="text-slate-400">Welcome back, {partner?.name}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Referral Link Card */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              🎯 Your Referral Link
            </CardTitle>
            <CardDescription>Share this link to earn 10% commission on converted deals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <a 
                href={referralLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 bg-slate-700/50 border border-slate-600 rounded-md px-4 py-2 text-white font-mono text-sm overflow-x-auto hover:bg-slate-600/50 transition-colors cursor-pointer"
              >
                {referralLink}
              </a>
              <Button onClick={copyLink} className="bg-emerald-600 hover:bg-emerald-700">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700 rounded-lg">
                  <MousePointerClick className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{clickCount}</p>
                  <p className="text-xs text-slate-400">Clicks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{demoCount}</p>
                  <p className="text-xs text-slate-400">Demos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{convertedCount}</p>
                  <p className="text-xs text-slate-400">Converted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">${totalEarnings.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Total Earned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Earnings Breakdown */}
        {totalEarnings > 0 && (
          <Card className="border-slate-700 bg-slate-800/50 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-lg">💰 Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <div>
                  <p className="text-sm text-slate-400">Pending</p>
                  <p className="text-xl font-semibold text-amber-400">${pendingEarnings.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Paid</p>
                  <p className="text-xl font-semibold text-emerald-400">${paidEarnings.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Referrals Table */}
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white text-lg">📋 Your Referrals</CardTitle>
            <CardDescription>Track the status of people you've referred</CardDescription>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No referrals yet. Share your link to get started!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Company</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Contact</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Status</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Date</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-slate-400">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const commission = lead.status === 'converted' && lead.deal_value 
                        ? lead.deal_value * (partner?.commission_rate || 0.1) 
                        : null;
                      return (
                        <tr key={lead.id} className="border-b border-slate-700/50">
                          <td className="py-3 px-2 text-white">
                            {lead.lead_company || 'Unknown'}
                          </td>
                          <td className="py-3 px-2 text-slate-300 text-sm">
                            {lead.contact_name && lead.lead_email ? (
                              <div>
                                <div>{lead.contact_name}</div>
                                <div className="text-slate-500 text-xs">{lead.lead_email}</div>
                              </div>
                            ) : lead.contact_name || lead.lead_email || '-'}
                          </td>
                          <td className="py-3 px-2">{getStatusBadge(lead.status)}</td>
                          <td className="py-3 px-2 text-slate-400 text-sm">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {commission ? (
                              <span className="text-emerald-400 font-medium">${commission.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
