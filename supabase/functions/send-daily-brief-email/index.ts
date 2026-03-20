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

// Calculate days remaining in 90-day period from quarter start
function getDaysRemaining(quarter: string, year: number): number {
  // Parse quarter like "Q1" -> month 1, "Q2" -> month 4, etc.
  const quarterNum = parseInt(quarter?.replace('Q', '') || '1');
  const startMonth = (quarterNum - 1) * 3; // Q1=0 (Jan), Q2=3 (Apr), etc.
  const quarterStart = new Date(year, startMonth, 1);
  const quarterEnd = new Date(year, startMonth + 3, 0); // Last day of quarter
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((quarterEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return daysRemaining;
}

interface UserContext {
  firstName: string;
  episodeTitle: string;
  topics: string[];
  script: string;
  dailyChallenge: string | null;
  streakDays: number | null;
  habits: { name: string; currentStreak: number; completionsThisWeek: number }[];
  ninetyDayTargets: { title: string; progress: number; daysRemaining: number; benchmarks: { title: string; isCompleted: boolean }[] }[];
  topCapabilities: { name: string; currentLevel: string; targetLevel: string }[];
  recentAchievements: string[];
  personalVision: string | null;
  recognitionsSent: number;
  totalBenchmarks: number;
  completedBenchmarks: number;
  capabilityScore: number | null;
  totalCapabilities: number;
  focusCapability: string | null;
  appUrl: string;
  priorityTasks: { title: string; priority: string; dueDate: string | null }[];
  calendarEvents: { title: string; startTime: string; endTime: string; attendees: string[]; location: string | null }[];
  userTimezone: string;
}

async function fetchProfileWithRetry(
  supabase: any,
  profileId: string,
  attempts = 2
): Promise<{ data: any; error: any }> {
  let lastError: any = null;

  for (let i = 0; i < attempts; i++) {
    const result = await supabase
      .from("profiles")
      .select("id, email, full_name, company_id")
      .eq("id", profileId)
      .maybeSingle();

    if ((result.data as any)?.email) return result;

    lastError = result.error;

    // brief backoff for transient DB/network hiccups
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return {
    data: null,
    error: lastError,
  };
}

// Generate personalized email content using AI
async function generatePersonalizedEmail(context: UserContext): Promise<{ subject: string; body: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not configured, using fallback template");
    return {
      subject: `Hey ${context.firstName}, your daily growth update`,
      body: generateFallbackBody(context)
    };
  }

  const systemPrompt = `You are Jericho, a warm, encouraging AI growth coach. You write personalized daily emails to professionals to help them grow.

Your voice is:
- Warm and personal (like a trusted mentor writing a letter)
- Encouraging but not cheesy or over-the-top
- Practical and actionable
- Conversational and human
- Data-informed but not robotic

You structure emails like a personal daily briefing:
1. A warm, personalized greeting
2. TODAY'S SCHEDULE - If calendar events are available, give a quick snapshot of their day (key meetings, who they're with)
3. TODAY'S TOP PRIORITIES - List their 3-5 most important tasks/priorities for the day (from their task list)
4. A quick status update on their 90-day goals (celebrate progress or gently nudge)
5. Habit tracker summary (which ones are on fire, which need attention)
6. Today's learning focus - mention the SPECIFIC CAPABILITY by name (provided as "Focus Capability")
7. The daily challenge
8. A "Quick Reflect" question — ONE short question that connects to something from their playbook, a recent goal, or today's challenge. Frame it as something they can reply to this email to answer. Keep it to one sentence, make it specific to them, and always start with "Quick reflect:"
9. A motivating sign-off

IMPORTANT RULES:
- When including links, ONLY use these VALID app routes (do NOT invent other pages):
  * ${context.appUrl}/dashboard/my-growth-plan - Main growth plan page with goals, habits, vision
  * ${context.appUrl}/dashboard/my-resources - Learning resources and recommendations
  * ${context.appUrl}/dashboard/my-capabilities - Skill assessments and capability tracking
  * ${context.appUrl}/dashboard/personal-assistant - Personal task board/to-do list
  * ${context.appUrl}/dashboard/settings - Email and account settings
- Reference the SPECIFIC capability name provided, never say "general" capability
- You CAN include <a> tags linking to resources, but ONLY use the exact routes listed above
- NEVER link to /dashboard/challenges or any route not in the list above - those pages do not exist
- The Quick Reflect question MUST be specific to this person — reference a goal, habit, challenge, or something from their recent history. Never ask a generic question like "How are you feeling today?"
- End the email with the Quick Reflect question so it's the last thing they read and the easiest thing to reply to
- Example: <a href="${context.appUrl}/dashboard/my-growth-plan">your growth plan</a>

Format your response as JSON with two fields:
- "subject": A short, personal email subject line (max 60 chars, no emojis, make it about THEM not the podcast)
- "body": The email body in HTML format. Use <p> tags for paragraphs, <strong> for emphasis. Keep it scannable but personal.`;

  const userPrompt = `Write today's personalized growth email for ${context.firstName}.

=== THEIR CURRENT STATUS ===

${context.personalVision ? `Personal Vision: "${context.personalVision}"` : ''}

Focus Capability for Today: ${context.focusCapability || 'Their top priority capability'}

90-Day Targets (${context.ninetyDayTargets.length} active):
${context.ninetyDayTargets.length > 0 
  ? context.ninetyDayTargets.map(t => {
      const benchmarkInfo = t.benchmarks.length > 0 
        ? ` | Benchmarks: ${t.benchmarks.filter(b => b.isCompleted).length}/${t.benchmarks.length} complete (${t.benchmarks.map(b => `${b.isCompleted ? '✓' : '○'} ${b.title}`).join(', ')})`
        : '';
      return `- ${t.title}: ${t.progress}% complete, ${t.daysRemaining} days remaining${benchmarkInfo}`;
    }).join('\n')
  : 'No active 90-day targets set yet'}

Total Benchmarks: ${context.completedBenchmarks}/${context.totalBenchmarks} completed
Recognitions Sent: ${context.recognitionsSent}

Active Habits:
${context.habits.length > 0
  ? context.habits.map(h => `- ${h.name}: ${h.currentStreak} day streak, ${h.completionsThisWeek} times this week`).join('\n')
  : 'No active habits tracked'}

${context.streakDays ? `Login Streak: ${context.streakDays} days` : ''}

Capabilities They're Developing (${context.topCapabilities.length} of ${context.totalCapabilities} total):
${context.topCapabilities.length > 0
  ? context.topCapabilities.map(c => `- ${c.name}: currently ${c.currentLevel}, targeting ${c.targetLevel}`).join('\n')
  : 'No capabilities assigned yet'}
${context.capabilityScore !== null ? `\nOverall Capability Score: ${context.capabilityScore}%` : ''}

${context.recentAchievements.length > 0 ? `Recent Wins: ${context.recentAchievements.join(', ')}` : ''}

TODAY'S PRIORITY TASKS (from their personal assistant):
${context.priorityTasks.length > 0
  ? context.priorityTasks.map((t, i) => `${i + 1}. ${t.title} [${t.priority}]${t.dueDate ? ` - Due: ${t.dueDate}` : ''}`).join('\n')
  : 'No tasks in their to-do list yet'}

TODAY'S CALENDAR (${context.calendarEvents.length} events):
${context.calendarEvents.length > 0
  ? context.calendarEvents.map(e => {
      const start = e.startTime ? new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day';
      const attendeeList = e.attendees.length > 0 ? ` with ${e.attendees.slice(0, 3).join(', ')}` : '';
      return `- ${start}: ${e.title}${attendeeList}${e.location ? ` (${e.location})` : ''}`;
    }).join('\n')
  : 'No calendar connected or no events today'}

=== TODAY'S EPISODE ===
Title: "${context.episodeTitle}"
Focus Capability: ${context.focusCapability || 'Growth & Development'}
Topics: ${context.topics.join(', ')}
${context.dailyChallenge ? `Today's Challenge: ${context.dailyChallenge}` : ''}

Episode Content Summary:
${context.script.substring(0, 2000)}

=== INSTRUCTIONS ===
Write a personalized daily briefing email that:
1. Opens with a warm greeting that acknowledges where they are in their journey
2. **IMPORTANT**: Lists their TOP 3-5 PRIORITIES for today from their task list (if they have tasks)
3. Gives a quick, encouraging update on their 90-day targets (if any are close to deadline or behind, gently nudge)
4. Celebrates habit streaks or encourages consistency where needed
5. Introduces today's episode focusing on "${context.focusCapability}" - mention this SPECIFIC capability by name
6. Mentions the daily challenge as something specific to try today
7. Signs off warmly as Jericho

APP URL for any links: ${context.appUrl}
Their Personal Assistant (task board): ${context.appUrl}/dashboard/personal-assistant

Keep it around 250-350 words. Make it feel like a personal check-in from a coach who knows them well.`;

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
        subject: parsed.subject || `Hey ${context.firstName}, your daily growth update`,
        body: parsed.body || generateFallbackBody(context)
      };
    }

    throw new Error("Could not parse AI response as JSON");
  } catch (error) {
    console.error("AI email generation error:", error);
    return {
      subject: `Hey ${context.firstName}, your daily growth update`,
      body: generateFallbackBody(context)
    };
  }
}

function generateFallbackBody(context: UserContext): string {
  const habitsSection = context.habits.length > 0
    ? `<p style="color: #ffffff; margin: 0 0 16px 0;"><strong style="color: #ffffff;">Your habits this week:</strong> ${context.habits.map(h => `${h.name} (${h.currentStreak} day streak)`).join(', ')}</p>`
    : '';
  
  const targetsSection = context.ninetyDayTargets.length > 0
    ? `<p style="color: #ffffff; margin: 0 0 16px 0;"><strong style="color: #ffffff;">90-Day Progress:</strong> ${context.ninetyDayTargets.map(t => `${t.title} at ${t.progress}%`).join(', ')}</p>`
    : '';

  return `
    <p style="color: #ffffff; margin: 0 0 16px 0;">Hey ${context.firstName},</p>
    <p style="color: #ffffff; margin: 0 0 16px 0;">Here's your daily growth check-in.</p>
    ${targetsSection}
    ${habitsSection}
    <p style="color: #ffffff; margin: 0 0 16px 0;">Today's episode "${context.episodeTitle}" covers ${context.topics.slice(0, 2).join(' and ')}. Take a few minutes to listen — it's tailored just for you.</p>
    ${context.dailyChallenge ? `<p style="color: #ffffff; margin: 0 0 16px 0;"><strong style="color: #ffffff;">Today's challenge:</strong> ${context.dailyChallenge}</p>` : ''}
    <p style="color: #ffffff; margin: 0 0 16px 0;">Keep showing up. You're making progress.</p>
    <p style="color: #ffffff; margin: 0 0 16px 0;">Talk soon,<br/>Jericho</p>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, episodeDate, isWelcome } = await req.json();

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
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const appUrl = `https://askjericho.com`;

    // Fetch all user data in parallel
    const [
      profileResult,
      episodeResult,
      prefsResult,
      habitsResult,
      habitCompletionsResult,
      targetsResult,
      capabilitiesResult,
      achievementsResult,
      visionResult,
      recognitionsResult,
      tasksResult
    ] = await Promise.all([
      // Profile with company info for industry news
      supabase
        .from("profiles")
        .select("id, email, full_name, company_id, companies(id, name, industry, industry_keywords)")
        .eq("id", profileId)
        .maybeSingle(),
      // Today's episode
      supabase
        .from("podcast_episodes")
        .select("*")
        .eq("profile_id", profileId)
        .eq("episode_date", today)
        .single(),
      // Preferences
      supabase
        .from("email_preferences")
        .select("brief_format, timezone")
        .eq("profile_id", profileId)
        .single(),
      // Active habits
      supabase
        .from("leading_indicators")
        .select("id, habit_name, current_streak")
        .eq("profile_id", profileId)
        .eq("is_active", true),
      // Habit completions this week
      supabase
        .from("habit_completions")
        .select("habit_id")
        .eq("profile_id", profileId)
        .gte("completed_date", weekAgo),
    // 90-day targets (correct column names: goal_text, completed, benchmarks as JSON)
      supabase
        .from("ninety_day_targets")
        .select("id, goal_text, completed, quarter, year, benchmarks")
        .eq("profile_id", profileId)
        .eq("completed", false)
        .eq("year", new Date().getFullYear()),
      // Top capabilities (priority 1-3)
      supabase
        .from("employee_capabilities")
        .select("current_level, target_level, priority, capabilities(name)")
        .eq("profile_id", profileId)
        .lte("priority", 3)
        .order("priority"),
      // Recent achievements (last 30 days)
      supabase
        .from("achievements")
        .select("achievement_text")
        .eq("profile_id", profileId)
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        )
        .limit(3),
      // Personal vision
      supabase
        .from("personal_visions")
        .select("vision_statement")
        .eq("profile_id", profileId)
        .maybeSingle(),
      // Recognitions sent (last 30 days) - correct column is given_by
      supabase
        .from("recognition_notes")
        .select("id", { count: 'exact', head: true })
        .eq("given_by", profileId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      // Priority tasks from personal assistant (todo and in_progress only)
      supabase
        .from("project_tasks")
        .select("title, priority, due_date")
        .eq("profile_id", profileId)
        .in("column_status", ["todo", "in_progress"])
        .order("priority", { ascending: false })
        .limit(5),
    ]);

    const profile = (profileResult as any).data as any | null;
    const episode = episodeResult.data;

    // Email fallback: if profiles row isn't available, use auth user email (service role can read it)
    let email: string | null = profile?.email ?? null;
    if (!email) {
      const authRes = await supabase.auth.admin.getUserById(profileId);
      email = (authRes as any)?.data?.user?.email ?? null;
      console.warn("Profile missing email; falling back to auth email", {
        profileId,
        profileError: (profileResult as any).error,
        hasAuthEmail: !!email,
      });
    }

    if (!email) {
      throw new Error(
        `Profile not found or missing email (profileId=${profileId})`
      );
    }

    const firstName = profile?.full_name?.split(' ')[0] || email.split('@')[0] || 'there';
    
    // Handle welcome email for users who have never logged in
    if (isWelcome) {
      console.log(`Sending WELCOME email to ${email} (never logged in)`);
      
      const welcomeSubject = `${firstName}, your growth coach is ready`;
      const welcomeHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a1628; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0a1628;">
    
    <!-- Header -->
    <div style="padding: 40px 32px 24px 32px; text-align: center;">
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; color: #d4a855;">Jericho</h1>
      <p style="color: #8892a8; font-size: 13px; margin: 8px 0 0 0; letter-spacing: 0.5px;">YOUR AI GROWTH COACH</p>
    </div>

    <!-- Main content card -->
    <div style="margin: 0 16px; background: linear-gradient(180deg, #132238 0%, #0e1a2d 100%); border-radius: 16px; border: 1px solid #1e3a5f; overflow: hidden;">
      
      <div style="padding: 32px; color: #ffffff; font-size: 16px; line-height: 1.7;">
        <p style="margin: 0 0 20px 0;">Hey ${firstName},</p>
        
        <p style="margin: 0 0 20px 0;">Your account is set up and ready to change your life.</p>
        
        <p style="margin: 0 0 20px 0;">I'm Jericho — your AI-powered growth coach. Here's what I can help you with:</p>
        
        <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #d4a855;">
          <li style="margin-bottom: 12px; color: #ffffff;"><strong style="color: #d4a855;">Daily Podcasts</strong> — Personalized 5-minute episodes based on your goals</li>
          <li style="margin-bottom: 12px; color: #ffffff;"><strong style="color: #d4a855;">90-Day Goals</strong> — Set and track meaningful quarterly targets</li>
          <li style="margin-bottom: 12px; color: #ffffff;"><strong style="color: #d4a855;">Habit Tracking</strong> — Build the behaviors that drive results</li>
          <li style="margin-bottom: 12px; color: #ffffff;"><strong style="color: #d4a855;">Skill Development</strong> — Level up your professional capabilities</li>
        </ul>
        
        <p style="margin: 0 0 20px 0;">Click below to log in and let's get started. You'll set your first goal and I'll start creating personalized content just for you.</p>
        
        <p style="margin: 0; color: #d4a855;">Your growth journey starts now.</p>
      </div>

      <!-- CTA Button -->
      <div style="padding: 0 32px 32px 32px;">
        <a href="${appUrl}/auth" style="display: block; background: linear-gradient(135deg, #d4a855 0%, #c49545 100%); color: #0a1628; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; text-align: center;">
          Log In & Get Started
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 32px; text-align: center;">
      <p style="color: #8892a8; font-size: 13px; margin: 0;">
        Questions? Just reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
      `;

      // Send welcome email
      const rawFrom = Deno.env.get("RESEND_FROM");
      const cleanedFrom = (rawFrom || "").trim().replace(/^"|"$/g, "");
      const isBareEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedFrom);
      const fromAddress = cleanedFrom
        ? (isBareEmail ? `Jericho <${cleanedFrom}>` : cleanedFrom)
        : "Jericho <onboarding@resend.dev>";

      const emailResponse = await resend.emails.send({
        from: fromAddress,
        to: [email],
        subject: welcomeSubject,
        html: welcomeHtml,
      });

      const resendError = (emailResponse as any)?.error;
      if (resendError) {
        console.error(`Resend error sending welcome to ${email}:`, resendError);
        return new Response(
          JSON.stringify({ success: false, error: resendError?.message }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record delivery
      await supabase.from("email_deliveries").insert({
        profile_id: profileId,
        company_id: profile?.company_id,
        subject: welcomeSubject,
        body: welcomeHtml,
        sent_at: new Date().toISOString(),
        status: 'sent',
        resources_included: { type: 'welcome', isWelcome: true },
      });

      console.log(`Welcome email sent to ${email}`);
      return new Response(
        JSON.stringify({ success: true, to: email, type: 'welcome' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Regular daily brief flow continues below...
    if (!episode) {
      throw new Error(`No podcast episode found for ${today}`);
    }

    const briefFormat = prefsResult.data?.brief_format || 'both';
    const userTimezone = prefsResult.data?.timezone || 'America/New_York';

    // Process habits with completion counts
    const habits = (habitsResult.data || []).map((h: any) => {
      const completionsThisWeek = (habitCompletionsResult.data || []).filter((c: any) => c.habit_id === h.id).length;
      return {
        name: h.habit_name,
        currentStreak: h.current_streak || 0,
        completionsThisWeek
      };
    });

    // Process 90-day targets with benchmarks (benchmarks are stored as JSON in the benchmarks column)
    const ninetyDayTargets = (targetsResult.data || []).map((t: any) => {
      // Parse benchmarks from JSON - can be an object with text property or an array
      let parsedBenchmarks: { title: string; isCompleted: boolean }[] = [];
      if (t.benchmarks) {
        if (typeof t.benchmarks === 'object' && t.benchmarks.text) {
          // Format: { text: "bullet point list" }
          const lines = String(t.benchmarks.text)
            .split('\n')
            .map((l: string) => l.trim())
            .filter((l: string) => l && !l.startsWith('*') || l.length > 2)
            .map((l: string) => l.replace(/^\*+\s*/, '').replace(/^\d+\.\s*/, '').trim())
            .filter((l: string) => l.length > 5);
          parsedBenchmarks = lines.map((l: string) => ({ title: l, isCompleted: false }));
        } else if (Array.isArray(t.benchmarks)) {
          parsedBenchmarks = t.benchmarks.map((b: any) => ({
            title: typeof b === 'string' ? b : (b.text || b.title || String(b)),
            isCompleted: b.completed || b.isCompleted || false
          }));
        }
      }
      
      return {
        title: t.goal_text || 'Untitled Goal',
        progress: 0, // No progress_percentage column - could calculate from benchmarks if needed
        daysRemaining: getDaysRemaining(t.quarter, t.year),
        benchmarks: parsedBenchmarks.slice(0, 5) // Limit to 5 benchmarks per goal
      };
    });

    // Calculate total benchmarks across all targets
    const totalBenchmarks = ninetyDayTargets.reduce((sum, t) => sum + t.benchmarks.length, 0);
    const completedBenchmarks = ninetyDayTargets.reduce((sum, t) => sum + t.benchmarks.filter((b: any) => b.isCompleted).length, 0);

    // Process capabilities
    const allCapabilities = (capabilitiesResult.data || [])
      .filter((c: any) => c.capabilities?.name);
    
    const topCapabilities = allCapabilities.map((c: any) => ({
      name: c.capabilities.name,
      currentLevel: c.current_level || 'Not assessed',
      targetLevel: c.target_level || 'Not set'
    }));

    // Calculate capability score (percentage of capabilities at or above target)
    const levelOrder = ['foundational', 'level 1', 'advancing', 'level 2', 'independent', 'level 3', 'mastery', 'level 4'];
    const getLevelIndex = (level: string) => {
      const normalized = (level || '').toLowerCase();
      const idx = levelOrder.findIndex(l => normalized.includes(l) || l.includes(normalized));
      return idx >= 0 ? Math.floor(idx / 2) : 0; // Group into 4 levels
    };
    
    const assessedCaps = allCapabilities.filter((c: any) => c.current_level && c.target_level);
    const capabilityScore = assessedCaps.length > 0 
      ? Math.round((assessedCaps.filter((c: any) => 
          getLevelIndex(c.current_level) >= getLevelIndex(c.target_level)
        ).length / assessedCaps.length) * 100)
      : null;
    const totalCapabilities = allCapabilities.length;

    // Recent achievements
    const recentAchievements = (achievementsResult.data || []).map((a: any) => a.achievement_text);

    // Get recognitions count
    const recognitionsSent = (recognitionsResult as any).count || 0;

    // Industry news temporarily disabled until curated ag-specific content sources are available
    // TODO: Re-enable when we have curated agriculture industry news sources
    const focusCapability = episode.capability_name || topCapabilities[0]?.name || null;
    const industryNews: { headline: string; summary: string; source: string; relevanceTag?: string }[] = [];

    // Process priority tasks
    const priorityTasks = ((tasksResult as any).data || []).map((t: any) => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.due_date
    }));

    // Fetch today's calendar events if Google is connected
    let calendarEvents: { title: string; startTime: string; endTime: string; attendees: string[]; location: string | null }[] = [];
    try {
      const { data: googleIntegration } = await supabase
        .from('user_integrations')
        .select('id, sync_status')
        .eq('profile_id', profileId)
        .eq('provider', 'google')
        .eq('sync_status', 'connected')
        .maybeSingle();

      if (googleIntegration) {
        const calResponse = await fetch(`${supabaseUrl}/functions/v1/google-calendar-read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: profileId }),
        });

        if (calResponse.ok) {
          const calData = await calResponse.json();
          const userNow = new Date(new Date().toLocaleString('en-US', { timeZone: userTimezone }));
          const todayUser = userNow.toISOString().split('T')[0];
          calendarEvents = (calData.events || [])
            .filter((e: any) => {
              const isAllDay = !e.start?.dateTime && !!e.start?.date;
              if (isAllDay) {
                const startDate = e.start.date;
                const endDate = e.end?.date || startDate;
                return startDate <= todayUser && todayUser < endDate;
              } else {
                const eventLocal = new Date(new Date(e.start.dateTime).toLocaleString('en-US', { timeZone: userTimezone }));
                const eventDateStr = eventLocal.toISOString().split('T')[0];
                return eventDateStr === todayUser;
              }
            })
            .map((e: any) => {
              const isAllDay = !e.start?.dateTime && !!e.start?.date;
              return {
                title: e.summary || 'Untitled',
                startTime: isAllDay ? '' : (e.start?.dateTime || ''),
                endTime: isAllDay ? '' : (e.end?.dateTime || ''),
                attendees: (e.attendees || []).map((a: any) => a.displayName || a.email || '').filter(Boolean),
                location: e.location || null,
              };
            })
            .slice(0, 10);
        }
      }
    } catch (calErr) {
      console.error('[send-daily-brief-email] Calendar fetch error (non-fatal):', calErr);
    }

    // Build context for AI
    const userContext: UserContext = {
      firstName,
      episodeTitle: episode.title,
      topics: episode.topics_covered || [],
      script: episode.script || '',
      dailyChallenge: episode.daily_challenge,
      streakDays: await (async () => {
        const { data: streakRow } = await supabase
          .from("login_streaks")
          .select("current_streak, last_login_date")
          .eq("profile_id", profileId)
          .single();
        if (!streakRow?.last_login_date) return null;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const last = streakRow.last_login_date;
        return (last === today || last === yesterday) ? (streakRow.current_streak || 0) : 0;
      })(),
      habits,
      ninetyDayTargets,
      topCapabilities,
      recentAchievements,
      personalVision: (visionResult as any).data?.vision_statement || null,
      recognitionsSent,
      totalBenchmarks,
      completedBenchmarks,
      capabilityScore,
      totalCapabilities,
      focusCapability,
      appUrl,
      priorityTasks,
      calendarEvents,
    };

    console.log("Generating personalized email for", firstName, "with context:", {
      habits: habits.length,
      targets: ninetyDayTargets.length,
      capabilities: topCapabilities.length,
      hasVision: !!userContext.personalVision,
      newsItems: industryNews.length
    });

    const { subject, body: personalizedBody } = await generatePersonalizedEmail(userContext);

    // Build the app URL
    const dashboardUrl = `${appUrl}/dashboard/my-growth-plan`;

    // Build stats for the email footer
    const totalHabitCompletions = habits.reduce((sum, h) => sum + h.completionsThisWeek, 0);
    const avgTargetProgress = ninetyDayTargets.length > 0
      ? Math.round(ninetyDayTargets.reduce((sum, t) => sum + t.progress, 0) / ninetyDayTargets.length)
      : null;

    // Build Industry Pulse section if we have news
    const industryPulseHtml = industryNews.length > 0 ? `
      <div style="margin: 24px 0; padding: 20px; background: linear-gradient(180deg, #1a2f47 0%, #0e1a2d 100%); border-radius: 12px; border: 1px solid #2a4a6f;">
        <h3 style="color: #d4a855; font-size: 14px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 1px;">📰 Industry Pulse</h3>
        ${industryNews.slice(0, 3).map(news => `
          <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #1e3a5f;">
            <p style="color: #ffffff; font-weight: 600; margin: 0 0 8px 0; font-size: 15px;">${news.headline}</p>
            <p style="color: #a0aec0; margin: 0 0 8px 0; font-size: 14px; line-height: 1.5;">${news.summary}</p>
            <p style="color: #8892a8; font-size: 12px; margin: 0;">
              ${news.source ? `Source: ${news.source}` : ''}
              ${news.relevanceTag ? ` · <span style="color: #d4a855;">${news.relevanceTag}</span>` : ''}
            </p>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Build the on-brand Jericho email HTML - Navy Blue (#0a1628, #1e3a5f) and Gold (#d4a855)
    const emailHtml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Your Daily Brief from Jericho</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    /* Prevent iOS/Gmail dark mode color overrides */
    [data-ogsc] body, [data-ogsb] body { background-color: #0a1628 !important; }
    @media (prefers-color-scheme: dark) {
      body, .body-bg { background-color: #0a1628 !important; }
      .email-text { color: #ffffff !important; }
      .email-heading { color: #ffffff !important; }
      .email-link { color: #d4a855 !important; }
      .email-muted { color: #8892a8 !important; }
      .email-card { background-color: #132238 !important; }
      u + .body .email-text { color: #ffffff !important; }
    }
  </style>
</head>
<body class="body-bg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a1628; margin: 0; padding: 0; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0a1628; color: #ffffff;" class="body-bg">
    
    <!-- Header with Jericho branding - Navy and Gold -->
    <div style="padding: 40px 32px 24px 32px; text-align: center;">
      <div style="display: inline-block;">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0; color: #d4a855;" class="email-link">Jericho</h1>
      </div>
      <p style="color: #8892a8; font-size: 13px; margin: 8px 0 0 0; letter-spacing: 0.5px;" class="email-muted">${formatDate(new Date()).toUpperCase()}</p>
    </div>

    <!-- Main content card -->
    <div style="margin: 0 16px; background: #132238; border-radius: 16px; border: 1px solid #1e3a5f; overflow: hidden;" class="email-card">
      
      <!-- AI-generated personalized content -->
      <div style="padding: 32px; color: #ffffff; font-size: 16px; line-height: 1.7;" class="email-text">
        <div style="color: #ffffff;" class="email-text">
          ${personalizedBody
            .replace(/\s*style="[^"]*"/g, '')
            .replace(/<p([^>]*)>/g, '<p$1 style="color: #ffffff; margin: 0 0 16px 0;" class="email-text">')
            .replace(/<strong([^>]*)>/g, '<strong$1 style="color: #ffffff;" class="email-text">')
            .replace(/<li([^>]*)>/g, '<li$1 style="color: #ffffff; margin-bottom: 8px;" class="email-text">')
            .replace(/<span([^>]*)>/g, '<span$1 style="color: #ffffff;" class="email-text">')
            .replace(/<div([^>]*)>/g, '<div$1 style="color: #ffffff;" class="email-text">')
            .replace(/<ul([^>]*)>/g, '<ul$1 style="color: #ffffff; padding-left: 20px; margin: 0 0 16px 0;" class="email-text">')
            .replace(/<ol([^>]*)>/g, '<ol$1 style="color: #ffffff; padding-left: 20px; margin: 0 0 16px 0;" class="email-text">')
            .replace(/<h1([^>]*)>/g, '<h1$1 style="color: #ffffff; font-size: 20px; margin: 0 0 12px 0;" class="email-heading">')
            .replace(/<h2([^>]*)>/g, '<h2$1 style="color: #ffffff; font-size: 18px; margin: 0 0 12px 0;" class="email-heading">')
            .replace(/<h3([^>]*)>/g, '<h3$1 style="color: #ffffff; font-size: 16px; font-weight: 700; margin: 0 0 8px 0;" class="email-heading">')
            .replace(/<a([^>]*?)(?:\s*style="[^"]*")?([^>]*)>/g, '<a$1$2 style="color: #d4a855; text-decoration: underline;" class="email-link">')
          }
        </div>
        
        ${industryPulseHtml}
      </div>

      <!-- Listen button - Navy/Gold gradient -->
      ${briefFormat !== 'text' ? `
      <div style="padding: 0 32px 32px 32px;">
        <a href="${dashboardUrl}" style="display: block; background: linear-gradient(135deg, #1e3a5f 0%, #2a4a6f 50%, #d4a855 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
          🎧 Listen to Today's Episode
        </a>
      </div>
      ` : ''}

      <!-- Enhanced Stats bar - 3 columns grid for better email client support -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #1e3a5f; border-collapse: collapse;">
        <tr>
          ${capabilityScore !== null ? `
          <td style="width: 33.33%; padding: 16px; text-align: center; border-right: 1px solid #1e3a5f; border-bottom: 1px solid #1e3a5f;">
            <div style="color: #d4a855; font-size: 24px; font-weight: 700;">${capabilityScore}%</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Capability Score</div>
          </td>
          ` : ''}
          ${ninetyDayTargets.length > 0 ? `
          <td style="width: 33.33%; padding: 16px; text-align: center; border-right: 1px solid #1e3a5f; border-bottom: 1px solid #1e3a5f;">
            <div style="color: #d4a855; font-size: 24px; font-weight: 700;">${ninetyDayTargets.length}</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">90-Day Goals</div>
          </td>
          ` : ''}
          ${totalBenchmarks > 0 ? `
          <td style="width: 33.33%; padding: 16px; text-align: center; border-bottom: 1px solid #1e3a5f;">
            <div style="color: #22c55e; font-size: 24px; font-weight: 700;">${completedBenchmarks}/${totalBenchmarks}</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Benchmarks</div>
          </td>
          ` : ''}
        </tr>
        <tr>
          ${totalHabitCompletions > 0 ? `
          <td style="width: 33.33%; padding: 16px; text-align: center; border-right: 1px solid #1e3a5f;">
            <div style="color: #3b82f6; font-size: 24px; font-weight: 700;">${totalHabitCompletions}</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Habits This Week</div>
          </td>
          ` : ''}
          ${recognitionsSent > 0 ? `
          <td style="width: 33.33%; padding: 16px; text-align: center; border-right: 1px solid #1e3a5f;">
            <div style="color: #f59e0b; font-size: 24px; font-weight: 700;">${recognitionsSent}</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Recognitions</div>
          </td>
          ` : ''}
          ${avgTargetProgress !== null ? `
          <td style="width: 33.33%; padding: 16px; text-align: center;">
            <div style="color: #22c55e; font-size: 24px; font-weight: 700;">${avgTargetProgress}%</div>
            <div style="color: #8892a8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Goal Progress</div>
          </td>
          ` : ''}
        </tr>
      </table>
    </div>

    <!-- Quick Reflect CTA -->
    <div style="margin: 16px 16px 0 16px; background: linear-gradient(180deg, #1a2f47 0%, #132238 100%); border-radius: 16px; border: 1px solid #2a4a6f; padding: 24px 32px; text-align: center;">
      <p style="color: #d4a855; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Quick Reflect</p>
      <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Hit reply and answer the reflection question above — one sentence is plenty.</p>
      <p style="color: #8892a8; font-size: 13px; margin: 0;">Just hit reply and tell me. I read every response.</p>
    </div>

    <!-- Footer -->
    <div style="padding: 32px; text-align: center;">
      <p style="color: #8892a8; font-size: 13px; margin: 0 0 16px 0;">
        Reply to this email anytime — I read every message.
      </p>
      <a href="${appUrl}/dashboard/settings" style="color: #d4a855; font-size: 13px; text-decoration: none;">Update Preferences</a>
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
      reply_to: 'jericho@sender.askjericho.com',
      headers: {
        'List-Unsubscribe': `<${appUrl}>`,
        'X-Entity-Ref-ID': `jericho-daily-${profileId}-${today}`,
      },
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
        contextUsed: {
          habits: habits.length,
          targets: ninetyDayTargets.length,
          capabilities: topCapabilities.length
        }
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
