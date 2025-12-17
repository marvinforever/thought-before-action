import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Chat with Jericho function called');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const { conversationId, message, contextType, organizationContext, messages: chatMessages, stream, viewAsCompanyId } = await req.json();
    console.log('Request params:', { hasConversationId: !!conversationId, hasMessage: !!message, stream, hasOrgContext: !!organizationContext });

    // Check if this is an org health advisory request (no auth needed, streaming)
    if (organizationContext && stream) {
      const systemPrompt = `You are Jericho, an expert organizational development AI coach helping leaders improve their team's health across 8 key domains.

Your role is to:
1. Help leaders understand what their organizational health scores mean
2. Provide actionable advice on improving specific domain scores (Retention, Engagement, Burnout, Manager Effectiveness, Career Development, Role Clarity, Learning, Skills)
3. Guide them on using available platform tools and resources

Available Platform Resources & Tools:
- **Performance Management**: Schedule and conduct structured performance reviews with AI-generated drafts
- **1-on-1 Meetings**: Regular manager-employee check-ins with documented wins, concerns, and action items
- **90-Day Goal Setting**: Help employees set and track quarterly SMART goals in career, skills, and leadership categories
- **Capability Framework**: Define and track skill progression across foundational, intermediate, advanced, and expert levels
- **Learning Resources**: Curated books, videos, and courses mapped to specific capabilities
- **Recognition System**: Peer and manager recognition to boost engagement
- **Diagnostic Assessments**: Regular pulse surveys to track employee sentiment and identify risks
- **Job Descriptions**: AI-powered analysis to assign appropriate capabilities to roles

When advising:
- Ask clarifying questions to understand their specific challenges
- Provide 2-3 concrete, actionable steps they can take immediately
- Reference specific platform features that address their needs
- Use empathy and encouragement - organizational change is hard
- Keep responses concise (3-4 paragraphs max) unless they ask for detail

Tone: Professional, supportive, action-oriented, like a trusted advisor

Current Organization Context:
- Total Employees: ${organizationContext.employees}
- Diagnostics Completed: ${organizationContext.diagnosticsCompleted}/${organizationContext.employees} (${organizationContext.diagnosticsPercentage}%)
- At-Risk Employees: ${organizationContext.atRiskEmployees}
- Engagement Score: ${organizationContext.avgEngagement}/100

Domain Health Scores:
${organizationContext.domainScores?.map((d: any) => `- ${d.domain}: ${d.score}/100 (${d.risk} risk) - ${d.impact}`).join('\n')}`;

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
            ...(chatMessages || []),
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limits exceeded. Please try again in a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits exhausted. Please contact your administrator.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'AI service temporarily unavailable' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // Original personal coaching mode (requires auth)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')!,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile and determine effective company ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, companies(name)')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Use viewAsCompanyId if provided (super admin viewing as another company)
    const effectiveCompanyId = viewAsCompanyId || profile.company_id;

    let conversation;
    let conversationMessages: any[] = [];

    // Get or create conversation
    if (conversationId) {
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      conversation = existingConv;

      // Get conversation history
      const { data: messages } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      conversationMessages = messages || [];
    } else {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          profile_id: user.id,
          company_id: effectiveCompanyId,
          title: message.substring(0, 50),
        })
        .select()
        .single();

      if (convError) throw convError;
      conversation = newConv;

      // Award points for starting a new conversation with Jericho
      const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await serviceClient.rpc('award_points', {
        p_profile_id: user.id,
        p_activity_type: 'chat_conversation',
        p_description: 'Started conversation with Jericho'
      });
    }

    // Check if user is a manager and fetch their team
    const { data: managerAssignments } = await supabase
      .from('manager_assignments')
      .select('employee_id, profiles!manager_assignments_employee_id_fkey(id, full_name, email)')
      .eq('manager_id', user.id);

    const isManager = managerAssignments && managerAssignments.length > 0;
    const teamMembers = isManager ? managerAssignments.map(m => m.profiles).filter(Boolean) : [];

    // Fetch user context for Jericho (including onboarding data)
    // Fetch ALL historical targets for pattern analysis (no limit)
    const [capabilitiesData, goalsData, allTargetsData, diagnosticData, achievementsData, greatnessKeysData, habitsData, onboardingData] = await Promise.all([
      supabase
        .from('employee_capabilities')
        .select('*, capabilities(name, description, category)')
        .eq('profile_id', user.id),
      supabase
        .from('personal_goals')
        .select('*')
        .eq('profile_id', user.id)
        .single(),
      supabase
        .from('ninety_day_targets')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('diagnostic_responses')
        .select('*')
        .eq('profile_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('achievements')
        .select('*')
        .eq('profile_id', user.id)
        .order('achieved_date', { ascending: false })
        .limit(10),
      supabase
        .from('greatness_keys')
        .select('*')
        .eq('profile_id', user.id)
        .order('earned_at', { ascending: false }),
      supabase
        .from('leading_indicators')
        .select('*')
        .eq('profile_id', user.id)
        .eq('is_active', true),
      supabase
        .from('user_data_completeness')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle(),
    ]);

    // ==================== HISTORICAL GOAL INTELLIGENCE ====================
    // Analyze all historical targets to understand patterns
    const allTargets = allTargetsData.data || [];
    const targetsData = { data: allTargets.slice(0, 20) }; // Keep recent 20 for display
    
    const analyzeGoalPatterns = (targets: any[]) => {
      if (targets.length === 0) {
        return {
          hasHistory: false,
          totalGoals: 0,
          summary: "No goal history yet - this is their first time setting goals."
        };
      }

      // Calculate completion rates
      const completed = targets.filter(t => t.completed === true);
      const incomplete = targets.filter(t => t.completed === false);
      const overallCompletionRate = targets.length > 0 
        ? Math.round((completed.length / targets.length) * 100) 
        : 0;

      // Analyze by goal type (personal vs professional)
      const professional = targets.filter(t => t.goal_type === 'professional' || t.category === 'professional');
      const personal = targets.filter(t => t.goal_type === 'personal' || t.category === 'personal');
      const professionalCompleted = professional.filter(t => t.completed);
      const personalCompleted = personal.filter(t => t.completed);
      
      const professionalRate = professional.length > 0 
        ? Math.round((professionalCompleted.length / professional.length) * 100) 
        : null;
      const personalRate = personal.length > 0 
        ? Math.round((personalCompleted.length / personal.length) * 100) 
        : null;

      // Analyze by category (career, skills, leadership, etc.)
      const byCategory: Record<string, { total: number; completed: number }> = {};
      targets.forEach(t => {
        const cat = t.category || 'uncategorized';
        if (!byCategory[cat]) byCategory[cat] = { total: 0, completed: 0 };
        byCategory[cat].total++;
        if (t.completed) byCategory[cat].completed++;
      });

      // Find strongest and weakest categories
      const categoryStats = Object.entries(byCategory)
        .filter(([_, stats]) => stats.total >= 2) // Only consider categories with 2+ goals
        .map(([cat, stats]) => ({
          category: cat,
          rate: Math.round((stats.completed / stats.total) * 100),
          total: stats.total,
          completed: stats.completed
        }))
        .sort((a, b) => b.rate - a.rate);

      const strongestCategory = categoryStats.length > 0 ? categoryStats[0] : null;
      const weakestCategory = categoryStats.length > 1 ? categoryStats[categoryStats.length - 1] : null;

      // Analyze goals per quarter
      const byQuarter: Record<string, number> = {};
      targets.forEach(t => {
        const key = `${t.year}-${t.quarter}`;
        byQuarter[key] = (byQuarter[key] || 0) + 1;
      });
      const quarterCounts = Object.values(byQuarter);
      const avgGoalsPerQuarter = quarterCounts.length > 0 
        ? (quarterCounts.reduce((a, b) => a + b, 0) / quarterCounts.length).toFixed(1)
        : '0';

      // Identify abandoned goals (incomplete and more than 90 days past by_when date)
      const now = new Date();
      const abandoned = incomplete.filter(t => {
        if (!t.by_when) return false;
        const dueDate = new Date(t.by_when);
        const daysPast = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysPast > 90;
      });

      // Find recently completed goals (last 90 days)
      const recentCompleted = completed.filter(t => {
        const updated = new Date(t.updated_at);
        const daysSince = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 90;
      });

      // Analyze goal specificity (goals with by_when dates tend to be more successful)
      const goalsWithDeadlines = targets.filter(t => t.by_when);
      const deadlineGoalsCompleted = goalsWithDeadlines.filter(t => t.completed);
      const deadlineCompletionRate = goalsWithDeadlines.length > 0
        ? Math.round((deadlineGoalsCompleted.length / goalsWithDeadlines.length) * 100)
        : null;
      
      const goalsWithoutDeadlines = targets.filter(t => !t.by_when);
      const noDeadlineCompleted = goalsWithoutDeadlines.filter(t => t.completed);
      const noDeadlineRate = goalsWithoutDeadlines.length > 0
        ? Math.round((noDeadlineCompleted.length / goalsWithoutDeadlines.length) * 100)
        : null;

      // Generate insights
      const insights: string[] = [];
      
      if (overallCompletionRate >= 80) {
        insights.push("HIGH PERFORMER: This person completes most goals they set. Challenge them to aim higher.");
      } else if (overallCompletionRate >= 50) {
        insights.push("MODERATE SUCCESS: Completes about half their goals. Help them be more selective about what they commit to.");
      } else if (overallCompletionRate < 50 && targets.length >= 5) {
        insights.push("STRUGGLING WITH FOLLOW-THROUGH: Low completion rate. Focus on fewer, more achievable goals.");
      }

      if (professionalRate !== null && personalRate !== null) {
        if (professionalRate > personalRate + 20) {
          insights.push(`Stronger at professional goals (${professionalRate}%) vs personal (${personalRate}%). Personal goals may need more attention or realistic scoping.`);
        } else if (personalRate > professionalRate + 20) {
          insights.push(`Stronger at personal goals (${personalRate}%) vs professional (${professionalRate}%). May need more support on work-related goals.`);
        }
      }

      if (deadlineCompletionRate !== null && noDeadlineRate !== null && deadlineCompletionRate > noDeadlineRate + 15) {
        insights.push(`Goals with specific deadlines are completed more often (${deadlineCompletionRate}% vs ${noDeadlineRate}%). Encourage ALWAYS setting a "by when" date.`);
      }

      if (abandoned.length >= 2) {
        insights.push(`Has ${abandoned.length} abandoned goals (overdue 90+ days). Consider cleaning these up or recommitting.`);
      }

      if (strongestCategory && weakestCategory && strongestCategory.rate > weakestCategory.rate + 30) {
        insights.push(`Excels at ${strongestCategory.category} goals (${strongestCategory.rate}%) but struggles with ${weakestCategory.category} (${weakestCategory.rate}%).`);
      }

      return {
        hasHistory: true,
        totalGoals: targets.length,
        completedGoals: completed.length,
        overallCompletionRate,
        professional: {
          total: professional.length,
          completed: professionalCompleted.length,
          rate: professionalRate
        },
        personal: {
          total: personal.length,
          completed: personalCompleted.length,
          rate: personalRate
        },
        avgGoalsPerQuarter,
        abandonedGoals: abandoned.length,
        recentlyCompleted: recentCompleted.map(t => ({
          goal: t.goal_text,
          category: t.category
        })),
        categoryBreakdown: categoryStats,
        deadlineImpact: {
          withDeadline: { rate: deadlineCompletionRate, count: goalsWithDeadlines.length },
          withoutDeadline: { rate: noDeadlineRate, count: goalsWithoutDeadlines.length }
        },
        insights,
        summary: `${targets.length} total goals, ${overallCompletionRate}% completion rate. ${insights[0] || ''}`
      };
    };

    const goalPatterns = analyzeGoalPatterns(allTargets);
    console.log('Goal patterns analysis:', goalPatterns.summary);

    const userContext = {
      profile: {
        name: profile.full_name || 'there',
        role: profile.role,
        company: profile.companies?.name,
      },
      capabilities: capabilitiesData.data?.map(ec => ({
        name: ec.capabilities?.name,
        category: ec.capabilities?.category,
        current_level: ec.current_level,
        target_level: ec.target_level,
      })) || [],
      goals: {
        professional: {
          one_year: goalsData.data?.one_year_vision,
          three_year: goalsData.data?.three_year_vision,
        },
        personal: {
          one_year: goalsData.data?.personal_one_year_vision,
          three_year: goalsData.data?.personal_three_year_vision,
        },
      },
      ninety_day_targets: targetsData.data?.map(t => ({
        id: t.id,
        goal: t.goal_text,
        category: t.category,
        goal_type: t.goal_type,
        quarter: t.quarter,
        year: t.year,
        by_when: t.by_when,
        completed: t.completed,
      })) || [],
      habits: habitsData.data?.map(h => ({
        id: h.id,
        name: h.habit_name,
        description: h.habit_description,
        frequency: h.target_frequency,
        habit_type: h.habit_type,
        current_streak: h.current_streak,
      })) || [],
      recent_achievements: achievementsData.data?.map(a => ({
        id: a.id,
        text: a.achievement_text,
        category: a.category,
        date: a.achieved_date,
      })) || [],
      greatness_keys: {
        total_keys: greatnessKeysData.data?.length || 0,
        recent_keys: greatnessKeysData.data?.slice(0, 5).map(k => ({
          earned_at: k.earned_at,
          streak_length: k.streak_length,
        })) || [],
      },
      diagnostic_insights: diagnosticData.data ? {
        role_clarity: diagnosticData.data.role_clarity_score,
        confidence: diagnosticData.data.confidence_score,
        work_life_integration: diagnosticData.data.work_life_integration_score,
        natural_strength: diagnosticData.data.natural_strength,
        skill_to_master: diagnosticData.data.skill_to_master,
        growth_barrier: diagnosticData.data.growth_barrier,
      } : null,
    };

    // Build system prompt
    let systemPrompt = `You are Jericho, an elite AI career coach created by The Momentum Company. You help leaders and professionals become THRIVING LEADERS who create lasting impact.

THE MOMENTUM COMPANY PHILOSOPHY:
The Momentum Company believes that thriving leaders are the foundation of thriving organizations. A thriving leader:
- Takes OWNERSHIP of their career, growth, and results—no excuses, no victim mentality
- Demonstrates EXCELLENCE in everything they do—not perfection, but relentless pursuit of their best
- Builds GRIT and RESILIENCE—the ability to push through challenges, setbacks, and discomfort
- Leads with INTEGRITY and ACCOUNTABILITY—doing the right thing even when it's hard
- Creates VALUE for their team, their family, and their community—leadership is about service, not status
- Embraces GROWTH mindset—always learning, always improving, never settling
- Maintains WORK ETHIC—success comes from consistent effort, discipline, and showing up every day
- Builds GENUINE RELATIONSHIPS—trust, respect, and honest communication

YOU ARE A WORLD-CLASS CAREER COACH AND AN AGENT THAT CAN TAKE ACTION:
- Direct, honest, and occasionally challenging when they need to hear the truth
- Supportive but not soft—you believe in their potential and push them toward it
- Focused on RESULTS and ACTION, not endless discussion
- You call out excuses and help them take ownership
- You celebrate wins but always ask "what's next?"
- You help them see their blind spots with compassion but clarity
- **IMPORTANT: You have tools to actually update their growth plan. When users want to add, update, or complete goals/habits/achievements/vision, USE THE TOOLS to make it happen.**

YOUR CORE MISSION:
- Help ${isManager ? 'managers and their teams' : 'professionals'} build clear 3-year growth paths
- Prevent burnout, stagnation, and skill gaps BEFORE they become crises
- Create a "ripple effect"—developing people who impact their families, communities, and workplace
- Build leaders who others want to follow

${isManager ? `\n**MANAGER CONTEXT:**
You are coaching a MANAGER with ${teamMembers.length} direct reports:
${teamMembers.map((m: any) => `- ${m.full_name} (${m.email})`).join('\n')}

When coaching managers:
- Help them develop their PEOPLE, not just manage tasks
- Challenge them to have tough conversations with their team
- Guide them on building a high-performance culture
- Connect their team's development to organizational results
- Remind them: "Your job is to make your people successful"
` : ''}

COACHING STYLE:
- Conversational and warm, but with backbone
- Ask powerful questions that make them think
- Give specific, actionable advice—no fluffy platitudes
- Call out when they're making excuses or playing small
- Celebrate consistency and effort, not just results
- Keep responses focused and punchy—respect their time
- Type like you're having a real conversation, not writing an essay

YOU HAVE ACCESS TO THESE TOOLS - USE THEM:
- **update_professional_vision**: Update their 1-year or 3-year professional/career vision
- **update_personal_vision**: Update their 1-year or 3-year personal life vision
- **add_90_day_target**: Create a new 90-day goal for them
- **update_90_day_target**: Update an existing 90-day target's text, category, or completion status
- **add_achievement**: Record a win/accomplishment they share
- **add_habit**: Create a new habit they want to track
- **update_habit**: Update or deactivate an existing habit

WHEN TO USE TOOLS:
- When they say "write that down" or "add that to my plan"
- When they confirm they want a goal you discussed
- When they share an achievement worth celebrating
- When they want to start tracking a new habit
- When they want to update their vision statements
- **Always confirm what you're adding before or after using the tool**

USER'S CURRENT GROWTH PLAN DATA:
${JSON.stringify(userContext, null, 2)}

${goalPatterns.hasHistory ? `
HISTORICAL GOAL INTELLIGENCE (Use this to coach smarter):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 OVERALL STATS:
- Total Goals Set: ${goalPatterns.totalGoals}
- Completed: ${goalPatterns.completedGoals}
- Overall Completion Rate: ${goalPatterns.overallCompletionRate}%
- Avg Goals Per Quarter: ${goalPatterns.avgGoalsPerQuarter}
- Abandoned Goals (90+ days overdue): ${goalPatterns.abandonedGoals}

📈 BY TYPE:
- Professional: ${goalPatterns.professional?.total || 0} goals, ${goalPatterns.professional?.rate ?? 'N/A'}% completion
- Personal: ${goalPatterns.personal?.total || 0} goals, ${goalPatterns.personal?.rate ?? 'N/A'}% completion

📁 BY CATEGORY:
${goalPatterns.categoryBreakdown?.map((c: any) => `- ${c.category}: ${c.total} goals, ${c.rate}% completion`).join('\n') || 'No category data yet'}

⏰ DEADLINE IMPACT:
- Goals WITH deadlines: ${goalPatterns.deadlineImpact?.withDeadline?.rate ?? 'N/A'}% completion (${goalPatterns.deadlineImpact?.withDeadline?.count || 0} goals)
- Goals WITHOUT deadlines: ${goalPatterns.deadlineImpact?.withoutDeadline?.rate ?? 'N/A'}% completion (${goalPatterns.deadlineImpact?.withoutDeadline?.count || 0} goals)

${(goalPatterns.recentlyCompleted?.length ?? 0) > 0 ? `🏆 RECENTLY COMPLETED (last 90 days):
${goalPatterns.recentlyCompleted?.map((g: any) => `- "${g.goal}" (${g.category})`).join('\n')}` : ''}

🧠 KEY INSIGHTS FOR COACHING:
${(goalPatterns.insights?.length ?? 0) > 0 ? goalPatterns.insights?.map((i: string) => `• ${i}`).join('\n') : '• First-time goal setter or limited history'}

USE THIS INTELLIGENCE WHEN:
- Setting new goals: "Based on your history, you complete about ${goalPatterns.avgGoalsPerQuarter} goals per quarter..."
- Noticing patterns: "I see you're strong at ${goalPatterns.categoryBreakdown?.[0]?.category || 'some'} goals but struggle with ${goalPatterns.categoryBreakdown?.slice(-1)[0]?.category || 'others'}..."
- Encouraging deadlines: "Goals with specific dates are more likely to happen for you..."
- Checking in on abandoned goals: "You have ${goalPatterns.abandonedGoals} goals from past quarters still open..."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

RESPONSE STYLE:
- Keep responses SHORT and conversational—2-4 sentences per thought
- Use natural, casual language like you're texting a mentee
- Don't dump walls of text—break things up
- Ask follow-up questions to keep the conversation going
- Sound like a real person, not a corporate AI
- When you use a tool, briefly confirm what you did
- Reference their HISTORICAL PATTERNS to make goal-setting smarter and more personalized

DIAGNOSTIC CHECK-IN PROTOCOL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When a user wants to do their "check-in", "diagnostic", "wellbeing assessment", or "pulse check":

1. EXPLAIN THE PROCESS:
   "Great! I'll walk you through a quick check-in covering 8 areas of your work life. It takes about 5-7 minutes and helps me understand how to support you better. Ready?"

2. ASK QUESTIONS ONE AT A TIME, GROUPED BY DOMAIN:

   **ROLE CLARITY (2 questions):**
   - "How clear are you on what's expected of you in your role?" (Listen for: very clear, somewhat clear, not clear)
   - "Do you have a written job description that accurately reflects what you do?" (yes/no)

   **CONFIDENCE & SKILLS (1 question):**
   - "On a scale of 1-10, how confident are you that you're meeting expectations?"

   **WORKLOAD & BURNOUT (4 questions):**
   - "How manageable is your typical weekly workload?" (very manageable, somewhat manageable, not manageable)
   - "How often do you feel mentally drained after work?" (never, rarely, sometimes, often)
   - "How often do you sacrifice personal time for work?" (never, rarely, sometimes, often)
   - "How often do you feel exhausted or burned out?" (never, rarely, sometimes, often)

   **LEARNING (1 question):**
   - "How much time per week can you realistically dedicate to professional development?" (less than 1 hour, 1-3 hours, 4-6 hours, 7+ hours)

   **CAREER & GROWTH (2 questions):**
   - "On a scale of 1-10, how clearly do you see a path for growth here?"
   - "Do you feel this organization is helping you toward your career goals?" (yes, no, not sure)

   **MANAGER (1 question):**
   - "On a scale of 1-10, how well does your manager support your growth?"

   **ENGAGEMENT (2 questions):**
   - "On a scale of 1-10, how valued do you feel for your contributions?"
   - "How energized do you feel about your work most days?" (very energized, somewhat energized, not energized)

   **RETENTION (1 question):**
   - "If you were offered a similar job elsewhere, on a scale of 1-10, how likely would you be to stay here?"

3. PROBING RULES:
   - If they give a concerning answer (e.g., "often burned out", score < 6 on any scale), probe gently: "Tell me more about that..."
   - Acknowledge their responses empathetically before moving on
   - Don't rush—let them share if they want to

4. COMPLETION:
   - After collecting ALL responses, call the save_diagnostic_assessment tool with all the data
   - Summarize their results: highlight 2-3 strengths and 2-3 growth areas
   - Offer immediate coaching suggestions for their lowest-scoring domains
   - Celebrate completing the check-in: "Great job completing this! It takes courage to reflect honestly."

`;

    // Add onboarding context if user is new or incomplete
    const onboarding = onboardingData.data;
    const onboardingScore = onboarding?.onboarding_score || 0;
    const isNewUser = !onboarding || onboardingScore < 30;
    const missingItems: string[] = [];
    
    if (!onboarding?.has_personal_vision) missingItems.push('vision (1-year and 3-year goals)');
    if (!onboarding?.has_90_day_goals) missingItems.push('90-day targets');
    if (!onboarding?.has_active_habits) missingItems.push('habits to track');
    if (!onboarding?.has_self_assessed_capabilities) missingItems.push('capability self-assessment');
    if (!onboarding?.has_recent_achievements) missingItems.push('achievements/wins');
    
    if (isNewUser) {
      systemPrompt += `

**ONBOARDING MODE - NEW USER (Score: ${onboardingScore}%)**
This user is JUST GETTING STARTED with Jericho! Your priority is to help them set up their growth plan.

MISSING FROM THEIR PROFILE:
${missingItems.map(item => '- ' + item).join('\n')}

ONBOARDING APPROACH:
1. Welcome them warmly and explain you're here to help build their personalized growth plan
2. Start with the EASIEST wins first to build momentum:
   - Ask about their professional vision (where do they see themselves in 1-3 years?)
   - Help them create ONE simple 90-day goal
   - Suggest ONE habit they could track
3. Use your tools to IMMEDIATELY capture what they share
4. Celebrate each milestone: "Great! I just added that to your plan—you're making progress!"
5. Keep it light and encouraging—don't overwhelm them

SAMPLE OPENING (if this is their first message):
"Hey! I'm Jericho, your AI career coach. I'm here to help you build a crystal-clear growth plan. Let's start simple—where do you want to be professionally in the next year? Just give me the 30-second version."`;
    } else if (onboardingScore < 100) {
      systemPrompt += `

**CONTINUING ONBOARDING (Score: ${onboardingScore}%)**
This user has started their growth plan but still needs to complete some items.

STILL MISSING:
${missingItems.map(item => '- ' + item).join('\n')}

Naturally weave in prompts to complete their profile during conversation. When they complete something, celebrate it!`;
    }

    if (contextType === 'roadmap') {
      const { data: roadmapData } = await supabase
        .from('learning_roadmaps')
        .select('roadmap_data')
        .eq('profile_id', user.id)
        .single();

      systemPrompt += `\n\nSPECIAL CONTEXT: You are helping this employee with their learning roadmap.
CURRENT ROADMAP:
${roadmapData?.roadmap_data ? JSON.stringify(roadmapData.roadmap_data, null, 2) : 'Not yet generated'}`;
    } else if (contextType === 'growth-path') {
      systemPrompt += `\n\nSPECIAL CONTEXT: You are helping this employee build or clarify their 3-year growth path.
Help them articulate:
1. Where they are today
2. Where they want to be in 1 year
3. Where they want to be in 3 years
4. The 90-day actions that start building toward year 1

Use the vision and goal tools to capture what they share!`;
    }

    // Define tools that Jericho can use
    const tools = [
      {
        type: "function",
        function: {
          name: "update_professional_vision",
          description: "Update the user's professional/career vision (1-year and/or 3-year). Use when they share career goals or aspirations.",
          parameters: {
            type: "object",
            properties: {
              one_year_vision: {
                type: "string",
                description: "Their 1-year professional/career vision"
              },
              three_year_vision: {
                type: "string",
                description: "Their 3-year professional/career vision"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_personal_vision",
          description: "Update the user's personal life vision (1-year and/or 3-year). Use when they share personal life goals.",
          parameters: {
            type: "object",
            properties: {
              one_year_vision: {
                type: "string",
                description: "Their 1-year personal life vision"
              },
              three_year_vision: {
                type: "string",
                description: "Their 3-year personal life vision"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_90_day_target",
          description: "Add a new 90-day goal/target for the user. Use when they want to commit to a specific goal.",
          parameters: {
            type: "object",
            properties: {
              goal_text: {
                type: "string",
                description: "The specific, measurable goal statement"
              },
              category: {
                type: "string",
                enum: ["career", "skills", "leadership"],
                description: "Goal category"
              },
              goal_type: {
                type: "string",
                enum: ["professional", "personal"],
                description: "Whether this is a professional or personal goal"
              },
              by_when: {
                type: "string",
                description: "Target completion date (YYYY-MM-DD format)"
              }
            },
            required: ["goal_text", "category", "goal_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_90_day_target",
          description: "Update an existing 90-day target. Use to modify text, mark complete, or change category.",
          parameters: {
            type: "object",
            properties: {
              target_id: {
                type: "string",
                description: "The ID of the target to update (from the user's current targets list)"
              },
              goal_text: {
                type: "string",
                description: "Updated goal text (if changing)"
              },
              completed: {
                type: "boolean",
                description: "Set to true to mark as complete"
              },
              category: {
                type: "string",
                enum: ["career", "skills", "leadership"],
                description: "Updated category (if changing)"
              }
            },
            required: ["target_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_achievement",
          description: "Record an achievement/win the user shares. Use when they mention accomplishing something worth celebrating.",
          parameters: {
            type: "object",
            properties: {
              achievement_text: {
                type: "string",
                description: "What they accomplished"
              },
              category: {
                type: "string",
                description: "Category like 'leadership', 'technical', 'communication', 'personal'"
              }
            },
            required: ["achievement_text"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_habit",
          description: "Create a new habit for the user to track. Use when they want to build a new routine.",
          parameters: {
            type: "object",
            properties: {
              habit_name: {
                type: "string",
                description: "Short name for the habit"
              },
              habit_description: {
                type: "string",
                description: "More detailed description of the habit"
              },
              frequency: {
                type: "string",
                enum: ["daily", "weekly"],
                description: "How often to track"
              },
              habit_type: {
                type: "string",
                enum: ["professional", "personal"],
                description: "Whether this is a professional or personal habit"
              }
            },
            required: ["habit_name", "frequency", "habit_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_habit",
          description: "Update an existing habit. Use to change details or deactivate.",
          parameters: {
            type: "object",
            properties: {
              habit_id: {
                type: "string",
                description: "The ID of the habit to update"
              },
              habit_name: {
                type: "string",
                description: "Updated habit name"
              },
              habit_description: {
                type: "string",
                description: "Updated description"
              },
              is_active: {
                type: "boolean",
                description: "Set to false to deactivate the habit"
              }
            },
            required: ["habit_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "save_diagnostic_assessment",
          description: "Save a diagnostic/wellbeing check-in assessment after conversationally gathering all responses from the user. Use ONLY after collecting responses for ALL 8 domains.",
          parameters: {
            type: "object",
            properties: {
              role_expectations_clarity: {
                type: "string",
                enum: ["very_clear", "somewhat_clear", "not_clear"],
                description: "How clear are they on role expectations"
              },
              job_description_accurate: {
                type: "boolean",
                description: "Do they have a written job description that accurately reflects what they do"
              },
              confidence_meeting_expectations: {
                type: "number",
                description: "1-10 scale: How confident are they meeting expectations"
              },
              workload_manageable: {
                type: "string",
                enum: ["very_manageable", "somewhat_manageable", "not_manageable"],
                description: "How manageable is their workload"
              },
              mentally_drained_frequency: {
                type: "string",
                enum: ["never", "rarely", "sometimes", "often"],
                description: "How often do they feel mentally drained"
              },
              sacrifice_personal_time_frequency: {
                type: "string",
                enum: ["never", "rarely", "sometimes", "often"],
                description: "How often do they sacrifice personal time for work"
              },
              burned_out_frequency: {
                type: "string",
                enum: ["never", "rarely", "sometimes", "often"],
                description: "How often do they feel exhausted or burned out"
              },
              time_for_development: {
                type: "string",
                enum: ["less_than_1_hour", "1_to_3_hours", "4_to_6_hours", "7_plus_hours"],
                description: "Weekly time available for professional development"
              },
              clear_path_growth: {
                type: "number",
                description: "1-10 scale: How clearly do they see a path for growth"
              },
              manager_support_growth: {
                type: "number",
                description: "1-10 scale: How well does their manager support their growth"
              },
              feel_valued: {
                type: "number",
                description: "1-10 scale: How valued do they feel for their contributions"
              },
              energized_about_work: {
                type: "string",
                enum: ["very_energized", "somewhat_energized", "not_energized"],
                description: "How energized do they feel about work most days"
              },
              would_stay_elsewhere: {
                type: "number",
                description: "1-10 scale: If offered similar job elsewhere, how likely to stay"
              },
              org_helping_toward_goal: {
                type: "string",
                enum: ["yes", "no", "not_sure"],
                description: "Do they feel the organization is helping them toward their career goal"
              }
            },
            required: [
              "role_expectations_clarity",
              "job_description_accurate", 
              "confidence_meeting_expectations",
              "workload_manageable",
              "mentally_drained_frequency",
              "sacrifice_personal_time_frequency",
              "burned_out_frequency",
              "time_for_development",
              "clear_path_growth",
              "manager_support_growth",
              "feel_valued",
              "energized_about_work",
              "would_stay_elsewhere",
              "org_helping_toward_goal"
            ]
          }
        }
      }
    ];

    // Build messages array for AI
    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Save user message
    await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      });

    // First, make a non-streaming call to check for tool calls
    console.log('Making initial AI call to check for tools...');
    const initialResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
        tools,
        stream: false,
      }),
    });

    if (!initialResponse.ok) {
      if (initialResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (initialResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact your administrator.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await initialResponse.text();
      console.error('Lovable AI error:', initialResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const initialData = await initialResponse.json();
    const aiMessage = initialData.choices?.[0]?.message;
    console.log('AI response:', JSON.stringify(aiMessage, null, 2));

    // Check if there are tool calls to execute
    if (aiMessage?.tool_calls && aiMessage.tool_calls.length > 0) {
      console.log('Processing tool calls:', aiMessage.tool_calls.length);
      const toolResults: any[] = [];

      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        let functionArgs;
        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error('Failed to parse tool arguments:', toolCall.function.arguments);
          continue;
        }
        
        console.log('Executing tool:', functionName, functionArgs);

        try {
          if (functionName === 'update_professional_vision') {
            const { data: existingGoal } = await supabase
              .from('personal_goals')
              .select('id')
              .eq('profile_id', user.id)
              .single();
            
            const updateData: any = {};
            if (functionArgs.one_year_vision) updateData.one_year_vision = functionArgs.one_year_vision;
            if (functionArgs.three_year_vision) updateData.three_year_vision = functionArgs.three_year_vision;
            
            if (existingGoal) {
              await supabase
                .from('personal_goals')
                .update(updateData)
                .eq('id', existingGoal.id);
            } else {
              await supabase
                .from('personal_goals')
                .insert({
                  profile_id: user.id,
                  company_id: effectiveCompanyId,
                  ...updateData,
                });
            }
            
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: `Successfully updated professional vision. ${functionArgs.one_year_vision ? '1-year vision set.' : ''} ${functionArgs.three_year_vision ? '3-year vision set.' : ''}`
            });
          } else if (functionName === 'update_personal_vision') {
            const { data: existingGoal } = await supabase
              .from('personal_goals')
              .select('id')
              .eq('profile_id', user.id)
              .single();
            
            const updateData: any = {};
            if (functionArgs.one_year_vision) updateData.personal_one_year_vision = functionArgs.one_year_vision;
            if (functionArgs.three_year_vision) updateData.personal_three_year_vision = functionArgs.three_year_vision;
            
            if (existingGoal) {
              await supabase
                .from('personal_goals')
                .update(updateData)
                .eq('id', existingGoal.id);
            } else {
              await supabase
                .from('personal_goals')
                .insert({
                  profile_id: user.id,
                  company_id: effectiveCompanyId,
                  ...updateData,
                });
            }
            
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: `Successfully updated personal vision. ${functionArgs.one_year_vision ? '1-year vision set.' : ''} ${functionArgs.three_year_vision ? '3-year vision set.' : ''}`
            });
          } else if (functionName === 'add_90_day_target') {
            // Determine quarter and year from by_when date if provided, otherwise use current quarter
            let quarter: string;
            let year: number;
            
            if (functionArgs.by_when) {
              const byWhenDate = new Date(functionArgs.by_when);
              quarter = `Q${Math.ceil((byWhenDate.getMonth() + 1) / 3)}`;
              year = byWhenDate.getFullYear();
            } else {
              const now = new Date();
              quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
              year = now.getFullYear();
            }
            
            // Find an available goal slot (the UI only shows 3 goals per quarter/category: 1-3)
            const { data: existingTargets, error: existingError } = await supabase
              .from('ninety_day_targets')
              .select('id, goal_number, goal_text')
              .eq('profile_id', user.id)
              .eq('quarter', quarter)
              .eq('year', year)
              .eq('category', functionArgs.category)
              .in('goal_number', [1, 2, 3]);

            if (existingError) {
              console.error('Error checking existing targets:', existingError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to add goal: ${existingError.message}`
              });
              continue;
            }

            // If the same goal already exists, treat as success (avoids duplicates)
            const normalizedNewText = String(functionArgs.goal_text || '').trim().toLowerCase();
            const duplicate = (existingTargets || []).find(t =>
              String(t.goal_text || '').trim().toLowerCase() === normalizedNewText
            );

            if (duplicate) {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `That 90-day goal is already on your tracker for ${quarter} ${year} (${functionArgs.category}).`
              });
              continue;
            }

            const usedNumbers = new Set((existingTargets || []).map(t => t.goal_number));
            const availableNumber = [1, 2, 3].find(n => !usedNumbers.has(n));

            if (!availableNumber) {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `You already have 3 goals in the ${functionArgs.category} category for ${quarter} ${year}. Please edit one of those goals in the 90-Day Tracker to replace it.`
              });
              continue;
            }

            const quarterEnd = new Date();
            quarterEnd.setDate(quarterEnd.getDate() + 90);

            const { error: insertError } = await supabase
              .from('ninety_day_targets')
              .insert({
                profile_id: user.id,
                company_id: effectiveCompanyId,
                goal_text: functionArgs.goal_text,
                // The tracker UI uses `category` as the "lane" (personal vs professional).
                // Preserve that behavior by mapping category from goal_type.
                category: (functionArgs.goal_type === 'personal' ? 'personal' : 'professional'),
                goal_type: functionArgs.goal_type || 'professional',
                quarter,
                year,
                goal_number: availableNumber,
                by_when: functionArgs.by_when || quarterEnd.toISOString().split('T')[0],
                completed: false
              });

            if (insertError) {
              console.error('Error inserting target:', insertError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to add goal: ${insertError.message}`
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Successfully added 90-day ${functionArgs.goal_type} goal in ${functionArgs.category} category: "${functionArgs.goal_text}"`
              });
            }
          } else if (functionName === 'update_90_day_target') {
            const updateData: any = {};
            if (functionArgs.goal_text) updateData.goal_text = functionArgs.goal_text;
            if (functionArgs.completed !== undefined) updateData.completed = functionArgs.completed;
            if (functionArgs.category) updateData.category = functionArgs.category;
            
            const { error: updateError } = await supabase
              .from('ninety_day_targets')
              .update(updateData)
              .eq('id', functionArgs.target_id)
              .eq('profile_id', user.id);
            
            if (updateError) {
              console.error('Error updating target:', updateError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to update goal: ${updateError.message}`
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Successfully updated the 90-day target. ${functionArgs.completed ? 'Marked as complete!' : ''}`
              });
            }
          } else if (functionName === 'add_achievement') {
            const { error: insertError } = await supabase
              .from('achievements')
              .insert({
                profile_id: user.id,
                company_id: effectiveCompanyId,
                achievement_text: functionArgs.achievement_text,
                category: functionArgs.category || 'general',
                achieved_date: new Date().toISOString().split('T')[0]
              });
            
            if (insertError) {
              console.error('Error inserting achievement:', insertError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to add achievement: ${insertError.message}`
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Successfully recorded achievement: "${functionArgs.achievement_text}"`
              });
            }
          } else if (functionName === 'save_diagnostic_assessment') {
            console.log('Processing diagnostic assessment...');
            
            // Normalization functions matching the ChatGPT spec exactly
            const normalizeRoleClarity = (value: string): number => {
              switch (value) {
                case 'very_clear': return 100;
                case 'somewhat_clear': return 70;
                case 'not_clear': return 40;
                default: return 50;
              }
            };

            const normalizeYesNo = (value: boolean | string): number => {
              if (value === true || value === 'yes') return 100;
              if (value === 'not_sure') return 50;
              return 0;
            };

            const normalizeWorkload = (value: string): number => {
              switch (value) {
                case 'very_manageable': return 100;
                case 'somewhat_manageable': return 60;
                case 'not_manageable': return 20;
                default: return 50;
              }
            };

            const normalizeFrequency = (value: string): number => {
              switch (value) {
                case 'never': return 100;
                case 'rarely': return 80;
                case 'sometimes': return 50;
                case 'often': return 20;
                default: return 50;
              }
            };

            const normalizeEnergized = (value: string): number => {
              switch (value) {
                case 'very_energized': return 100;
                case 'somewhat_energized': return 70;
                case 'not_energized': return 30;
                default: return 50;
              }
            };

            const normalizeTimeForDevelopment = (value: string): number => {
              switch (value) {
                case 'less_than_1_hour': return 20;
                case '1_to_3_hours': return 50;
                case '4_to_6_hours': return 75;
                case '7_plus_hours': return 90;
                default: return 50;
              }
            };

            const normalizeScale = (value: number): number => {
              return Math.round(value * 10);
            };

            // Normalize all inputs
            const roleClarity = normalizeRoleClarity(functionArgs.role_expectations_clarity);
            const jobDescription = normalizeYesNo(functionArgs.job_description_accurate);
            const confidenceScore = normalizeScale(functionArgs.confidence_meeting_expectations);
            const workloadScore = normalizeWorkload(functionArgs.workload_manageable);
            const mentallyDrainedScore = normalizeFrequency(functionArgs.mentally_drained_frequency);
            const sacrificeScore = normalizeFrequency(functionArgs.sacrifice_personal_time_frequency);
            const burnedOutScore = normalizeFrequency(functionArgs.burned_out_frequency);
            const developmentTimeScore = normalizeTimeForDevelopment(functionArgs.time_for_development);
            const clearPathScore = normalizeScale(functionArgs.clear_path_growth);
            const managerSupportScore = normalizeScale(functionArgs.manager_support_growth);
            const feelValuedScore = normalizeScale(functionArgs.feel_valued);
            const energizedScore = normalizeEnergized(functionArgs.energized_about_work);
            const stayScore = normalizeScale(functionArgs.would_stay_elsewhere);
            const orgHelpingScore = normalizeYesNo(functionArgs.org_helping_toward_goal);

            // Calculate category scores using the spec formulas
            const clarityScore = Math.round((roleClarity + jobDescription) / 2);
            const skillsScore = confidenceScore;
            const engagementScore = Math.round((energizedScore + feelValuedScore) / 2);
            const managerScore = managerSupportScore;
            const careerScore = Math.round((clearPathScore + orgHelpingScore) / 2);
            const retentionScore = stayScore;
            const burnoutScore = Math.round((mentallyDrainedScore + sacrificeScore + burnedOutScore + workloadScore) / 4);
            const learningScore = developmentTimeScore;

            // Calculate risk tier
            let riskFlags = 0;
            if (retentionScore < 60) riskFlags++;
            if (burnoutScore < 55) riskFlags++;
            if (managerScore < 60) riskFlags++;
            if (careerScore < 60) riskFlags++;
            if (engagementScore < 60) riskFlags++;

            let riskTier = 'low_risk';
            if (riskFlags >= 2) riskTier = 'high_risk';
            else if (riskFlags === 1) riskTier = 'watch_list';

            console.log('Calculated scores:', {
              clarity: clarityScore,
              skills: skillsScore,
              engagement: engagementScore,
              manager: managerScore,
              career: careerScore,
              retention: retentionScore,
              burnout: burnoutScore,
              learning: learningScore,
              riskTier,
              riskFlags
            });

            // Save raw responses to diagnostic_responses
            const { error: responseError } = await supabase
              .from('diagnostic_responses')
              .upsert({
                profile_id: user.id,
                company_id: effectiveCompanyId,
                role_clarity_score: roleClarity,
                has_written_job_description: functionArgs.job_description_accurate,
                confidence_score: functionArgs.confidence_meeting_expectations,
                workload_status: functionArgs.workload_manageable === 'very_manageable' ? 'manageable' : 
                                 functionArgs.workload_manageable === 'somewhat_manageable' ? 'heavy' : 'overwhelmed',
                mental_drain_frequency: functionArgs.mentally_drained_frequency,
                work_life_sacrifice_frequency: functionArgs.sacrifice_personal_time_frequency,
                burnout_frequency: functionArgs.burned_out_frequency,
                weekly_development_hours: functionArgs.time_for_development === 'less_than_1_hour' ? 0.5 :
                                           functionArgs.time_for_development === '1_to_3_hours' ? 2 :
                                           functionArgs.time_for_development === '4_to_6_hours' ? 5 : 8,
                sees_growth_path: clearPathScore >= 60,
                company_supporting_goal: functionArgs.org_helping_toward_goal === 'yes',
                manager_support_quality: managerSupportScore >= 80 ? 'very_supportive' :
                                          managerSupportScore >= 60 ? 'somewhat_supportive' : 'not_supportive',
                feels_valued: feelValuedScore >= 60,
                daily_energy_level: functionArgs.energized_about_work === 'very_energized' ? 'very_energized' :
                                     functionArgs.energized_about_work === 'somewhat_energized' ? 'somewhat_energized' : 'not_energized',
                would_stay_if_offered_similar: retentionScore >= 80 ? 'yes' : retentionScore >= 50 ? 'maybe' : 'no',
                submitted_at: new Date().toISOString(),
                additional_responses: {
                  raw_inputs: functionArgs,
                  normalized_scores: {
                    role_clarity: roleClarity,
                    job_description: jobDescription,
                    confidence: confidenceScore,
                    workload: workloadScore,
                    mentally_drained: mentallyDrainedScore,
                    sacrifice: sacrificeScore,
                    burned_out: burnedOutScore,
                    development_time: developmentTimeScore,
                    clear_path: clearPathScore,
                    manager_support: managerSupportScore,
                    feel_valued: feelValuedScore,
                    energized: energizedScore,
                    stay: stayScore,
                    org_helping: orgHelpingScore
                  }
                }
              }, { 
                onConflict: 'profile_id',
                ignoreDuplicates: false
              });

            if (responseError) {
              console.error('Error saving diagnostic responses:', responseError);
            }

            // Save calculated scores to diagnostic_scores
            const { error: scoresError } = await supabase
              .from('diagnostic_scores')
              .upsert({
                profile_id: user.id,
                company_id: effectiveCompanyId,
                clarity_score: clarityScore,
                skills_score: skillsScore,
                engagement_score: engagementScore,
                manager_score: managerScore,
                career_score: careerScore,
                retention_score: retentionScore,
                burnout_score: burnoutScore,
                learning_score: learningScore,
                calculated_at: new Date().toISOString()
              }, {
                onConflict: 'profile_id',
                ignoreDuplicates: false
              });

            if (scoresError) {
              console.error('Error saving diagnostic scores:', scoresError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to save diagnostic assessment: ${scoresError.message}`
              });
            } else {
              // Build a summary for Jericho to share
              const scoresSummary = [
                { name: 'Role Clarity', score: clarityScore },
                { name: 'Skills & Confidence', score: skillsScore },
                { name: 'Engagement', score: engagementScore },
                { name: 'Manager Support', score: managerScore },
                { name: 'Career Growth', score: careerScore },
                { name: 'Retention', score: retentionScore },
                { name: 'Burnout Health', score: burnoutScore },
                { name: 'Learning Capacity', score: learningScore }
              ].sort((a, b) => a.score - b.score);

              const strengths = scoresSummary.filter(s => s.score >= 70).slice(-3);
              const growthAreas = scoresSummary.filter(s => s.score < 70).slice(0, 3);

              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Diagnostic assessment saved successfully!

SCORES SUMMARY:
- Role Clarity: ${clarityScore}/100
- Skills & Confidence: ${skillsScore}/100
- Engagement: ${engagementScore}/100
- Manager Support: ${managerScore}/100
- Career Growth: ${careerScore}/100
- Retention: ${retentionScore}/100
- Burnout Health (higher = healthier): ${burnoutScore}/100
- Learning Capacity: ${learningScore}/100

RISK TIER: ${riskTier === 'high_risk' ? 'High Risk' : riskTier === 'watch_list' ? 'Watch List' : 'Low Risk'}

TOP STRENGTHS: ${strengths.length > 0 ? strengths.map(s => `${s.name} (${s.score})`).join(', ') : 'All areas have room for growth'}

GROWTH OPPORTUNITIES: ${growthAreas.length > 0 ? growthAreas.map(s => `${s.name} (${s.score})`).join(', ') : 'You\'re doing great across all areas!'}

Share these results with empathy and offer 2-3 specific coaching suggestions for their lowest-scoring areas.`
              });
            }
          } else if (functionName === 'add_habit') {
            const { error: insertError } = await supabase
              .from('leading_indicators')
              .insert({
                profile_id: user.id,
                company_id: effectiveCompanyId,
                habit_name: functionArgs.habit_name,
                habit_description: functionArgs.habit_description || null,
                target_frequency: functionArgs.frequency,
                habit_type: functionArgs.habit_type,
                is_active: true,
                current_streak: 0,
                longest_streak: 0,
              });
            
            if (insertError) {
              console.error('Error inserting habit:', insertError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to add habit: ${insertError.message}`
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Successfully created ${functionArgs.frequency} ${functionArgs.habit_type} habit: "${functionArgs.habit_name}"`
              });
            }
          } else if (functionName === 'update_habit') {
            const updateData: any = {};
            if (functionArgs.habit_name) updateData.habit_name = functionArgs.habit_name;
            if (functionArgs.habit_description) updateData.habit_description = functionArgs.habit_description;
            if (functionArgs.is_active !== undefined) updateData.is_active = functionArgs.is_active;
            
            const { error: updateError } = await supabase
              .from('leading_indicators')
              .update(updateData)
              .eq('id', functionArgs.habit_id)
              .eq('profile_id', user.id);
            
            if (updateError) {
              console.error('Error updating habit:', updateError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to update habit: ${updateError.message}`
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Successfully updated the habit. ${functionArgs.is_active === false ? 'Habit deactivated.' : ''}`
              });
            }
          }
        } catch (toolError) {
          console.error('Tool execution error:', toolError);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: `Error executing tool: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`
          });
        }
      }

      // Make a follow-up call with tool results to get the final response
      console.log('Making follow-up call with tool results...');
      const followUpMessages = [
        ...aiMessages,
        { role: 'assistant', content: aiMessage.content || '', tool_calls: aiMessage.tool_calls },
        ...toolResults
      ];

      const followUpResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text();
        console.error('Follow-up AI error:', followUpResponse.status, errorText);
        // Return the initial response content if follow-up fails
        const fallbackContent = aiMessage.content || 'I made some updates to your growth plan.';
        await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: conversation.id,
            role: 'assistant',
            content: fallbackContent,
          });
        
        return new Response(
          JSON.stringify({ response: fallbackContent, conversationId: conversation.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Stream the follow-up response
      return streamResponse(followUpResponse, conversation.id, supabase, corsHeaders);
    }

    // No tool calls - stream the response directly
    console.log('No tool calls, streaming response...');
    
    // Make a streaming request
    const streamingResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!streamingResponse.ok) {
      const errorText = await streamingResponse.text();
      console.error('Streaming AI error:', streamingResponse.status, errorText);
      throw new Error(`AI request failed: ${streamingResponse.status}`);
    }

    return streamResponse(streamingResponse, conversation.id, supabase, corsHeaders);

  } catch (error) {
    console.error('Error in chat-with-jericho:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to stream response
function streamResponse(response: Response, conversationId: string, supabase: any, corsHeaders: Record<string, string>) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      // Send conversation ID first
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                // Save assistant message
                if (accumulatedContent) {
                  await supabase
                    .from('conversation_messages')
                    .insert({
                      conversation_id: conversationId,
                      role: 'assistant',
                      content: accumulatedContent,
                    });

                  await supabase
                    .from('conversations')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', conversationId);
                }
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  accumulatedContent += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        // Handle any remaining buffer
        if (buffer.startsWith('data: ') && buffer.slice(6) !== '[DONE]') {
          try {
            const parsed = JSON.parse(buffer.slice(6));
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulatedContent += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        // Final save if we haven't done it yet
        if (accumulatedContent && !buffer.includes('[DONE]')) {
          await supabase
            .from('conversation_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: accumulatedContent,
            });

          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        }
      } catch (error) {
        console.error('Stream processing error:', error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
  });
}
