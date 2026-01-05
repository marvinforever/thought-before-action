import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get day name with optional greeting context
function getDayGreeting(): { day: string; greeting: string } {
  const now = new Date();
  const hour = now.getHours();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = days[now.getDay()];
  
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  if (hour >= 17) greeting = 'Good evening';
  
  return { day, greeting };
}

// Format date nicely
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Inspirational quotes for variety
const QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Growth is never by mere chance; it is the result of forces working together.", author: "James Cash Penney" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Your limitation—it's only your imagination.", author: "Unknown" },
  { text: "Great things never came from comfort zones.", author: "Unknown" },
  { text: "Dream it. Wish it. Do it.", author: "Unknown" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
];

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

    // Fetch user stats for the email
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

    // Get a random quote
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    // Parse topics from episode
    const topics = episode.topics_covered || [];
    const topicsHtml = topics.length > 0 
      ? topics.map((t: string) => `<li style="margin-bottom: 8px; color: #4a5568;">${t}</li>`).join('')
      : '<li style="color: #718096;">Your personalized growth insights</li>';

    // Extract a brief summary from the script (first few sentences)
    const scriptLines = episode.script?.split('\n').filter((l: string) => l.trim()) || [];
    const summaryText = scriptLines.slice(0, 3).join(' ').substring(0, 300) + '...';

    const { day, greeting } = getDayGreeting();
    const firstName = profile.full_name?.split(' ')[0] || 'there';

    // Build the app URL for listening
    const appUrl = `https://aiihzjkspwsriktvrdle.lovableproject.com/dashboard`;

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 40px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0;">Your Growth Brief</h1>
      <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 8px 0 0 0;">${formatDate(new Date())}</p>
    </div>

    <div style="padding: 40px;">
      <!-- Greeting -->
      <p style="color: #2d3748; font-size: 18px; margin: 0 0 24px 0;">${greeting}, ${firstName}!</p>
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
        Your personalized daily brief is ready. Take a few minutes to invest in your growth today.
      </p>

      <!-- Episode Card -->
      <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #e2e8f0;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 32px;">🎧</span>
          <div>
            <h2 style="color: #2d3748; font-size: 18px; font-weight: 600; margin: 0;">${episode.title}</h2>
            <p style="color: #718096; font-size: 14px; margin: 4px 0 0 0;">
              ${episode.duration_seconds ? Math.ceil(episode.duration_seconds / 60) : 3} min listen
            </p>
          </div>
        </div>
        
        ${briefFormat !== 'text' ? `
        <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; width: 100%; box-sizing: border-box;">
          ▶️ Listen Now
        </a>
        ` : ''}
      </div>

      <!-- What's Covered -->
      <h3 style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">📋 What We're Covering:</h3>
      <ul style="margin: 0 0 32px 0; padding-left: 20px;">
        ${topicsHtml}
      </ul>

      ${episode.daily_challenge ? `
      <!-- Daily Challenge -->
      <div style="background-color: #faf5ff; border-left: 4px solid #9f7aea; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 32px;">
        <h3 style="color: #553c9a; font-size: 14px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px 0;">💪 Today's Challenge</h3>
        <p style="color: #44337a; font-size: 16px; line-height: 1.5; margin: 0;">${episode.daily_challenge}</p>
      </div>
      ` : ''}

      <!-- Stats -->
      <div style="display: flex; gap: 16px; margin-bottom: 32px;">
        ${streakData?.login_streak ? `
        <div style="flex: 1; background-color: #f7fafc; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="color: #667eea; font-size: 24px; font-weight: bold;">${streakData.login_streak}</div>
          <div style="color: #718096; font-size: 12px;">Day Streak</div>
        </div>
        ` : ''}
        ${habitsThisWeek ? `
        <div style="flex: 1; background-color: #f7fafc; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="color: #667eea; font-size: 24px; font-weight: bold;">${habitsThisWeek.length}</div>
          <div style="color: #718096; font-size: 12px;">Habits This Week</div>
        </div>
        ` : ''}
      </div>

      <!-- Quote -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; text-align: center;">
        <p style="color: #4a5568; font-size: 16px; font-style: italic; line-height: 1.6; margin: 0 0 8px 0;">
          "${quote.text}"
        </p>
        <p style="color: #a0aec0; font-size: 14px; margin: 0;">— ${quote.author}</p>
      </div>

      ${briefFormat !== 'audio' ? `
      <!-- Quick Summary -->
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        <h3 style="color: #718096; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">📝 Quick Summary</h3>
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">${summaryText}</p>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="background-color: #f7fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #718096; font-size: 14px; margin: 0 0 8px 0;">
        Talk soon,<br><strong style="color: #667eea;">Jericho</strong>
      </p>
      <p style="color: #a0aec0; font-size: 12px; margin: 16px 0 0 0;">
        Reply to this email to chat with me anytime.
      </p>
      <p style="margin: 8px 0 0 0;">
        <a href="${appUrl}" style="color: #a0aec0; font-size: 12px; text-decoration: underline;">Update Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Determine capability focus for subject line
    const capabilityFocus = topics[0] || 'Your Growth';
    const subjectLine = `Your Growth Brief for ${day} - ${capabilityFocus}`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Jericho <jericho@themomentumcompany.io>",
      to: [profile.email],
      subject: subjectLine,
      html: emailHtml,
    });

    console.log(`Daily brief email sent to ${profile.email}:`, emailResponse);

    // Record delivery
    await supabase.from("email_deliveries").insert({
      profile_id: profileId,
      company_id: profile.company_id,
      subject: subjectLine,
      body: emailHtml,
      sent_at: new Date().toISOString(),
      status: 'sent',
      resources_included: { 
        episodeId: episode.id,
        episodeDate: today,
        briefFormat
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: (emailResponse as any).id || 'sent',
        to: profile.email,
        subject: subjectLine
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
