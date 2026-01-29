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
    const { profileId, preview = false, testRecipient = null } = await req.json();

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

    // Fetch email preferences to determine frequency
    const { data: emailPrefs } = await supabase
      .from("email_preferences")
      .select("frequency")
      .eq("profile_id", profileId)
      .single();
    
    const emailFrequency = emailPrefs?.frequency || 'weekly';
    const isDaily = emailFrequency === 'daily';
    console.log(`Generating ${emailFrequency} email for ${profile.full_name}`);

    // Fetch employee capabilities with gaps
    const { data: capabilities } = await supabase
      .from("employee_capabilities")
      .select(`
        *,
        capability:capabilities(name, category)
      `)
      .eq("profile_id", profileId)
      .neq("current_level", "target_level")
      .order("last_updated", { ascending: false });

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
        source,
        title,
        messages:conversation_messages(role, content, created_at)
      `)
      .eq("profile_id", profileId)
      .gte("updated_at", sevenDaysAgo.toISOString())
      .order("updated_at", { ascending: false })
      .limit(3);

    // Fetch voice conversations specifically for detailed summary
    const { data: voiceMessages } = await supabase
      .from("conversation_messages")
      .select(`
        content,
        role,
        created_at,
        conversation:conversations!inner(id, title, source, created_at)
      `)
      .eq("conversation.profile_id", profileId)
      .eq("conversation.source", "voice")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true })
      .limit(20);

    // Build voice conversation summary
    let voiceConversationSummary = '';
    if (voiceMessages && voiceMessages.length > 0) {
      const conversationsBySession = voiceMessages.reduce((acc: any, msg: any) => {
        const convId = msg.conversation.id;
        if (!acc[convId]) {
          acc[convId] = {
            title: msg.conversation.title,
            date: msg.conversation.created_at,
            messages: []
          };
        }
        acc[convId].messages.push({
          role: msg.role,
          content: msg.content
        });
        return acc;
      }, {});

      const sessions = Object.values(conversationsBySession) as any[];
      voiceConversationSummary = `Voice Conversations (${sessions.length} session${sessions.length > 1 ? 's' : ''}):\n`;
      sessions.slice(0, 2).forEach((session: any) => {
        voiceConversationSummary += `- ${new Date(session.date).toLocaleDateString()}: Topics discussed included ${session.messages.filter((m: any) => m.role === 'user').slice(0, 2).map((m: any) => m.content.substring(0, 60)).join(', ')}...\n`;
      });
    }

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
      .limit(15); // Fetch more to allow filtering out recently sent

    // For weekly emails: fetch recent emails to avoid repetition
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const { data: recentEmails } = await supabase
      .from("email_deliveries")
      .select("resources_included, sent_at")
      .eq("profile_id", profileId)
      .gte("sent_at", fourWeeksAgo.toISOString())
      .order("sent_at", { ascending: false })
      .limit(4); // Last 4 weekly emails

    // Extract recently sent resource IDs and capability IDs
    const recentResourceIds = new Set<string>();
    const recentCapabilityIds = new Set<string>();
    
    recentEmails?.forEach(email => {
      const included = email.resources_included as any;
      if (included?.resourceId) recentResourceIds.add(included.resourceId);
      if (included?.capabilityId) recentCapabilityIds.add(included.capabilityId);
    });

    console.log(`Recent emails found: ${recentEmails?.length || 0}, excluding ${recentResourceIds.size} resources and ${recentCapabilityIds.size} capabilities`);

    // Build context for AI - Rotate through capabilities
    const levelMap: Record<string, number> = {
      'foundational': 1,
      'advancing': 2,
      'independent': 3,
      'mastery': 4
    };

    const allCapabilities = capabilities?.map(c => ({
      id: c.capability_id,
      name: c.capability?.name,
      category: c.capability?.category,
      currentLevel: c.current_level,
      targetLevel: c.target_level,
      gapSize: (levelMap[c.target_level] || 4) - (levelMap[c.current_level] || 1)
    })) || [];

    // Sort by gap, then filter out recently-featured capabilities for weekly emails
    const sortedCapabilities = allCapabilities.sort((a, b) => b.gapSize - a.gapSize);
    
    let topCapability: typeof sortedCapabilities;
    if (!isDaily && recentCapabilityIds.size > 0) {
      // For weekly: prefer capabilities NOT recently featured
      const freshCapabilities = sortedCapabilities.filter(c => !recentCapabilityIds.has(c.id));
      if (freshCapabilities.length > 0) {
        topCapability = freshCapabilities.slice(0, 1);
        console.log(`Rotating to fresh capability: ${topCapability[0]?.name}`);
      } else {
        // All have been featured recently, pick top gap anyway
        topCapability = sortedCapabilities.slice(0, 1);
      }
    } else {
      topCapability = sortedCapabilities.slice(0, 1);
    }

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

    // Get resource for the selected capability, excluding recently sent ones
    const topCapId = topCapability[0]?.id;
    
    // Filter recommendations: match capability AND exclude recently sent
    let filteredRecommendations = recommendations?.filter(r => {
      const matchesCap = !topCapId || r.employee_capability_id === topCapId;
      const notRecentlySent = !recentResourceIds.has(r.resource?.id || '');
      return matchesCap && notRecentlySent;
    }) || [];

    // If no fresh resources for this capability, try ANY fresh resource
    if (filteredRecommendations.length === 0) {
      filteredRecommendations = recommendations?.filter(r => 
        !recentResourceIds.has(r.resource?.id || '')
      ) || [];
      console.log(`No fresh resources for ${topCapability[0]?.name}, using any fresh resource`);
    }

    // If still nothing, fall back to any recommendation
    if (filteredRecommendations.length === 0) {
      filteredRecommendations = recommendations || [];
      console.log(`No fresh resources available, reusing from pool`);
    }

    const resourceForTopCap = filteredRecommendations
      .slice(0, 1)
      .map(r => ({
        resourceId: r.resource?.id,
        capabilityId: r.employee_capability_id,
        capabilityName: topCapability.find(c => c.id === r.employee_capability_id)?.name || "General",
        title: r.resource?.title || "Resource",
        description: r.resource?.description || "",
        url: r.resource?.url || "#",
        type: r.resource?.content_type || "article",
        reasoning: r.ai_reasoning || ""
      })) || [];

    // Generate email content via Lovable AI using tool calling for structured output
    // Use different prompts based on daily vs weekly frequency
    const dailySystemPrompt = `You are Jericho, a firm but encouraging executive coach writing a DAILY growth check-in email. 

TONE: Quick, energizing, and actionable. Like a morning huddle with a coach who keeps you sharp.

CRITICAL - THIS IS A DAILY CHECK-IN (NOT WEEKLY):
- This is a quick daily touch point - keep it SHORT and punchy
- Focus on TODAY: what happened yesterday, what's ahead today
- Reference their habits/streaks with specific numbers
- Give ONE clear action for TODAY (not "this week")
- Use language like "today", "this morning", "right now" - NEVER "this week"

CRITICAL - USE ACTUAL DATA, NO PLACEHOLDERS:
- The user provides JSON with actual capability names and resource details
- You MUST extract and use the actual values from this JSON
- NEVER write placeholders like "[Capability Name]" or "[Resource Title]"
- If data is missing or empty, acknowledge briefly without making up details

CONTENT RULES:
- Open with energy - acknowledge yesterday's wins or streaks
- Keep the main content to 2-3 SHORT paragraphs max
- Today's challenge should be specific and completable TODAY
- Be brief - this is a daily nudge, not a deep dive
- Keep it conversational and direct
- No weekly language ("this week", "weekly focus", etc.)

EXAMPLE DAILY LANGUAGE:
- "Good morning! Let's make today count."
- "Yesterday you knocked out 3 habits - keep that momentum going today."
- "Today's focus: spend 15 minutes on..."
- "Your challenge for today is..."`;

    const weeklySystemPrompt = `You are Jericho, a firm but encouraging executive coach writing a WEEKLY growth prescription email. 

TONE: Personal, specific, and actionable. Be direct but supportive - like a coach who believes in them but won't let them coast.

CRITICAL - THIS IS A PROACTIVE WEEKLY ASSIGNMENT:
- This email is their MAIN interaction with you this week - they may not log into the app
- You are PRESCRIBING their 1 priority focus area and giving them 1 resource to work on
- Frame this as "here's what you're working on this week" not "here's what you've done"
- The goal is to give them a complete, actionable growth plan they can execute from the email alone

CRITICAL - FRESH CHALLENGES EVERY WEEK:
- Create a UNIQUE, SPECIFIC weekly challenge that is DIFFERENT from generic advice
- Vary the challenge TYPE each week. Rotate between:
  * Practice challenges: "Have 3 conversations where you ask open-ended questions before giving advice"
  * Observation challenges: "Notice when you default to telling vs asking this week"
  * Reflection challenges: "Journal for 5 minutes each evening about one difficult conversation"
  * Application challenges: "Apply [specific technique from the resource] in your next team meeting"
  * Connection challenges: "Schedule a 15-minute coffee chat with someone outside your department"
  * Experimentation challenges: "Try one completely different approach to [specific situation]"
- Make challenges MEASURABLE and TIME-BOUND (this week, by Friday, 3 times, etc.)
- Connect the challenge directly to the resource content when possible

CRITICAL - USE ACTUAL DATA, NO PLACEHOLDERS:
- The user provides JSON with actual capability names and resource details
- You MUST extract and use the actual values from this JSON
- NEVER write placeholders like "[Capability Name]" or "[Resource Title]"
- If a capability object has { name: "Strategic Thinking" }, write "Strategic Thinking" not "[Capability Name]"
- If a resource object has { title: "Leadership Basics" }, write "Leadership Basics" not "[Resource Title]"
- If data is missing or empty, acknowledge briefly without making up details

FACT-CHECKING RULES:
- ONLY reference data explicitly provided in the JSON context
- NEVER infer, assume, or embellish details not in the data
- When mentioning numbers, ONLY use exact numbers from the provided data
- Extract and use the exact capability name from the capability object's "name" field
- Extract and use the exact resource title from the resource object's "title" field

CONTENT RULES:
- Open with brief acknowledgment if they have recent activity data
- Introduce the focus capability by its actual name as this week's assignment
- Connect the resource explicitly to the capability using both actual names
- Frame the resource as "To develop [actual capability name], start with [actual resource title]"
- Make the weekly challenge actionable WITHOUT requiring app login
- Be brief if data is sparse - focus on what you DO know
- Keep it conversational but professional
- No fluff or motivational poster talk

EXAMPLE WEEKLY CHALLENGE VARIETY:
Week 1: "Watch the video and identify 3 questioning techniques. Use at least one in every meeting this week."
Week 2: "Before responding in any conversation, pause for 3 seconds. Track how this changes the dynamic."
Week 3: "Schedule one skip-level conversation by Wednesday. Go in with only questions, no agenda."
Week 4: "Write down your top 3 assumptions about a difficult colleague. Then test one assumption this week."`;

    const systemPrompt = isDaily ? dailySystemPrompt : weeklySystemPrompt;

    const dailyUserPrompt = `Generate a personalized DAILY growth check-in email for ${profile.full_name || "this employee"}.

TODAY'S FOCUS CAPABILITY:
${JSON.stringify(topCapability)}

THEIR CURRENT STATUS:
90-Day Targets: ${JSON.stringify(targetsContext)}
Habit Progress (recent): ${JSON.stringify(habitsContext)}
Recent Conversation Themes: ${JSON.stringify(conversationContext)}
${voiceConversationSummary ? `\nVOICE COACHING INSIGHTS:\n${voiceConversationSummary}` : ''}

SUGGESTED RESOURCE:
${JSON.stringify(resourceForTopCap)}

Keep this SHORT and punchy - it's a daily check-in, not a weekly deep-dive. Focus on TODAY's action.`;

    // Get current week number to help with challenge variety
    const weekOfYear = Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const challengeTypes = ['practice', 'observation', 'reflection', 'application', 'connection', 'experimentation'];
    const suggestedChallengeType = challengeTypes[weekOfYear % challengeTypes.length];

    const weeklyUserPrompt = `Generate a personalized WEEKLY growth prescription email for ${profile.full_name || "this employee"}.

THIS WEEK'S FOCUS: This is their TOP priority capability to work on this week:
${JSON.stringify(topCapability)}

THEIR CURRENT STATUS:
90-Day Targets: ${JSON.stringify(targetsContext)}
Habit Progress (last 7 days): ${JSON.stringify(habitsContext)}
Recent Conversation Themes: ${JSON.stringify(conversationContext)}
${voiceConversationSummary ? `\nVOICE COACHING INSIGHTS:\n${voiceConversationSummary}` : ''}

CURATED RESOURCE (for their top capability):
${JSON.stringify(resourceForTopCap)}

IMPORTANT - CHALLENGE VARIETY:
This week, lean toward a "${suggestedChallengeType}" type challenge. Make it specific, measurable, and completable by end of week.

Frame this as a proactive weekly assignment focused on this one priority. They may not log into the app - this email should be their complete growth experience for the week.
${voiceConversationSummary ? '\n\nNOTE: They had voice conversations with you this week - acknowledge topics they discussed verbally and connect them to this week\'s focus.' : ''}`;

    const userPrompt = isDaily ? dailyUserPrompt : weeklyUserPrompt;

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
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email",
              description: "Generate a personalized growth email with structured content",
              parameters: {
                type: "object",
                properties: {
                  subject: {
                    type: "string",
                    description: "Personalized subject line referencing something specific"
                  },
                  openingMessage: {
                    type: "string",
                    description: "1-2 sentences acknowledging something recent or specific"
                  },
                  mainContent: {
                    type: "string",
                    description: "2-3 paragraphs addressing their growth journey, acknowledging wins, addressing gaps, connecting to bigger vision"
                  },
                  actionableChallenge: {
                    type: "string",
                    description: "One clear, specific action they should take today/this week"
                  },
                  closingMessage: {
                    type: "string",
                    description: "Encouraging but firm closing statement"
                  }
                },
                required: ["subject", "openingMessage", "mainContent", "actionableChallenge", "closingMessage"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_email" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI did not return structured email content");
    }
    const emailContent = JSON.parse(toolCall.function.arguments);

    // Build test banner if this is a test email
    const testBanner = testRecipient ? `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
        <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0;">🧪 TEST EMAIL</p>
        <p style="color: #78350f; font-size: 13px; margin: 8px 0 0 0;">
          Sent to <strong>${testRecipient}</strong><br>
          Generated for <strong>${profile.full_name}</strong> (${profile.email})
        </p>
      </div>
    ` : '';

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
      ${testBanner}
      <h1 style="color: #1a1a1a; font-size: 24px; font-weight: bold; margin: 0 0 24px 0;">${emailContent.subject}</h1>
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi ${profile.full_name || 'there'},</p>
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">${emailContent.openingMessage}</p>
      
      ${(habitsContext.length > 0 || targetsContext.length > 0 || topCapability.length > 0) ? `
      <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
        <h3 style="color: #2d3748; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0;">📊 This Week By The Numbers</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
          ${habitsContext.length > 0 ? `
          <div style="text-align: center;">
            <div style="color: #667eea; font-size: 32px; font-weight: bold; margin: 0 0 4px 0;">${habitsContext.reduce((sum: number, h: any) => sum + h.recentCompletions, 0)}</div>
            <div style="color: #718096; font-size: 13px;">Habits Completed</div>
          </div>
          ` : ''}
          ${topCapability.length > 0 ? `
          <div style="text-align: center;">
            <div style="color: #667eea; font-size: 32px; font-weight: bold; margin: 0 0 4px 0;">1</div>
            <div style="color: #718096; font-size: 13px;">Priority Focus</div>
          </div>
          ` : ''}
          ${targetsContext.filter((t: any) => !t.completed).length > 0 ? `
          <div style="text-align: center;">
            <div style="color: #667eea; font-size: 32px; font-weight: bold; margin: 0 0 4px 0;">${targetsContext.filter((t: any) => !t.completed).length}</div>
            <div style="color: #718096; font-size: 13px;">Active Targets</div>
          </div>
          ` : ''}
          ${habitsContext.some((h: any) => h.currentStreak > 0) ? `
          <div style="text-align: center;">
            <div style="color: #667eea; font-size: 32px; font-weight: bold; margin: 0 0 4px 0;">${Math.max(...habitsContext.map((h: any) => h.currentStreak))}</div>
            <div style="color: #718096; font-size: 13px;">Day Streak</div>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}
      
      <div style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">${emailContent.mainContent.replace(/\n/g, '<br>')}</div>
      
      ${topCapability.length > 0 ? `
      <div style="margin: 24px 0; padding: 20px; background-color: #f7fafc; border-radius: 8px; border-left: 4px solid #667eea;">
        <h3 style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">
          🎯 Your Priority Focus This Week
        </h3>
        ${topCapability.map((cap: any) => {
          const levelMap: any = { 'foundational': 1, 'developing': 2, 'proficient': 3, 'advanced': 4, 'expert': 5 };
          const current = levelMap[cap.currentLevel] || 1;
          const target = levelMap[cap.targetLevel] || 5;
          const progress = ((current - 1) / (target - 1)) * 100;
          return `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #4a5568; font-size: 14px; font-weight: 500;">${cap.name}</span>
              <span style="color: #718096; font-size: 13px;">${cap.currentLevel} → ${cap.targetLevel}</span>
            </div>
            <div style="background-color: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; width: ${progress}%;"></div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
      ` : ''}
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h2 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">🎯 This Week's Challenge</h2>
        <p style="color: #ffffff; font-size: 15px; line-height: 1.6; margin: 0;">${emailContent.actionableChallenge}</p>
      </div>
      
      ${resourceForTopCap.length > 0 ? `
      <div style="margin: 32px 0;">
        <h2 style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin: 0 0 20px 0;">📚 This Week's Resource</h2>
        ${resourceForTopCap.map((resource: any) => `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          <div style="color: #667eea; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${resource.type}</div>
          <div style="color: #9ca3af; font-size: 11px; font-weight: 500; margin-bottom: 8px;">FOR: ${resource.capabilityName}</div>
          <h3 style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${resource.title}</h3>
          <p style="color: #4a5568; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">${resource.description}</p>
          ${resource.reasoning ? `
          <p style="color: #667eea; font-size: 13px; font-style: italic; line-height: 1.4; margin: 0 0 8px 0; padding-left: 12px; border-left: 2px solid #667eea;">
            💡 ${resource.reasoning}
          </p>
          ` : ''}
          <a href="${resource.url}" style="color: #667eea; text-decoration: none; font-size: 14px; font-weight: 500;">View Resource →</a>
        </div>
        `).join('')}
      </div>
      ` : ''}
      
      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 24px 0;">${emailContent.closingMessage}</p>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">Keep growing,<br><strong>Jericho</strong></p>
        <p style="color: #718096; font-size: 13px; line-height: 1.5; margin: 16px 0 20px 0; font-style: italic;">
          <strong>P.S.</strong> Have a question or feedback? Just reply to this email—I'm here to help!
        </p>
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

    // If preview mode, return HTML without sending
    if (preview) {
      console.log(`Preview mode - returning HTML for ${profile.email}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          preview: true,
          html: html,
          subject: emailContent.subject 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send email via Resend API directly
    const recipientEmail = testRecipient || profile.email;
    const messageId = `<${profile.id}-${Date.now()}@yourdomain.com>`;
    
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jericho <jericho@sender.askjericho.com>",
        to: [recipientEmail],
        subject: emailContent.subject,
        html: html,
        headers: {
          "Reply-To": "jericho@sender.askjericho.com",
          "Message-ID": messageId,
        },
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", resendResponse.status, errorText);
      throw new Error(`Email sending failed: ${resendResponse.status}`);
    }

    const emailData = await resendResponse.json();

    // Log email delivery with capability and resource tracking for variety
    const trackingData = {
      resourceId: resourceForTopCap[0]?.resourceId || null,
      capabilityId: topCapability[0]?.id || null,
      capabilityName: topCapability[0]?.name || null,
      resourceTitle: resourceForTopCap[0]?.title || null,
      frequency: emailFrequency
    };
    
    const { error: logError } = await supabase
      .from("email_deliveries")
      .insert({
        profile_id: profileId,
        company_id: profile.company_id,
        subject: emailContent.subject,
        body: html,
        status: "sent",
        resources_included: trackingData,
      });

    if (logError) {
      console.error("Failed to log email delivery:", logError);
    }

    const logMessage = testRecipient 
      ? `Test email sent to ${recipientEmail} (generated for ${profile.email})`
      : `Growth email sent to ${profile.email}`;
    console.log(logMessage, emailData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailData?.id,
        subject: emailContent.subject,
        recipient: recipientEmail
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
