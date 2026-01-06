import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailIntent {
  type: 'habit_checkin' | 'goal_update' | 'benchmark_update' | 'challenge_help' | 'sales_prep' | 'general_question' | 'update_report';
  confidence: number;
  details: Record<string, any>;
}

interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { logId } = await req.json();
    console.log("Processing email reply log:", logId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the email log entry
    const { data: logEntry, error: logError } = await supabase
      .from("email_reply_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logError || !logEntry) {
      throw new Error("Email log not found");
    }

    console.log("Found log entry for:", logEntry.email_from);

    // Find user by email - handle email formats like "Name <email@domain.com>"
    let senderEmail = logEntry.email_from.toLowerCase();
    const emailMatch = senderEmail.match(/<([^>]+)>/);
    if (emailMatch) {
      senderEmail = emailMatch[1].toLowerCase();
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, company_id")
      .eq("email", senderEmail)
      .single();

    if (profileError || !profile) {
      console.error("User not found for email:", senderEmail);
      
      await supabase.functions.invoke("send-email-reply", {
        body: {
          toEmail: senderEmail,
          subject: `Re: ${logEntry.email_subject}`,
          bodyText: `Hi there,\n\nI couldn't find your account in our system. Please make sure you're replying from the email address associated with your account, or contact support for assistance.\n\nBest,\nJericho`,
        },
      });

      await supabase
        .from("email_reply_logs")
        .update({
          processing_status: "error",
          error_message: "User not found",
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);

      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found user:", profile.full_name);

    // Rate limiting: Check emails in last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { count } = await supabase
      .from("email_reply_logs")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .gte("created_at", oneDayAgo.toISOString());

    if (count && count > 20) {
      console.log("Rate limit exceeded for user:", profile.id);
      
      await supabase.functions.invoke("send-email-reply", {
        body: {
          toEmail: profile.email,
          subject: `Re: ${logEntry.email_subject}`,
          bodyText: `Hi ${profile.full_name || 'there'},\n\nYou've reached the daily limit for email conversations. Please use the web app at https://askjericho.com for extended conversations, or try again tomorrow.\n\nBest,\nJericho`,
        },
      });

      await supabase
        .from("email_reply_logs")
        .update({
          processing_status: "rate_limited",
          profile_id: profile.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);

      return new Response(
        JSON.stringify({ error: "Rate limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ENHANCED: Fetch user's current context ============
    const userContext = await fetchUserContext(supabase, profile.id, profile.company_id);
    console.log("Fetched user context:", {
      habits: userContext.habits.length,
      goals: userContext.goals.length,
      knowledgeDocs: userContext.companyKnowledge.length,
    });

    // ============ ENHANCED: Parse email intent using AI ============
    const emailIntent = await parseEmailIntent(logEntry.email_body, userContext);
    console.log("Detected email intent:", emailIntent);

    // ============ ENHANCED: Execute actions based on intent ============
    const actionsPerformed: ActionResult[] = [];
    
    if (emailIntent.type === 'habit_checkin' && emailIntent.details.habitUpdates) {
      const habitResults = await processHabitCheckin(supabase, profile.id, profile.company_id, emailIntent.details.habitUpdates, userContext.habits);
      actionsPerformed.push(...habitResults);
    }

    if (emailIntent.type === 'goal_update' && emailIntent.details.goalUpdates) {
      const goalResults = await processGoalUpdates(supabase, profile.id, emailIntent.details.goalUpdates, userContext.goals);
      actionsPerformed.push(...goalResults);
    }

    if (emailIntent.type === 'benchmark_update' && emailIntent.details.benchmarkUpdates) {
      const benchmarkResults = await processBenchmarkUpdates(supabase, profile.id, emailIntent.details.benchmarkUpdates, userContext.goals);
      actionsPerformed.push(...benchmarkResults);
    }

    // Log updates to growth journal
    if (actionsPerformed.length > 0) {
      const successfulActions = actionsPerformed.filter(a => a.success);
      if (successfulActions.length > 0) {
        await supabase.from("growth_journal").insert({
          profile_id: profile.id,
          company_id: profile.company_id,
          entry_date: new Date().toISOString().split('T')[0],
          entry_text: `Email update: ${successfulActions.map(a => a.message).join('; ')}`,
          entry_source: "email_reply",
        });
      }
    }

    // Find or create conversation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("source", "email")
      .gte("updated_at", sevenDaysAgo.toISOString())
      .order("updated_at", { ascending: false })
      .limit(1);

    let conversationId: string;

    if (conversations && conversations.length > 0) {
      conversationId = conversations[0].id;
      console.log("Using existing conversation:", conversationId);
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          profile_id: profile.id,
          company_id: profile.company_id,
          title: "Email Conversation",
          source: "email",
        })
        .select()
        .single();

      if (convError || !newConv) {
        throw new Error("Failed to create conversation");
      }

      conversationId = newConv.id;
      console.log("Created new conversation:", conversationId);
    }

    // Store user's message in conversation
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: logEntry.email_body,
    });

    // ============ ENHANCED: Build context-rich prompt for Jericho ============
    const enhancedContext = buildEnhancedContext(userContext, emailIntent, actionsPerformed);

    // Call chat-with-jericho with enhanced context
    console.log("Calling chat-with-jericho with enhanced context...");
    const jerichoResponse = await callJerichoWithContext(
      supabase,
      supabaseUrl,
      conversationId,
      logEntry.email_body,
      enhancedContext,
      profile,
      emailIntent
    );

    console.log("Got Jericho response, length:", jerichoResponse.length);

    // Send email reply
    const { error: sendError } = await supabase.functions.invoke("send-email-reply", {
      body: {
        toEmail: profile.email,
        toName: profile.full_name,
        subject: `Re: ${logEntry.email_subject}`,
        bodyText: jerichoResponse,
        inReplyTo: logEntry.parsed_data?.message_id,
      },
    });

    if (sendError) {
      console.error("Error sending email reply:", sendError);
      throw sendError;
    }

    // Update log as processed
    await supabase
      .from("email_reply_logs")
      .update({
        processing_status: "processed",
        profile_id: profile.id,
        processed_at: new Date().toISOString(),
        parsed_data: {
          ...logEntry.parsed_data,
          conversation_id: conversationId,
          response_sent: true,
          intent_detected: emailIntent.type,
          actions_performed: actionsPerformed.length,
        },
      })
      .eq("id", logId);

    console.log("Email reply processed successfully with", actionsPerformed.length, "actions");

    return new Response(
      JSON.stringify({ success: true, conversationId, actionsPerformed: actionsPerformed.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in process-email-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============ Helper Functions ============

async function fetchUserContext(supabase: any, profileId: string, companyId: string) {
  // Fetch habits
  const { data: habits } = await supabase
    .from("leading_indicators")
    .select("id, habit_name, habit_description, target_frequency, is_active, current_streak")
    .eq("profile_id", profileId)
    .eq("is_active", true);

  // Fetch today's habit completions
  const today = new Date().toISOString().split('T')[0];
  const { data: todayCompletions } = await supabase
    .from("habit_completions")
    .select("habit_id")
    .eq("profile_id", profileId)
    .eq("completed_date", today);

  // Fetch 90-day goals with benchmarks and sprints
  const { data: goals } = await supabase
    .from("ninety_day_targets")
    .select("*")
    .eq("profile_id", profileId)
    .eq("completed", false)
    .order("created_at", { ascending: false });

  // Fetch company knowledge base for context
  const { data: companyKnowledge } = await supabase
    .from("company_knowledge")
    .select("id, title, content, category, document_type")
    .or(`company_id.eq.${companyId},is_global.eq.true`)
    .eq("is_active", true)
    .limit(20);

  // Fetch recent achievements
  const { data: achievements } = await supabase
    .from("achievements")
    .select("achievement_text, category, achieved_date")
    .eq("profile_id", profileId)
    .order("achieved_date", { ascending: false })
    .limit(5);

  // Fetch diagnostic scores
  const { data: diagnosticScores } = await supabase
    .from("diagnostic_scores")
    .select("*")
    .eq("profile_id", profileId)
    .single();

  return {
    habits: habits || [],
    todayCompletions: todayCompletions?.map((c: any) => c.habit_id) || [],
    goals: goals || [],
    companyKnowledge: companyKnowledge || [],
    achievements: achievements || [],
    diagnosticScores: diagnosticScores || null,
  };
}

async function parseEmailIntent(emailBody: string, userContext: any): Promise<EmailIntent> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const habitNames = userContext.habits.map((h: any) => h.habit_name).join(', ');
  const goalTexts = userContext.goals.map((g: any) => g.goal_text).slice(0, 5).join('; ');

  const prompt = `Analyze this email and determine the user's intent. The user is replying to their AI coach Jericho.

User's current habits: ${habitNames || 'None defined'}
User's current 90-day goals: ${goalTexts || 'None defined'}

Email content:
"${emailBody}"

Respond with a JSON object (no markdown, just pure JSON):
{
  "type": "habit_checkin" | "goal_update" | "benchmark_update" | "challenge_help" | "sales_prep" | "general_question" | "update_report",
  "confidence": 0.0-1.0,
  "details": {
    // For habit_checkin:
    "habitUpdates": [{"habitName": "...", "completed": true/false, "notes": "..."}],
    // For goal_update:
    "goalUpdates": [{"goalText": "partial match...", "progress": "description of progress", "completed": true/false}],
    // For benchmark_update:
    "benchmarkUpdates": [{"goalText": "partial match...", "benchmarkText": "...", "completed": true/false}],
    // For sales_prep:
    "companyName": "...", "contactName": "...", "meetingContext": "...",
    // For challenge_help:
    "challengeDescription": "...", "urgency": "low/medium/high"
  }
}

Rules:
- If they mention completing habits, checking off habits, or daily routines → habit_checkin
- If they mention making progress on goals, completing goals, or goal updates → goal_update
- If they mention completing benchmarks, milestones, or specific steps → benchmark_update
- If they mention a sales call, meeting prep, or pre-call plan → sales_prep
- If they mention struggling with something, need help, or facing a challenge → challenge_help
- If they provide multiple types of updates → update_report (combine all details)
- Otherwise → general_question`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("AI parsing failed:", response.status);
      return { type: 'general_question', confidence: 0.5, details: {} };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Clean up the response - remove markdown code blocks if present
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", cleanedContent);
      return { type: 'general_question', confidence: 0.5, details: {} };
    }
  } catch (error) {
    console.error("Error parsing email intent:", error);
    return { type: 'general_question', confidence: 0.5, details: {} };
  }
}

async function processHabitCheckin(supabase: any, profileId: string, companyId: string, habitUpdates: any[], userHabits: any[]): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  const today = new Date().toISOString().split('T')[0];

  for (const update of habitUpdates) {
    // Find matching habit by name (fuzzy match)
    const matchingHabit = userHabits.find((h: any) => 
      h.habit_name.toLowerCase().includes(update.habitName.toLowerCase()) ||
      update.habitName.toLowerCase().includes(h.habit_name.toLowerCase())
    );

    if (matchingHabit && update.completed) {
      // Check if already completed today
      const { data: existing } = await supabase
        .from("habit_completions")
        .select("id")
        .eq("habit_id", matchingHabit.id)
        .eq("profile_id", profileId)
        .eq("completed_date", today)
        .single();

      if (!existing) {
        const { error } = await supabase.from("habit_completions").insert({
          habit_id: matchingHabit.id,
          profile_id: profileId,
          completed_date: today,
          notes: update.notes || "Logged via email",
        });

        if (!error) {
          // Update streak
          await supabase
            .from("leading_indicators")
            .update({ 
              current_streak: (matchingHabit.current_streak || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq("id", matchingHabit.id);

          results.push({ success: true, message: `Logged habit: ${matchingHabit.habit_name}` });
        } else {
          results.push({ success: false, message: `Failed to log habit: ${matchingHabit.habit_name}` });
        }
      } else {
        results.push({ success: true, message: `Habit already logged today: ${matchingHabit.habit_name}` });
      }
    } else if (!matchingHabit) {
      results.push({ success: false, message: `Could not find habit matching: ${update.habitName}` });
    }
  }

  return results;
}

async function processGoalUpdates(supabase: any, profileId: string, goalUpdates: any[], userGoals: any[]): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const update of goalUpdates) {
    // Find matching goal (fuzzy match)
    const matchingGoal = userGoals.find((g: any) => 
      g.goal_text.toLowerCase().includes(update.goalText.toLowerCase()) ||
      update.goalText.toLowerCase().includes(g.goal_text.substring(0, 30).toLowerCase())
    );

    if (matchingGoal) {
      if (update.completed) {
        const { error } = await supabase
          .from("ninety_day_targets")
          .update({ 
            completed: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", matchingGoal.id);

        if (!error) {
          results.push({ success: true, message: `Marked goal as completed: ${matchingGoal.goal_text.substring(0, 50)}...` });
        }
      } else if (update.progress) {
        // Log progress in growth journal (goals don't have a progress field, but we track it)
        results.push({ success: true, message: `Noted progress on goal: ${matchingGoal.goal_text.substring(0, 50)}...` });
      }
    } else {
      results.push({ success: false, message: `Could not find goal matching: ${update.goalText}` });
    }
  }

  return results;
}

async function processBenchmarkUpdates(supabase: any, profileId: string, benchmarkUpdates: any[], userGoals: any[]): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const update of benchmarkUpdates) {
    // Find matching goal
    const matchingGoal = userGoals.find((g: any) => 
      g.goal_text.toLowerCase().includes(update.goalText.toLowerCase()) ||
      update.goalText.toLowerCase().includes(g.goal_text.substring(0, 30).toLowerCase())
    );

    if (matchingGoal && matchingGoal.benchmarks) {
      const benchmarks = typeof matchingGoal.benchmarks === 'string' 
        ? JSON.parse(matchingGoal.benchmarks) 
        : matchingGoal.benchmarks;

      // Find and update the benchmark
      let updated = false;
      const updatedBenchmarks = benchmarks.map((b: any) => {
        if (b.text?.toLowerCase().includes(update.benchmarkText.toLowerCase()) ||
            update.benchmarkText.toLowerCase().includes(b.text?.substring(0, 20).toLowerCase())) {
          updated = true;
          return { ...b, completed: update.completed };
        }
        return b;
      });

      if (updated) {
        const { error } = await supabase
          .from("ninety_day_targets")
          .update({ 
            benchmarks: updatedBenchmarks,
            updated_at: new Date().toISOString()
          })
          .eq("id", matchingGoal.id);

        if (!error) {
          results.push({ success: true, message: `Updated benchmark on goal: ${matchingGoal.goal_text.substring(0, 40)}...` });
        }
      }
    }
  }

  return results;
}

function buildEnhancedContext(userContext: any, intent: EmailIntent, actions: ActionResult[]): string {
  const parts: string[] = [];

  // Add action results summary
  if (actions.length > 0) {
    const successful = actions.filter(a => a.success);
    const failed = actions.filter(a => !a.success);
    
    if (successful.length > 0) {
      parts.push(`ACTIONS COMPLETED:\n${successful.map(a => `✓ ${a.message}`).join('\n')}`);
    }
    if (failed.length > 0) {
      parts.push(`ACTIONS THAT NEED ATTENTION:\n${failed.map(a => `✗ ${a.message}`).join('\n')}`);
    }
  }

  // Add current habits status
  if (userContext.habits.length > 0) {
    const habitStatus = userContext.habits.map((h: any) => {
      const completed = userContext.todayCompletions.includes(h.id);
      return `- ${h.habit_name}: ${completed ? '✓ Done today' : '○ Not yet'} (streak: ${h.current_streak || 0})`;
    }).join('\n');
    parts.push(`TODAY'S HABITS:\n${habitStatus}`);
  }

  // Add active goals
  if (userContext.goals.length > 0) {
    const goalSummary = userContext.goals.slice(0, 5).map((g: any) => {
      let benchmarks: any[] = [];
      try {
        const parsed = g.benchmarks ? (typeof g.benchmarks === 'string' ? JSON.parse(g.benchmarks) : g.benchmarks) : [];
        benchmarks = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        benchmarks = [];
      }
      const completedBenchmarks = benchmarks.filter((b: any) => b.completed).length;
      return `- ${g.goal_text.substring(0, 60)}${g.goal_text.length > 60 ? '...' : ''} [${completedBenchmarks}/${benchmarks.length} benchmarks]`;
    }).join('\n');
    parts.push(`ACTIVE 90-DAY GOALS:\n${goalSummary}`);
  }

  // Add diagnostic scores if available
  if (userContext.diagnosticScores) {
    const ds = userContext.diagnosticScores;
    parts.push(`CURRENT SCORES: Engagement: ${ds.engagement_score || 'N/A'}, Career: ${ds.career_score || 'N/A'}, Skills: ${ds.skills_score || 'N/A'}`);
  }

  // For sales prep, include relevant knowledge
  if (intent.type === 'sales_prep' && userContext.companyKnowledge.length > 0) {
    const salesDocs = userContext.companyKnowledge.filter((k: any) => 
      k.category?.toLowerCase().includes('sales') || 
      k.document_type?.toLowerCase().includes('sales') ||
      k.title?.toLowerCase().includes('sales')
    );
    if (salesDocs.length > 0) {
      parts.push(`AVAILABLE SALES RESOURCES:\n${salesDocs.map((d: any) => `- ${d.title}`).join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

async function callJerichoWithContext(
  supabase: any,
  supabaseUrl: string,
  conversationId: string,
  userMessage: string,
  enhancedContext: string,
  profile: any,
  intent: EmailIntent
): Promise<string> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

  // Build a specialized system prompt based on intent
  let intentGuidance = '';
  switch (intent.type) {
    case 'habit_checkin':
      intentGuidance = `The user is checking in about their habits. Acknowledge what was logged, encourage their consistency, and gently remind them of any habits not yet completed today.`;
      break;
    case 'goal_update':
      intentGuidance = `The user is updating you on goal progress. Celebrate their wins, ask clarifying questions about next steps, and help them maintain momentum.`;
      break;
    case 'benchmark_update':
      intentGuidance = `The user completed benchmarks/milestones. Acknowledge the specific progress, connect it to their larger goal, and guide them to the next benchmark.`;
      break;
    case 'sales_prep':
      intentGuidance = `The user needs help preparing for a sales call. Provide a structured pre-call plan including: 1) Research summary (what to know), 2) Key questions to ask, 3) Value propositions to highlight, 4) Potential objections and responses, 5) Clear next steps/ask.`;
      break;
    case 'challenge_help':
      intentGuidance = `The user is facing a challenge. Listen empathetically first, then provide practical, actionable advice. Ask clarifying questions if needed. Keep the response focused and supportive.`;
      break;
    case 'update_report':
      intentGuidance = `The user is providing multiple updates. Acknowledge each update systematically, celebrate wins, and provide a brief summary of their overall progress.`;
      break;
    default:
      intentGuidance = `Respond helpfully to the user's message. Be warm, supportive, and action-oriented.`;
  }

  const systemPrompt = `You are Jericho, an AI growth coach responding via email. This user is ${profile.full_name || 'a team member'}.

${intentGuidance}

CONTEXT FROM THEIR ACCOUNT:
${enhancedContext}

IMPORTANT GUIDELINES:
- Keep your response concise and email-friendly (2-4 paragraphs max)
- Be warm and personal - you know this person
- If you logged actions for them, confirm what was done
- Always end with a clear next step or encouraging close
- If they mentioned something you couldn't process, let them know and suggest alternatives
- Remember they can reply to continue the conversation
- Reference specific goals, habits, or achievements by name when relevant
- For sales prep requests, provide a structured, actionable plan

DO NOT:
- Use markdown formatting (no **, ##, etc.) - this is plain text email
- Include any URLs or links
- Reference the web app unless specifically needed
- Be overly formal or robotic`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error("AI response failed:", response.status);
      return "I'm having some trouble processing your message right now. Please try again in a moment, or log into the app at askjericho.com for immediate assistance.";
    }

    const data = await response.json();
    const jerichoMessage = data.choices[0]?.message?.content || "I received your message but couldn't generate a proper response. Please try again.";

    // Store Jericho's response in conversation
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: jerichoMessage,
    });

    return jerichoMessage;
  } catch (error) {
    console.error("Error calling AI:", error);
    return "I'm having some trouble right now. Please try again later or visit askjericho.com.";
  }
}
