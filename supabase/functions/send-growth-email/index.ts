import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
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

    // Build email HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f6f9fc; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="padding: 40px;">
      <h1 style="color: #1a1a1a; font-size: 24px; font-weight: bold; margin: 0 0 24px 0;">${emailContent.subject}</h1>
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi ${profile.full_name || 'there'},</p>
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">${emailContent.openingMessage}</p>
      
      <div style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">${emailContent.mainContent.replace(/\n/g, '<br>')}</div>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h2 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">🎯 This Week's Challenge</h2>
        <p style="color: #ffffff; font-size: 15px; line-height: 1.6; margin: 0;">${emailContent.actionableChallenge}</p>
      </div>
      
      ${resourcesForEmail.length > 0 ? `
      <div style="margin: 32px 0;">
        <h2 style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin: 0 0 20px 0;">📚 Curated Resources for You</h2>
        ${resourcesForEmail.map(resource => `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          <div style="color: #667eea; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${resource.type}</div>
          <h3 style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${resource.title}</h3>
          <p style="color: #4a5568; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">${resource.description}</p>
          <a href="${resource.url}" style="color: #667eea; text-decoration: none; font-size: 14px; font-weight: 500;">View Resource →</a>
        </div>
        `).join('')}
      </div>
      ` : ''}
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 24px 0;">${emailContent.closingMessage}</p>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">Keep growing,<br><strong>Your Growth Team</strong></p>
        <div style="margin-top: 20px;">
          <a href="${supabaseUrl}" style="display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px; margin-right: 12px;">View Dashboard</a>
          <a href="${supabaseUrl}" style="color: #667eea; text-decoration: none; font-size: 14px;">Email Preferences</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Send email via Resend API directly
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jericho <onboarding@resend.dev>",
        to: [profile.email],
        subject: emailContent.subject,
        html: html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", resendResponse.status, errorText);
      throw new Error(`Email sending failed: ${resendResponse.status}`);
    }

    const emailData = await resendResponse.json();

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
