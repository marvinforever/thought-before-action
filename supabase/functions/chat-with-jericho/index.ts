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
    }

    // Check if user is a manager and fetch their team
    const { data: managerAssignments } = await supabase
      .from('manager_assignments')
      .select('employee_id, profiles!manager_assignments_employee_id_fkey(id, full_name, email)')
      .eq('manager_id', user.id);

    const isManager = managerAssignments && managerAssignments.length > 0;
    const teamMembers = isManager ? managerAssignments.map(m => m.profiles).filter(Boolean) : [];

    // Fetch user context for Jericho
    const [capabilitiesData, goalsData, targetsData, diagnosticData, achievementsData, greatnessKeysData, habitsData] = await Promise.all([
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
        .order('created_at', { ascending: false })
        .limit(20),
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
    ]);

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

RESPONSE STYLE:
- Keep responses SHORT and conversational—2-4 sentences per thought
- Use natural, casual language like you're texting a mentee
- Don't dump walls of text—break things up
- Ask follow-up questions to keep the conversation going
- Sound like a real person, not a corporate AI
- When you use a tool, briefly confirm what you did`;

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
            const now = new Date();
            const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
            const year = now.getFullYear();
            
            // Get the next goal number
            const { data: existingTargets } = await supabase
              .from('ninety_day_targets')
              .select('goal_number')
              .eq('profile_id', user.id)
              .eq('quarter', quarter)
              .eq('year', year)
              .order('goal_number', { ascending: false })
              .limit(1);
            
            const nextGoalNumber = (existingTargets?.[0]?.goal_number || 0) + 1;
            
            const quarterEnd = new Date();
            quarterEnd.setDate(quarterEnd.getDate() + 90);
            
            const { error: insertError } = await supabase
              .from('ninety_day_targets')
              .insert({
                profile_id: user.id,
                company_id: effectiveCompanyId,
                goal_text: functionArgs.goal_text,
                category: functionArgs.category,
                goal_type: functionArgs.goal_type || 'professional',
                quarter,
                year,
                goal_number: nextGoalNumber,
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
