import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    console.log("Generating team insights for manager:", user.id);

    // Get manager's team members
    const { data: assignments, error: assignError } = await supabaseClient
      .from("manager_assignments")
      .select("employee_id")
      .eq("manager_id", user.id);

    if (assignError) throw assignError;

    const employeeIds = assignments?.map((a) => a.employee_id) || [];

    if (employeeIds.length === 0) {
      return new Response(
        JSON.stringify({
          insights: [],
          message: "No team members found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Found", employeeIds.length, "team members");

    // Gather comprehensive team data
    const { data: diagnostics } = await supabaseClient
      .from("diagnostic_responses")
      .select("*")
      .in("profile_id", employeeIds);

    const { data: capabilities } = await supabaseClient
      .from("employee_capabilities")
      .select("*, capabilities(*)")
      .in("profile_id", employeeIds);

    const { data: goals } = await supabaseClient
      .from("ninety_day_targets")
      .select("*")
      .in("profile_id", employeeIds);

    const { data: oneOnOnes } = await supabaseClient
      .from("one_on_one_notes")
      .select("*")
      .in("employee_id", employeeIds)
      .order("meeting_date", { ascending: false })
      .limit(10);

    const { data: pendingRequests } = await supabaseClient
      .from("capability_level_requests")
      .select("*")
      .in("profile_id", employeeIds)
      .eq("status", "pending");

    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("id, full_name, role")
      .in("id", employeeIds);

    const { data: habits } = await supabaseClient
      .from("leading_indicators")
      .select("profile_id, habit_name, current_streak, longest_streak, is_active")
      .in("profile_id", employeeIds)
      .eq("is_active", true);

    const { data: habitCompletions } = await supabaseClient
      .from("habit_completions")
      .select("profile_id, completed_date")
      .in("profile_id", employeeIds);

    // Build context for AI
    const teamContext = {
      teamSize: employeeIds.length,
      diagnosticsCompleted: diagnostics?.length || 0,
      totalCapabilities: capabilities?.length || 0,
      totalGoals: goals?.length || 0,
      completedGoals: goals?.filter((g) => g.completed).length || 0,
      recentOneOnOnes: oneOnOnes?.length || 0,
      pendingCapabilityRequests: pendingRequests?.length || 0,
      profiles: profiles?.map((p) => ({ name: p.full_name, role: p.role })),
      diagnosticSummary: diagnostics?.map((d) => ({
        burnoutFrequency: d.burnout_frequency,
        dailyEnergyLevel: d.daily_energy_level,
        managerSupportQuality: d.manager_support_quality,
        learningMotivation: d.learning_motivation,
        seesGrowthPath: d.sees_growth_path,
        feelsValued: d.feels_valued,
        roleClarity: d.role_clarity_score,
        workLifeIntegration: d.work_life_integration_score,
        confidenceScore: d.confidence_score,
      })),
      capabilitySummary: {
        foundational: capabilities?.filter((c) => c.current_level === "foundational").length || 0,
        developing: capabilities?.filter((c) => c.current_level === "developing").length || 0,
        proficient: capabilities?.filter((c) => c.current_level === "proficient").length || 0,
        advanced: capabilities?.filter((c) => c.current_level === "advanced").length || 0,
      },
      habitsSummary: {
        totalActiveHabits: habits?.length || 0,
        employeesWithHabits: new Set(habits?.map((h) => h.profile_id)).size,
        avgCurrentStreak: habits?.length ? Math.round(habits.reduce((sum, h) => sum + h.current_streak, 0) / habits.length) : 0,
        bestStreak: habits?.length ? Math.max(...habits.map((h) => h.current_streak)) : 0,
        recentCompletions: habitCompletions?.filter((hc) => {
          const completionDate = new Date(hc.completed_date);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return completionDate >= sevenDaysAgo;
        }).length || 0,
      },
    };

    console.log("Team context prepared:", teamContext);

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are an expert organizational development coach and people analytics specialist. Analyze the team data provided and generate 3-5 actionable insights for the manager.

For each insight, provide:
- type: "warning" (concerns/risks), "opportunity" (growth potential), or "strength" (what's working well)
- title: Brief, clear headline (max 6 words)
- description: One sentence explaining the insight
- actionable: Specific, tactical advice the manager can act on immediately

Focus on:
- Burnout and engagement patterns
- Learning and development opportunities
- Goal completion trends
- Team capability gaps
- Daily consistency and habit tracking (Greatness Tracker data)
- 1-on-1 meeting frequency and quality
- Manager effectiveness indicators
- Team capability development
- Goal achievement patterns
- Areas needing immediate attention

Be specific, data-driven, and actionable. Prioritize insights that have the biggest impact on team performance and wellbeing.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze this team data and generate insights:\n\n${JSON.stringify(teamContext, null, 2)}`,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Please contact support.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices?.[0]?.message?.content;

    console.log("AI response received:", aiContent?.substring(0, 200));

    // Parse AI response to extract structured insights
    let insights = [];
    try {
      // Try to parse as JSON first
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: parse as text format
        insights = [
          {
            type: "opportunity",
            title: "AI Insights Generated",
            description: aiContent,
            actionable: "Review the AI-generated analysis and take appropriate action.",
          },
        ];
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      insights = [
        {
          type: "opportunity",
          title: "AI Analysis Complete",
          description: aiContent?.substring(0, 200) || "Analysis completed successfully",
          actionable: "Review the detailed insights and recommendations provided.",
        },
      ];
    }

    return new Response(
      JSON.stringify({
        insights,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-team-insights:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
