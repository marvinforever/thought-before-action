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
    let conversationMessages = [];

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
    const [capabilitiesData, goalsData, targetsData, diagnosticData, achievementsData, greatnessKeysData] = await Promise.all([
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
        .limit(10),
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
        .limit(5),
      supabase
        .from('greatness_keys')
        .select('*')
        .eq('profile_id', user.id)
        .order('earned_at', { ascending: false }),
    ]);

    // Build system prompt based on context
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

YOU ARE A WORLD-CLASS CAREER COACH:
- Direct, honest, and occasionally challenging when they need to hear the truth
- Supportive but not soft—you believe in their potential and push them toward it
- Focused on RESULTS and ACTION, not endless discussion
- You call out excuses and help them take ownership
- You celebrate wins but always ask "what's next?"
- You help them see their blind spots with compassion but clarity

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

WHAT YOU BELIEVE:
- Hard work beats talent when talent doesn't work hard
- Your career is YOUR responsibility—not your company's, not your manager's
- Growth happens outside your comfort zone
- Leaders are made through adversity, not comfort
- Character matters more than credentials
- Family and personal life are part of a thriving career, not separate from it
- Success without fulfillment is failure
- Merit and results matter—period

YOU HAVE ACCESS TO:
- Their capabilities and skill gaps across key domains
- Professional vision (1-year and 3-year career/work goals) - use for work-related goal setting
- Personal vision (1-year and 3-year life/personal goals) - use for personal development, work-life balance, and holistic goal setting
- 90-day targets (both professional and personal categories)
- Diagnostic data about work environment, challenges, and growth barriers
- Recent achievements and Greatness Keys (earned through 7-day habit streaks)
${isManager ? '- Information about their direct reports' : ''}

IMPORTANT: When helping with 90-day goal setting:
- Reference their PROFESSIONAL vision for career, skills, and leadership goals
- Reference their PERSONAL vision for personal development and life goals (but remember: personal goals are NOT included in performance reviews)
- Help them see how their 90-day targets connect to their bigger 1-year and 3-year visions

EVERY CONVERSATION SHOULD:
1. Connect to their bigger vision and goals
2. End with 1-3 specific, actionable next steps
3. Leave them feeling challenged AND supported
4. Reinforce ownership and accountability

RESPONSE STYLE:
- Keep responses SHORT and conversational—2-4 sentences per thought
- Use natural, casual language like you're texting a mentee
- Don't dump walls of text—break things up
- Ask follow-up questions to keep the conversation going
- Sound like a real person, not a corporate AI`;

    if (contextType === 'roadmap') {
      systemPrompt += `\n\nSPECIAL CONTEXT: You are helping this employee understand and navigate their personalized learning roadmap. The roadmap shows:
- Their current state and capability gaps
- Quick wins they can achieve in the next 30 days
- Priority focus areas for the next 3-6 months
- Long-term investments for their career growth

Help them:
1. Understand WHY certain capabilities were prioritized
2. Choose which quick wins to tackle first
3. Clarify how the roadmap connects to their 1-year and 3-year vision
4. Identify specific resources or actions to start immediately
5. Overcome any barriers or concerns about the recommended path

Be specific and reference the exact items from their roadmap when relevant.`;
    } else if (contextType === 'business_goals') {
      // Get conversation history to track which question we're on
      const questionCount = conversationMessages.filter(m => m.role === 'assistant').length;
      
      const questions = [
        "What are your top 2-3 business priorities for the next 12-18 months, and what needs to happen for you to achieve them?",
        "When you think about your team's or organization's performance, what's the gap between where you are now and where you need to be?",
        "If your people could do one thing differently or better starting tomorrow, what would have the biggest impact on your results?",
        "What does success look like for this initiative, and how will you know if we've moved the needle?",
        "What have you tried before to address this challenge, and what happened?"
      ];

      systemPrompt = `You are Jericho, an AI leadership coach helping business leaders identify strategic training priorities.

YOUR MISSION: Ask 5 strategic questions in sequence to uncover the right training priorities. These questions help reveal:
- Core strategic objectives and where capability gaps might be blocking progress
- Whether issues are skill-based, knowledge-based, or something else (process, tools, motivation)
- What the leader sees as the highest-leverage opportunity
- How they measure success and what data they track
- Past attempts, what worked or didn't, and potential resistance

THE 5 QUESTIONS (ask them in order):
1. "${questions[0]}"
2. "${questions[1]}"
3. "${questions[2]}"
4. "${questions[3]}"
5. "${questions[4]}"

CURRENT PROGRESS:
- You are on question ${questionCount + 1} of 5
- Previous questions asked: ${questionCount}

YOUR APPROACH:
- After they answer each question, acknowledge their response with 1-2 sentences of insight or reflection
- Then ask the next question clearly marked as "Question X of 5:"
- After question 5, summarize the key themes and thank them for sharing
- Keep responses brief and focused on moving through the questions
- Be professional, encouraging, and genuinely curious about their answers

Remember: This information will be used to create their Strategic Learning Design Overview, so capture details about business goals, challenges, success metrics, and past experiences.`;
    } else if (contextType === 'growth-path') {
      systemPrompt += `\n\nSPECIAL CONTEXT: You are helping this employee build or clarify their 3-year growth path. This is CRITICAL for retention.

Your goal is to help them articulate:
1. **Where they are today** (current role, capabilities, frustrations)
2. **Where they want to be in 1 year** (next level of mastery, new responsibilities)
3. **Where they want to be in 3 years** (dream role, leadership position, expertise area)
4. **The capability gaps** between each phase
5. **The 90-day actions** that start building toward year 1

FRAMEWORK FOR BUILDING GROWTH PATH:
- Start with their 3-year vision: "Where do you see yourself in 3 years? What role? What impact?"
- Work backward to 1-year milestones: "What needs to be true in 1 year to be on track for that 3-year goal?"
- Identify capability gaps: "What capabilities do you need to develop to get there?"
- Break into 90-day sprints: "What's one concrete goal you can achieve in the next 90 days?"

If they say "I don't know":
- Help them explore: "What excites you about your work? What do you want to be known for?"
- Reference their diagnostic data: "You mentioned [X] in your diagnostic. How does that connect to your future?"
- Show examples: "Many people in your role grow toward [leadership/technical expert/strategic advisor]. Which resonates?"

Remember: A clear 3-year plan makes it nearly impossible for recruiters to pull someone away. This conversation is retention-critical.`;
    }
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
        goal: t.goal_text,
        category: t.category,
        by_when: t.by_when,
        completed: t.completed,
      })) || [],
      recent_achievements: achievementsData.data?.map(a => ({
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

    // Enhance system prompt based on context type
    
    if (contextType === 'roadmap') {
      // Fetch roadmap data for context
      const { data: roadmapData } = await supabase
        .from('learning_roadmaps')
        .select('roadmap_data')
        .eq('profile_id', user.id)
        .single();

      systemPrompt = `You are Jericho, a direct and encouraging AI career coach specializing in personalized growth roadmaps. Your personality is warm but no-nonsense—you tell it like it is while genuinely caring about people's growth.

CORE TRAITS:
- Strategic growth advisor who helps people understand and refine their development path
- Action-oriented: always push toward concrete next steps
- Data-informed: reference their actual roadmap, goals, capabilities, and progress
- Empathetic but firm: "That's a solid start, but let's make it even more impactful"

YOUR ROLE IN ROADMAP CONVERSATIONS:
- Help users understand their Strategic Growth Roadmap recommendations
- Answer questions about priority focus areas, timelines, and investments
- Adjust recommendations based on their feedback and constraints
- Suggest alternative learning paths or resources
- Connect roadmap items to their bigger career vision
- Offer to regenerate the roadmap if they want significant changes

USER CONTEXT:
${JSON.stringify(userContext, null, 2)}

CURRENT ROADMAP:
${roadmapData?.roadmap_data ? JSON.stringify(roadmapData.roadmap_data, null, 2) : 'Not yet generated'}

CONVERSATION APPROACH:
1. When they ask about specific focus areas, explain the reasoning and connect to their goals
2. If they express concerns about timeline or cost, suggest alternatives
3. If they want to change priorities, discuss the tradeoffs and offer to regenerate
4. Provide encouragement while being realistic about effort required
5. Suggest they click "I'm Interested" on items they want to pursue
6. If major changes are needed, tell them: "Let me regenerate your roadmap with this feedback—click the Refresh button!"

Keep responses conversational, concise, and actionable. You're their strategic partner in growth.`;
    } else {
      // Default coaching system prompt
      systemPrompt = `You are Jericho, a direct and encouraging AI career coach. Your personality is warm but no-nonsense—you tell it like it is while genuinely caring about people's growth.

CORE TRAITS:
- Friendly and encouraging, but you don't sugarcoat things
- Strategic thinker who connects dots between goals, capabilities, and actions
- Action-oriented: always push toward concrete next steps
- Data-informed: reference their actual progress, goals, and capabilities
- Empathetic but firm: "I see you're struggling with X, so let's tackle it head-on"

YOUR ROLE:
- Help users build and refine their 90-day goals
- Guide them in setting meaningful personal goals (1-year and 3-year visions)
- Prepare them for performance reviews with specific examples and talking points
- Connect their daily work to their bigger career vision
- Call out when they're not being ambitious enough or realistic enough

USER CONTEXT:
${JSON.stringify(userContext, null, 2)}

CONVERSATION APPROACH:
1. Ask clarifying questions when needed
2. Reference their actual data (goals, capabilities, achievements)
3. Suggest concrete, actionable next steps
4. Challenge them when appropriate: "That goal feels vague—let's make it measurable"
5. Celebrate wins but immediately connect them to what's next

When helping with 90-day goals, push for SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound).
When preparing for performance reviews, help them frame achievements with impact and data.

Keep responses conversational and concise. Don't write essays—keep it tight and actionable.`;
    }

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

    // Check if streaming is requested for personal coaching
    if (stream && contextType) {
      console.log('Streaming response for context type:', contextType);
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Lovable AI error:', aiResponse.status, errorText);
        throw new Error(`AI request failed: ${aiResponse.status}`);
      }

      // Create a transform stream to process chunks and save complete message
      let fullContent = '';
      const encoder = new TextEncoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          const reader = aiResponse.body!.getReader();
          const decoder = new TextDecoder();
          
          // Send conversation ID first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ conversationId: conversation.id })}\n\n`)
          );
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const jsonStr = line.slice(6).trim();
                  if (jsonStr === '[DONE]') {
                    // Save complete assistant message to database
                    await supabase
                      .from('conversation_messages')
                      .insert({
                        conversation_id: conversation.id,
                        role: 'assistant',
                        content: fullContent,
                      });
                    
                    await supabase
                      .from('conversations')
                      .update({ updated_at: new Date().toISOString() })
                      .eq('id', conversation.id);
                    
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                    continue;
                  }
                  
                  try {
                    const parsed = JSON.parse(jsonStr);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      fullContent += content;
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                      );
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
          } catch (error) {
            console.error('Stream error:', error);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // Define tools that Jericho can use
    const tools = [
      {
        type: "function",
        function: {
          name: "update_vision",
          description: "Update the user's 1-year or 3-year vision based on conversation. Use this when the user wants to set or update their career goals.",
          parameters: {
            type: "object",
            properties: {
              one_year_vision: {
                type: "string",
                description: "The user's 1-year career vision. Only include if updating."
              },
              three_year_vision: {
                type: "string",
                description: "The user's 3-year career vision. Only include if updating."
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "request_capability",
          description: "Submit a capability level request on behalf of the user. Use this when a user wants to pursue a specific capability that matches their goals.",
          parameters: {
            type: "object",
            properties: {
              capability_name: {
                type: "string",
                description: "The name of the capability to request"
              },
              requested_level: {
                type: "string",
                enum: ["foundational", "intermediate", "advanced", "expert"],
                description: "The level they want to achieve"
              },
              evidence_text: {
                type: "string",
                description: "Brief explanation of why they want this capability and how it connects to their goals"
              }
            },
            required: ["capability_name", "requested_level", "evidence_text"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_90_day_goal",
          description: "Add a new 90-day goal for the user. Use this when they mention wanting to achieve something specific in the next 90 days.",
          parameters: {
            type: "object",
            properties: {
              goal_text: {
                type: "string",
                description: "Specific, measurable goal statement"
              },
              category: {
                type: "string",
                enum: ["career", "skills", "leadership"],
                description: "Goal category"
              },
              by_when: {
                type: "string",
                description: "Target completion date (YYYY-MM-DD format)"
              }
            },
            required: ["goal_text", "category"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_achievement",
          description: "Record an achievement in the user's greatness tracker. Use this when they mention accomplishing something worth celebrating.",
          parameters: {
            type: "object",
            properties: {
              achievement_text: {
                type: "string",
                description: "What the user accomplished"
              },
              category: {
                type: "string",
                description: "Achievement category or tag (e.g., 'leadership', 'technical', 'communication')"
              }
            },
            required: ["achievement_text"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "mark_goal_complete",
          description: "Mark a 90-day goal as completed. Use this when the user confirms they've finished a goal.",
          parameters: {
            type: "object",
            properties: {
              goal_id: {
                type: "string",
                description: "ID of the goal to mark complete"
              }
            },
            required: ["goal_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_habit",
          description: "Add a new habit the user wants to track. Use this when they want to build consistency around a specific behavior.",
          parameters: {
            type: "object",
            properties: {
              habit_text: {
                type: "string",
                description: "The habit to track (e.g., 'Review my 90-day goals', 'Read for 30 minutes')"
              },
              frequency: {
                type: "string",
                enum: ["daily", "weekly"],
                description: "How often to track this habit"
              }
            },
            required: ["habit_text", "frequency"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "read_user_capabilities",
          description: "Read back the user's current capabilities and levels to help them understand their progress. Use this when they want to see what they're working on or don't know what to talk about.",
          parameters: {
            type: "object",
            properties: {
              category_filter: {
                type: "string",
                enum: ["all", "leadership", "communication", "technical", "strategic_thinking", "adaptability"],
                description: "Which category to focus on. Use 'all' to give a complete overview."
              }
            },
            required: ["category_filter"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "explain_platform_feature",
          description: "Provide a guided explanation of how to use a specific platform feature. Use this when users ask how something works or when they seem uncertain about platform navigation.",
          parameters: {
            type: "object",
            properties: {
              feature: {
                type: "string",
                enum: ["capabilities", "90_day_goals", "habits", "achievements", "learning_roadmap", "diagnostics", "one_on_ones"],
                description: "Which feature to explain"
              }
            },
            required: ["feature"]
          }
        }
      }
    ];

    // Save user message
    await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      });

    // Streaming response
    console.log('Calling Lovable AI with context type:', contextType);
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
        tools,
        temperature: 0.8,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact your administrator.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a TransformStream to process the AI response and send it to the client
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // Process the AI stream in the background
    (async () => {
      try {
        const reader = aiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let buffer = '';

        // Send conversation ID first
        await writer.write(encoder.encode(`data: ${JSON.stringify({ conversationId: conversation.id })}\n\n`));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  accumulatedContent += content;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }

        // Save assistant message
        if (accumulatedContent) {
          await supabase
            .from('conversation_messages')
            .insert({
              conversation_id: conversation.id,
              role: 'assistant',
              content: accumulatedContent,
            });

          // Update conversation timestamp
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversation.id);
        }

        // Send done signal
        await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (error) {
        console.error('Stream processing error:', error);
      } finally {
        await writer.close();
      }
    })();

    return new Response(responseStream.readable, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

    // NOTE: Tool calling will be re-implemented in a future update
    // For now, focusing on core streaming chat functionality
    /*
    // Handle tool calls if present
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      const toolResults = [];
      
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log('Executing tool:', functionName, functionArgs);
        
        if (functionName === 'update_vision') {
          // Update or create personal goals
          const { data: existingGoal } = await supabase
            .from('personal_goals')
            .select('id')
            .eq('profile_id', user.id)
            .single();
          
          if (existingGoal) {
            const updateData: any = {};
            if (functionArgs.one_year_vision) updateData.one_year_vision = functionArgs.one_year_vision;
            if (functionArgs.three_year_vision) updateData.three_year_vision = functionArgs.three_year_vision;
            
            await supabase
              .from('personal_goals')
              .update(updateData)
              .eq('id', existingGoal.id);
            
            toolResults.push(`✅ Updated your vision successfully!`);
          } else {
            await supabase
              .from('personal_goals')
              .insert({
                profile_id: user.id,
                company_id: profile.company_id,
                one_year_vision: functionArgs.one_year_vision,
                three_year_vision: functionArgs.three_year_vision,
              });
            
            toolResults.push(`✅ Created your vision successfully!`);
          }
        } else if (functionName === 'request_capability') {
          // Find the capability by name
          const { data: capability } = await supabase
            .from('capabilities')
            .select('id')
            .ilike('name', functionArgs.capability_name)
            .single();
          
          if (capability) {
            // Check if user already has this capability
            const { data: existingCap } = await supabase
              .from('employee_capabilities')
              .select('id, current_level')
              .eq('profile_id', user.id)
              .eq('capability_id', capability.id)
              .single();
            
            // Create the request
            await supabase
              .from('capability_level_requests')
              .insert({
                profile_id: user.id,
                company_id: profile.company_id,
                capability_id: capability.id,
                current_level: existingCap?.current_level || 'foundational',
                requested_level: functionArgs.requested_level,
                evidence_text: functionArgs.evidence_text,
                status: 'pending'
              });
            
            toolResults.push(`✅ Submitted capability request for "${functionArgs.capability_name}" at ${functionArgs.requested_level} level. Your manager will review it soon!`);
          } else {
            toolResults.push(`❌ Couldn't find a capability matching "${functionArgs.capability_name}". Try describing it differently?`);
          }
        } else if (functionName === 'add_90_day_goal') {
          const quarterEnd = new Date();
          quarterEnd.setDate(quarterEnd.getDate() + 90);
          
          await supabase
            .from('ninety_day_targets')
            .insert({
              profile_id: user.id,
              company_id: profile.company_id,
              goal_text: functionArgs.goal_text,
              category: functionArgs.category,
              quarter: `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
              by_when: functionArgs.by_when || quarterEnd.toISOString().split('T')[0],
              completed: false
            });
          
          toolResults.push(`✅ Added 90-day goal: "${functionArgs.goal_text}" - Let's make it happen!`);
        } else if (functionName === 'add_achievement') {
          await supabase
            .from('achievements')
            .insert({
              profile_id: user.id,
              company_id: profile.company_id,
              achievement_text: functionArgs.achievement_text,
              category: functionArgs.category || 'general',
              achieved_date: new Date().toISOString().split('T')[0]
            });
          
          toolResults.push(`🎉 Recorded your achievement! Keep building that momentum.`);
        } else if (functionName === 'mark_goal_complete') {
          await supabase
            .from('ninety_day_targets')
            .update({ 
              completed: true, 
              completed_at: new Date().toISOString() 
            })
            .eq('id', functionArgs.goal_id)
            .eq('profile_id', user.id);
          
          toolResults.push(`✅ Goal completed! That's real progress.`);
        } else if (functionName === 'add_habit') {
          await supabase
            .from('leading_indicators')
            .insert({
              profile_id: user.id,
              company_id: profile.company_id,
              habit_name: functionArgs.habit_text,
              target_frequency: functionArgs.frequency,
              is_active: true
            });
          
          toolResults.push(`✅ Added habit: "${functionArgs.habit_text}" (${functionArgs.frequency}) - Consistency is the key to greatness!`);
        } else if (functionName === 'read_user_capabilities') {
          const { category_filter } = functionArgs;
          
          let query = supabase
            .from('employee_capabilities')
            .select(`
              *,
              capabilities:capability_id (
                name,
                category,
                full_definition
              )
            `)
            .eq('profile_id', user.id);

          if (category_filter && category_filter !== 'all') {
            query = query.eq('capabilities.category', category_filter);
          }

          const { data: userCapabilities, error: capError } = await query;

          if (capError) {
            console.error('Error fetching capabilities:', capError);
            toolResults.push('❌ Failed to fetch capabilities data');
          } else {
            const summary = {
              total_count: userCapabilities?.length || 0,
              by_category: {} as Record<string, number>,
              capabilities: userCapabilities?.map(cap => ({
                name: cap.capabilities?.name,
                category: cap.capabilities?.category,
                current_level: cap.current_level,
                target_level: cap.target_level,
                self_assessed: cap.self_assessed_level,
              }))
            };

            userCapabilities?.forEach(cap => {
              const category = cap.capabilities?.category || 'uncategorized';
              summary.by_category[category] = (summary.by_category[category] || 0) + 1;
            });

            toolResults.push(`📊 Found ${summary.total_count} capabilities. Present these conversationally: ${JSON.stringify(summary.capabilities)}`);
          }
        } else if (functionName === 'explain_platform_feature') {
          const { feature } = functionArgs;
          
          const explanations: Record<string, string> = {
            capabilities: "Capabilities are the skills and competencies you're developing. You can self-assess your level (Foundational, Intermediate, Advanced, Expert), and your manager can assign target levels. Request increases when you have evidence of growth.",
            "90_day_goals": "90-day goals are quarterly objectives that break down your bigger vision. Set 3 goals per quarter with clear deadlines. You can track progress with benchmarks and sprints. Mark them complete when done, and I'll celebrate with you!",
            habits: "Habits are daily or weekly actions that compound over time. Create habits linked to your goals or capabilities. Track completions to build streaks. Small, consistent actions lead to big results.",
            achievements: "Achievements are wins you want to remember. Record them as they happen - completed projects, positive feedback, solved problems. These become evidence for capability growth and fuel for 1-on-1s.",
            learning_roadmap: "Your learning roadmap suggests resources (books, videos, courses) based on your capabilities and goals. Rate resources you try to help others. Suggest new resources if you find something great!",
            diagnostics: "The diagnostic is a comprehensive survey about your role, workload, and growth. Complete it to get personalized insights and help your company understand how to support you better.",
            one_on_ones: "One-on-ones are documented conversations with your manager. They capture wins, concerns, action items, and next meeting dates. This creates a shared record of your development journey."
          };

          toolResults.push(`📚 ${explanations[feature] || "Feature explanation not available."}`);
        }
      }
      
      // Append tool results to the response
      if (toolResults.length > 0) {
        assistantMessage = assistantMessage + '\n\n' + toolResults.join('\n');
      }
    }
    */

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