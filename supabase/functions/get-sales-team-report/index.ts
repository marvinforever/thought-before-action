import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DirectReport {
  employee_id: string;
  full_name: string;
}

interface CallPlanRecord {
  profile_id: string;
  customer_name: string;
  call_1_completed: boolean | null;
  call_2_completed: boolean | null;
  call_3_completed: boolean | null;
  call_4_completed: boolean | null;
  call_1_notes: string | null;
  call_2_notes: string | null;
  call_3_notes: string | null;
  call_4_notes: string | null;
  total_revenue: number | null;
  updated_at: string | null;
}

interface SalesDeal {
  profile_id: string;
  stage: string;
  value: number | null;
  created_at: string;
  last_activity_at: string | null;
}

interface CoachingConversation {
  profile_id: string;
  title: string | null;
  created_at: string;
  message_count?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body for optional filters
    const body = await req.json().catch(() => ({}));
    const { viewAsCompanyId, viewAsUserId } = body;

    // Check if user is super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin, company_id")
      .eq("id", user.id)
      .single();

    const isSuperAdmin = profile?.is_super_admin === true;

    // Determine which company to query
    let targetCompanyId = profile?.company_id;
    if (isSuperAdmin && viewAsCompanyId) {
      targetCompanyId = viewAsCompanyId;
    }

    if (!targetCompanyId) {
      return new Response(JSON.stringify({ error: "No company context" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get direct reports for the manager (or all users if super admin viewing a company)
    let directReportIds: string[] = [];
    let directReports: DirectReport[] = [];

    if (isSuperAdmin && viewAsCompanyId) {
      // Super admin viewing a company - get all users in that company
      if (viewAsUserId) {
        // Viewing specific user
        const { data: specificUser } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", viewAsUserId)
          .single();
        
        if (specificUser) {
          directReports = [{ employee_id: specificUser.id, full_name: specificUser.full_name || "Unknown" }];
          directReportIds = [specificUser.id];
        }
      } else {
        // Get all users in the company
        const { data: companyUsers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("company_id", viewAsCompanyId);
        
        if (companyUsers) {
          directReports = companyUsers.map(u => ({ 
            employee_id: u.id, 
            full_name: u.full_name || "Unknown" 
          }));
          directReportIds = companyUsers.map(u => u.id);
        }
      }
    } else {
      // Check if user is a manager via user_roles and get their direct reports
      const { data: managerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["manager", "admin", "super_admin"])
        .limit(1);

      if (!managerRole || managerRole.length === 0) {
        return new Response(JSON.stringify({ error: "Not authorized - no manager role" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get direct reports from manager_assignments
      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select(`
          employee_id,
          profiles!manager_assignments_employee_id_fkey(full_name)
        `)
        .eq("manager_id", user.id);

      if (assignments && assignments.length > 0) {
        directReports = assignments.map(a => ({
          employee_id: a.employee_id,
          full_name: (a.profiles as any)?.full_name || "Unknown"
        }));
        directReportIds = assignments.map(a => a.employee_id);
      }
    }

    if (directReportIds.length === 0) {
      return new Response(JSON.stringify({
        directReports: [],
        fourCallProgress: [],
        pipelineSummary: [],
        coachingEngagement: [],
        overview: {
          activeSellers: 0,
          totalPipelineValue: 0,
          avgFourCallCompletion: 0,
          coachingSessions: 0,
          lastActivity: null,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all data in parallel
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const currentYear = new Date().getFullYear();

    const [callPlanResult, dealsResult, conversationsResult, messagesResult] = await Promise.all([
      // 4-Call tracking data
      supabase
        .from("call_plan_tracking")
        .select("profile_id, customer_name, call_1_completed, call_2_completed, call_3_completed, call_4_completed, call_1_notes, call_2_notes, call_3_notes, call_4_notes, total_revenue, updated_at")
        .in("profile_id", directReportIds)
        .eq("plan_year", currentYear),
      
      // Sales deals
      supabase
        .from("sales_deals")
        .select("profile_id, stage, value, created_at, last_activity_at")
        .in("profile_id", directReportIds),
      
      // Coaching conversations (last 30 days)
      supabase
        .from("sales_coach_conversations")
        .select("id, profile_id, title, created_at")
        .in("profile_id", directReportIds)
        .gte("created_at", thirtyDaysAgo.toISOString()),
      
      // Message counts per conversation
      supabase
        .from("sales_coach_messages")
        .select("conversation_id")
        .gte("created_at", thirtyDaysAgo.toISOString()),
    ]);

    const callPlanData = (callPlanResult.data || []) as CallPlanRecord[];
    const dealsData = (dealsResult.data || []) as SalesDeal[];
    const conversationsData = (conversationsResult.data || []) as (CoachingConversation & { id: string })[];
    const messagesData = messagesResult.data || [];

    // Count messages per conversation
    const messageCountMap = new Map<string, number>();
    for (const msg of messagesData) {
      const count = messageCountMap.get(msg.conversation_id) || 0;
      messageCountMap.set(msg.conversation_id, count + 1);
    }

    // Build 4-Call progress by rep
    const fourCallProgressByRep = new Map<string, {
      customersTracked: number;
      call1Complete: number;
      call2Complete: number;
      call3Complete: number;
      call4Complete: number;
      totalCustomers: number;
      customers: Array<{
        customerName: string;
        call1: boolean;
        call2: boolean;
        call3: boolean;
        call4: boolean;
        revenue: number;
        notes: { call1: string | null; call2: string | null; call3: string | null; call4: string | null };
      }>;
    }>();

    for (const record of callPlanData) {
      if (!fourCallProgressByRep.has(record.profile_id)) {
        fourCallProgressByRep.set(record.profile_id, {
          customersTracked: 0,
          call1Complete: 0,
          call2Complete: 0,
          call3Complete: 0,
          call4Complete: 0,
          totalCustomers: 0,
          customers: [],
        });
      }
      const repData = fourCallProgressByRep.get(record.profile_id)!;
      repData.totalCustomers++;
      if (record.call_1_completed) repData.call1Complete++;
      if (record.call_2_completed) repData.call2Complete++;
      if (record.call_3_completed) repData.call3Complete++;
      if (record.call_4_completed) repData.call4Complete++;
      
      repData.customers.push({
        customerName: record.customer_name,
        call1: record.call_1_completed || false,
        call2: record.call_2_completed || false,
        call3: record.call_3_completed || false,
        call4: record.call_4_completed || false,
        revenue: record.total_revenue || 0,
        notes: {
          call1: record.call_1_notes,
          call2: record.call_2_notes,
          call3: record.call_3_notes,
          call4: record.call_4_notes,
        }
      });
    }

    // Build pipeline summary by rep
    const pipelineByRep = new Map<string, {
      totalValue: number;
      dealCount: number;
      byStage: Record<string, { count: number; value: number }>;
      staleDeals: number;
      lastActivity: string | null;
    }>();

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    for (const deal of dealsData) {
      if (!pipelineByRep.has(deal.profile_id)) {
        pipelineByRep.set(deal.profile_id, {
          totalValue: 0,
          dealCount: 0,
          byStage: {},
          staleDeals: 0,
          lastActivity: null,
        });
      }
      const repData = pipelineByRep.get(deal.profile_id)!;
      repData.totalValue += deal.value || 0;
      repData.dealCount++;
      
      if (!repData.byStage[deal.stage]) {
        repData.byStage[deal.stage] = { count: 0, value: 0 };
      }
      repData.byStage[deal.stage].count++;
      repData.byStage[deal.stage].value += deal.value || 0;

      // Check for stale deals
      const lastActivity = deal.last_activity_at || deal.created_at;
      if (new Date(lastActivity) < fourteenDaysAgo) {
        repData.staleDeals++;
      }

      // Track last activity
      if (!repData.lastActivity || new Date(lastActivity) > new Date(repData.lastActivity)) {
        repData.lastActivity = lastActivity;
      }
    }

    // Build coaching engagement by rep
    const coachingByRep = new Map<string, {
      conversationCount: number;
      totalMessages: number;
      lastSession: string | null;
      topics: string[];
    }>();

    for (const conv of conversationsData) {
      if (!coachingByRep.has(conv.profile_id)) {
        coachingByRep.set(conv.profile_id, {
          conversationCount: 0,
          totalMessages: 0,
          lastSession: null,
          topics: [],
        });
      }
      const repData = coachingByRep.get(conv.profile_id)!;
      repData.conversationCount++;
      repData.totalMessages += messageCountMap.get(conv.id) || 0;
      
      if (conv.title) {
        repData.topics.push(conv.title);
      }
      
      if (!repData.lastSession || new Date(conv.created_at) > new Date(repData.lastSession)) {
        repData.lastSession = conv.created_at;
      }
    }

    // Build response arrays
    const fourCallProgress = directReports.map(dr => {
      const data = fourCallProgressByRep.get(dr.employee_id);
      const total = data?.totalCustomers || 0;
      return {
        repId: dr.employee_id,
        repName: dr.full_name,
        customersTracked: total,
        call1Pct: total > 0 ? Math.round((data?.call1Complete || 0) / total * 100) : 0,
        call2Pct: total > 0 ? Math.round((data?.call2Complete || 0) / total * 100) : 0,
        call3Pct: total > 0 ? Math.round((data?.call3Complete || 0) / total * 100) : 0,
        call4Pct: total > 0 ? Math.round((data?.call4Complete || 0) / total * 100) : 0,
        overallPct: total > 0 ? Math.round(((data?.call1Complete || 0) + (data?.call2Complete || 0) + (data?.call3Complete || 0) + (data?.call4Complete || 0)) / (total * 4) * 100) : 0,
        customers: data?.customers || [],
      };
    });

    const pipelineSummary = directReports.map(dr => {
      const data = pipelineByRep.get(dr.employee_id);
      return {
        repId: dr.employee_id,
        repName: dr.full_name,
        totalValue: data?.totalValue || 0,
        dealCount: data?.dealCount || 0,
        byStage: data?.byStage || {},
        staleDeals: data?.staleDeals || 0,
        lastActivity: data?.lastActivity,
      };
    });

    const coachingEngagement = directReports.map(dr => {
      const data = coachingByRep.get(dr.employee_id);
      return {
        repId: dr.employee_id,
        repName: dr.full_name,
        conversationCount: data?.conversationCount || 0,
        totalMessages: data?.totalMessages || 0,
        avgMessagesPerConversation: data?.conversationCount 
          ? Math.round(data.totalMessages / data.conversationCount) 
          : 0,
        lastSession: data?.lastSession,
        topics: data?.topics || [],
      };
    }).sort((a, b) => b.conversationCount - a.conversationCount);

    // Calculate overview metrics
    const activeSellers = new Set([
      ...callPlanData.map(c => c.profile_id),
      ...dealsData.map(d => d.profile_id),
      ...conversationsData.map(c => c.profile_id),
    ]).size;

    const totalPipelineValue = dealsData.reduce((sum, d) => sum + (d.value || 0), 0);
    
    const totalCalls = callPlanData.length * 4;
    const completedCalls = callPlanData.reduce((sum, c) => 
      sum + (c.call_1_completed ? 1 : 0) + (c.call_2_completed ? 1 : 0) + 
      (c.call_3_completed ? 1 : 0) + (c.call_4_completed ? 1 : 0), 0);
    const avgFourCallCompletion = totalCalls > 0 ? Math.round(completedCalls / totalCalls * 100) : 0;

    const coachingSessions = conversationsData.length;

    // Find last activity across all data
    let lastActivity: string | null = null;
    for (const deal of dealsData) {
      const activity = deal.last_activity_at || deal.created_at;
      if (!lastActivity || new Date(activity) > new Date(lastActivity)) {
        lastActivity = activity;
      }
    }
    for (const conv of conversationsData) {
      if (!lastActivity || new Date(conv.created_at) > new Date(lastActivity)) {
        lastActivity = conv.created_at;
      }
    }

    return new Response(JSON.stringify({
      directReports,
      fourCallProgress,
      pipelineSummary,
      coachingEngagement,
      overview: {
        activeSellers,
        totalPipelineValue,
        avgFourCallCompletion,
        coachingSessions,
        lastActivity,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in get-sales-team-report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
