import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format date nicely
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Generate personalized email content using AI
async function generatePersonalizedEmail(
  firstName: string,
  episodeTitle: string,
  topics: string[],
  script: string,
  dailyChallenge: string | null,
  streakDays: number | null,
  habitsCount: number
): Promise<{ subject: string; body: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not configured, using fallback template");
    return {
      subject: `Hey ${firstName}, your growth moment is ready`,
      body: generateFallbackBody(firstName, episodeTitle, topics, dailyChallenge)
    };
  }

  const systemPrompt = `You are Jericho, a warm, encouraging AI growth coach. You write personalized daily emails to professionals to help them grow.

Your voice is:
- Warm and personal (like a trusted mentor writing a letter)
- Encouraging but not cheesy or over-the-top
- Practical and actionable
- Conversational and human
- Brief but meaningful

You never use:
- Corporate jargon
- Excessive exclamation points
- Generic phrases like "I hope this email finds you well"
- Bullet points (write in flowing prose)

Format your response as JSON with two fields:
- "subject": A short, personal email subject line (max 60 chars, no emojis)
- "body": The email body in HTML format (use <p> tags, keep it 3-4 short paragraphs)`;

  const userPrompt = `Write today's growth email for ${firstName}.

Today's episode: "${episodeTitle}"
Topics covered: ${topics.join(', ')}
${dailyChallenge ? `Today's challenge: ${dailyChallenge}` : ''}
${streakDays ? `Their current streak: ${streakDays} days` : ''}
${habitsCount > 0 ? `Habits completed this week: ${habitsCount}` : ''}

Episode content summary:
${script.substring(0, 1500)}

Write a short, personalized email (like a letter from a coach) that:
1. Greets them warmly by name
2. Briefly introduces what they'll learn today
3. Gives them one key insight or teaser from the content
4. Encourages them to listen and mentions the challenge if there is one
5. Signs off warmly as Jericho

Keep it under 200 words. Make it feel like a personal note, not a newsletter.`;

  try {
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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        subject: parsed.subject || `Hey ${firstName}, your growth moment is ready`,
        body: parsed.body || generateFallbackBody(firstName, episodeTitle, topics, dailyChallenge)
      };
    }

    throw new Error("Could not parse AI response as JSON");
  } catch (error) {
    console.error("AI email generation error:", error);
    return {
      subject: `Hey ${firstName}, your growth moment is ready`,
      body: generateFallbackBody(firstName, episodeTitle, topics, dailyChallenge)
    };
  }
}

function generateFallbackBody(
  firstName: string,
  episodeTitle: string,
  topics: string[],
  dailyChallenge: string | null
): string {
  return `
    <p>Hey ${firstName},</p>
    <p>I've got something special for you today. Your personalized episode "${episodeTitle}" is ready, and I think you're going to find it really valuable.</p>
    <p>We're diving into ${topics.slice(0, 2).join(' and ')}${topics.length > 2 ? ' and more' : ''}. These are the exact skills that will help you level up right now.</p>
    ${dailyChallenge ? `<p>Today's challenge: ${dailyChallenge}. I know you can do this.</p>` : ''}
    <p>Take a few minutes to listen — your future self will thank you.</p>
    <p>Talk soon,<br/>Jericho</p>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, episodeDate } = await req.json();

    if (!profileId) {
      throw new Error("profileId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const today = episodeDate || new Date().toISOString().split('T')[0];

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, company_id")
      .eq("id", profileId)
      .single();

    if (profileError || !profile || !profile.email) {
      throw new Error("Profile not found or missing email");
    }

    // Fetch today's podcast episode
    const { data: episode, error: episodeError } = await supabase
      .from("podcast_episodes")
      .select("*")
      .eq("profile_id", profileId)
      .eq("episode_date", today)
      .single();

    if (episodeError || !episode) {
      throw new Error(`No podcast episode found for ${today}`);
    }

    // Fetch user preferences
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("brief_format")
      .eq("profile_id", profileId)
      .single();

    const briefFormat = prefs?.brief_format || 'both';

    // Fetch user stats
    const { data: streakData } = await supabase
      .from("profiles")
      .select("login_streak")
      .eq("id", profileId)
      .single();

    const { data: habitsThisWeek } = await supabase
      .from("habit_completions")
      .select("id")
      .eq("profile_id", profileId)
      .gte("completed_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const firstName = profile.full_name?.split(' ')[0] || 'there';
    const topics = episode.topics_covered || [];

    // Generate personalized email content using AI
    console.log("Generating personalized email for", firstName);
    const { subject, body: personalizedBody } = await generatePersonalizedEmail(
      firstName,
      episode.title,
      topics,
      episode.script || '',
      episode.daily_challenge,
      streakData?.login_streak,
      habitsThisWeek?.length || 0
    );

    // Build the app URL
    const appUrl = `https://aiihzjkspwsriktvrdle.lovableproject.com/dashboard`;

    // Build the on-brand Jericho email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f23; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0f0f23;">
    
    <!-- Header with Jericho branding -->
    <div style="padding: 40px 32px 24px 32px; text-align: center;">
      <div style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); -webkit-background-clip: text; background-clip: text;">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; color: #a855f7;">Jericho</h1>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 8px 0 0 0; letter-spacing: 0.5px;">${formatDate(new Date()).toUpperCase()}</p>
    </div>

    <!-- Main content card -->
    <div style="margin: 0 16px; background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%); border-radius: 16px; border: 1px solid #2a2a4a; overflow: hidden;">
      
      <!-- AI-generated personalized content -->
      <div style="padding: 32px; color: #e2e8f0; font-size: 16px; line-height: 1.7;">
        ${personalizedBody}
      </div>

      <!-- Listen button -->
      ${briefFormat !== 'text' ? `
      <div style="padding: 0 32px 32px 32px;">
        <a href="${appUrl}" style="display: block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
          🎧 Listen to Today's Episode
        </a>
      </div>
      ` : ''}

      <!-- Stats bar -->
      ${(streakData?.login_streak || habitsThisWeek?.length) ? `
      <div style="display: flex; border-top: 1px solid #2a2a4a;">
        ${streakData?.login_streak ? `
        <div style="flex: 1; padding: 20px; text-align: center; ${habitsThisWeek?.length ? 'border-right: 1px solid #2a2a4a;' : ''}">
          <div style="color: #a855f7; font-size: 28px; font-weight: 700;">${streakData.login_streak}</div>
          <div style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Day Streak</div>
        </div>
        ` : ''}
        ${habitsThisWeek?.length ? `
        <div style="flex: 1; padding: 20px; text-align: center;">
          <div style="color: #6366f1; font-size: 28px; font-weight: 700;">${habitsThisWeek.length}</div>
          <div style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Habits This Week</div>
        </div>
        ` : ''}
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="padding: 32px; text-align: center;">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0;">
        Reply to this email anytime — I read every message.
      </p>
      <a href="${appUrl}" style="color: #6366f1; font-size: 13px; text-decoration: none;">Update Preferences</a>
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    const rawFrom = Deno.env.get("RESEND_FROM");
    const cleanedFrom = (rawFrom || "").trim().replace(/^"|"$/g, "");
    const isBareEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedFrom);
    const fromAddress = cleanedFrom
      ? (isBareEmail ? `Jericho <${cleanedFrom}>` : cleanedFrom)
      : "Jericho <onboarding@resend.dev>";

    console.log("Sending email from:", fromAddress, "to:", profile.email);
    console.log("Subject:", subject);

    const emailResponse = await resend.emails.send({
      from: fromAddress,
      to: [profile.email],
      subject: subject,
      html: emailHtml,
    });

    // Handle Resend errors
    const resendError = (emailResponse as any)?.error;
    if (resendError) {
      console.error(`Resend error sending to ${profile.email}:`, resendError);

      await supabase.from("email_deliveries").insert({
        profile_id: profileId,
        company_id: profile.company_id,
        subject: subject,
        body: emailHtml,
        sent_at: new Date().toISOString(),
        status: 'failed',
        resources_included: {
          episodeId: episode.id,
          episodeDate: today,
          briefFormat,
          resendError,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          to: profile.email,
          subject: subject,
          error: resendError?.message || 'Email provider returned an error',
          statusCode: resendError?.statusCode,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Daily brief email sent to ${profile.email}:`, emailResponse);

    // Record delivery
    await supabase.from("email_deliveries").insert({
      profile_id: profileId,
      company_id: profile.company_id,
      subject: subject,
      body: emailHtml,
      sent_at: new Date().toISOString(),
      status: 'sent',
      resources_included: {
        episodeId: episode.id,
        episodeDate: today,
        briefFormat,
        aiGenerated: true,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailId: (emailResponse as any)?.data?.id || (emailResponse as any)?.id || 'sent',
        to: profile.email,
        subject: subject,
        from: fromAddress,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-daily-brief-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
