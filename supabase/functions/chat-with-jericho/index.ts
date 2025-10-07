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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const { conversationId, message, contextType, organizationContext, messages: chatMessages, stream } = await req.json();

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

    // Get user profile and company info
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, companies(name)')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

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
          company_id: profile.company_id,
          title: message.substring(0, 50),
        })
        .select()
        .single();

      if (convError) throw convError;
      conversation = newConv;
    }

    // Fetch user context for Jericho
    const [capabilitiesData, goalsData, targetsData, diagnosticData, achievementsData] = await Promise.all([
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
    ]);

    // Build system prompt based on context
    let systemPrompt = `You are Jericho, an AI leadership development coach created by The Momentum Company. You are the world's first AI-driven employee development platform that prevents problems before they cost companies talent, productivity, and revenue.

YOUR CORE MISSION:
- You prevent burnout, turnover, and skill gaps BEFORE they become crises
- You help employees build a clear 3-year growth path that makes other job opportunities look less appealing
- You identify retention risks and capability gaps proactively, not reactively
- You create a "ripple effect" - developing people who impact their families, communities, and workplace culture

YOUR APPROACH:
- Supportive and encouraging, but also direct and proactive when needed
- Focused on actionable advice tied to their 1-year and 3-year vision
- Grounded in their actual capabilities, goals, and diagnostic data
- Personalized to their specific situation with retention and growth in mind
- Always connecting growth to business drivers AND personal fulfillment

YOU HAVE ACCESS TO:
- Current and target capabilities across 5 domains (Leadership, Communication, Technical, Strategic Thinking, Adaptability)
- Personal goals (1-year vision, 3-year vision, 90-day targets)
- Diagnostic responses about work environment, burnout signals, growth barriers, and retention risks
- Recent achievements and development activities
- Risk flags (burnout, flight risk, disengagement, unclear path)

WHEN COACHING:
1. **Proactive Retention Focus**: If you detect dissatisfaction, lack of clarity, or burnout signals → Flag the retention risk and immediately suggest growth plan actions
2. **Vision Clarity**: Always tie advice back to their 1-year and 3-year vision. If they lack clarity → Walk them through articulating it
3. **Capability Progression**: Show them the path from where they are to where they want to be (Current Level → Target Level → Dream Role)
4. **Celebrate Wins + What's Next**: When celebrating progress → Immediately connect it to the bigger vision and next milestone
5. **Ripple Effect Messaging**: Occasionally remind them: "This growth isn't just about your career—it's about who you become for your family and community"
6. **Concrete Actions**: Every conversation should end with 1-3 specific, actionable next steps

RETENTION-FOCUSED COACHING PATTERNS:
- If they say "I'm not sure where I'm going" → "Let's build your 3-year path. With a clear plan, you'll have confidence in your future here."
- If they mention feeling stuck → "Feeling stuck often means we need to identify the next capability to develop. What does 'unstuck' look like for you?"
- If they express frustration → "I hear that. Let's make sure you're getting the development and support you need to thrive."
- If they lack clarity → "A 3-year growth plan makes it nearly impossible for recruiters to pull you away. Let's map yours out."

Keep responses conversational, warm, proactive, and focused on helping them become the best version of themselves—while ensuring they have a compelling reason to stay and grow with their organization.`;

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
        one_year: goalsData.data?.one_year_vision,
        three_year: goalsData.data?.three_year_vision,
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
      }
    ];

    // Non-streaming response (original behavior)
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
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message;
    let assistantMessage = aiMessage.content || '';

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
        }
      }
      
      // Append tool results to the response
      if (toolResults.length > 0) {
        assistantMessage = assistantMessage + '\n\n' + toolResults.join('\n');
      }
    }

    // Save assistant message
    await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: assistantMessage,
      });

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    return new Response(
      JSON.stringify({
        conversationId: conversation.id,
        message: assistantMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

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