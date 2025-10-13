import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "npm:resend@4.0.0";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { GrowthEmail } from "./_templates/growth-email.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId } = await req.json();

    if (!profileId) {
      throw new Error("profileId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*, company_id")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    // Fetch employee capabilities with gaps
    const { data: capabilities } = await supabase
      .from("employee_capabilities")
      .select(`
        *,
        capability:capabilities(name, category)
      `)
      .eq("profile_id", profileId)
      .neq("current_level", "target_level")
      .order("priority");

    // Fetch 90-day targets
    const { data: targets } = await supabase
      .from("ninety_day_targets")
      .select("*")
      .eq("profile_id", profileId)
      .gte("target_quarter", new Date().toISOString().slice(0, 7))
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch habit completions from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: habits } = await supabase
      .from("leading_indicators")
      .select(`
        *,
        completions:habit_completions(completed_date)
      `)
      .eq("profile_id", profileId)
      .eq("is_active", true);

    // Fetch recent Jericho conversations
    const { data: conversations } = await supabase
      .from("conversations")
      .select(`
        id,
        messages:conversation_messages(role, content, created_at)
      `)
      .eq("profile_id", profileId)
      .gte("updated_at", sevenDaysAgo.toISOString())
      .order("updated_at", { ascending: false })
      .limit(3);

    // Fetch recommended resources
    const { data: recommendations } = await supabase
      .from("content_recommendations")
      .select(`
        *,
        resource:resources(id, title, description, url, content_type)
      `)
      .eq("profile_id", profileId)
      .eq("status", "pending")
      .order("match_score", { ascending: false })
      .limit(5);

    // Build context for AI
    const capabilitiesContext = capabilities?.map(c => ({
      name: c.capability?.name,
      category: c.capability?.category,
      currentLevel: c.current_level,
      targetLevel: c.target_level,
      priority: c.priority
    })) || [];

    const targetsContext = targets?.map(t => ({
      description: t.target_description,
      completed: t.is_completed,
      quarter: t.target_quarter
    })) || [];

    const habitsContext = habits?.map(h => {
      const recentCompletions = h.completions?.filter((c: any) => 
        new Date(c.completed_date) >= sevenDaysAgo
      ).length || 0;
      return {
        name: h.habit_name,
        currentStreak: h.current_streak,
        longestStreak: h.longest_streak,
        recentCompletions,
        frequency: h.target_frequency
      };
    }) || [];

    const conversationContext = conversations?.flatMap(c => 
      c.messages?.slice(-5).map((m: any) => ({
        role: m.role,
        content: m.content.slice(0, 200) // Truncate for context
      }))
    ) || [];

    const resourcesForEmail = recommendations?.slice(0, 5).map(r => ({
      title: r.resource?.title || "Resource",
      description: r.resource?.description || "",
      url: r.resource?.url || "#",
      type: r.resource?.content_type || "article",
      reasoning: r.ai_reasoning || ""
    })) || [];

    // Generate email content via Lovable AI
    const systemPrompt = `You are Jericho, a firm but encouraging executive coach writing a daily growth email. 

TONE: Personal, specific, and actionable. Be direct but supportive - like a coach who believes in them but won't let them coast.

STRUCTURE YOUR RESPONSE AS JSON:
{
  "subject": "Personalized subject line referencing something specific",
  "openingMessage": "1-2 sentences acknowledging something recent or specific",
  "mainContent": "2-3 paragraphs addressing their growth journey, acknowledging wins, addressing gaps, connecting to bigger vision",
  "actionableChallenge": "One clear, specific action they should take today/this week",
  "closingMessage": "Encouraging but firm closing statement"
}

RULES:
- Reference actual data (habit streaks, targets, capability gaps, conversation themes)
- Be specific, not generic
- Celebrate wins authentically
- Address struggles without being soft
- Connect daily actions to long-term vision
- Keep it conversational but professional
- No fluff or motivational poster talk`;

    const userPrompt = `Generate a personalized growth email for ${profile.full_name || "this employee"}.

THEIR CURRENT STATUS:
Capability Gaps: ${JSON.stringify(capabilitiesContext)}
90-Day Targets: ${JSON.stringify(targetsContext)}
Habit Progress (last 7 days): ${JSON.stringify(habitsContext)}
Recent Conversation Themes: ${JSON.stringify(conversationContext)}

Resources to include in "Your Growth Playlist":
${JSON.stringify(resourcesForEmail)}

Generate the email content now.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const emailContent = JSON.parse(aiData.choices[0].message.content);

    // Render email HTML
    const html = await renderAsync(
      React.createElement(GrowthEmail, {
        userName: profile.full_name || "there",
        subject: emailContent.subject,
        openingMessage: emailContent.openingMessage,
        mainContent: emailContent.mainContent,
        actionableChallenge: emailContent.actionableChallenge,
        resources: resourcesForEmail,
        closingMessage: emailContent.closingMessage,
      })
    );

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Jericho <jericho@resend.dev>",
      to: [profile.email],
      subject: emailContent.subject,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw emailError;
    }

    // Log email delivery
    const { error: logError } = await supabase
      .from("email_deliveries")
      .insert({
        profile_id: profileId,
        company_id: profile.company_id,
        subject: emailContent.subject,
        body: html,
        status: "sent",
        resources_included: resourcesForEmail,
      });

    if (logError) {
      console.error("Failed to log email delivery:", logError);
    }

    console.log(`Growth email sent to ${profile.email}`, emailData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailData?.id,
        subject: emailContent.subject 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-growth-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
