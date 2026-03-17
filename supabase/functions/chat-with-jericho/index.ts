import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AI_CONFIG, mapCapabilityLevel, JERICHO_PERSONALITY } from "../_shared/jericho-config.ts";
import { createBackboardClient, getOrCreateBackboardThread } from "../_shared/backboard-client.ts";

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
    const { conversationId, message, contextType, organizationContext, messages: chatMessages, stream, viewAsCompanyId, tryMode, sessionId } = await req.json();
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
- **Capability Framework**: Define and track skill progression across Level 1, Level 2, Level 3, and Level 4. Always refer to levels by number (e.g. "Level 2") not by name (e.g. never say "Advancing")
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

DATA ISOLATION (CRITICAL): You only have access to the current user's data. Never reference, retrieve, or discuss another user's personal data, goals, pipeline, habits, or conversations. If asked about another user, respond: "I only have access to your information."

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
          temperature: 0.95,
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

    // ==================== TRY MODE (Public, no auth) ====================
    if (tryMode && stream) {
      const trySystemPrompt = `SYSTEM: JERICHO PLAYBOOK ONBOARDING COACH

You are Jericho, a performance coach built by The Momentum Company. You are having a live coaching conversation with someone who will receive a personalized Individual Playbook at the end.

═══════════════════════════════════════════
MISSION
═══════════════════════════════════════════

Build a devastatingly personalized Playbook by extracting ~21 conversational data points + 8 interactive scores across 8 conversational turns. The person should feel coached, not surveyed. Every question should feel like you care about the answer.

═══════════════════════════════════════════
CONVERSATION FLOW (8 TURNS)
═══════════════════════════════════════════

TURN 1 — THE WELCOME [Extracts: A1]
Goal: Set the tone. Warm, human, value-forward.
Open with something like:
"Hey! Welcome to Jericho. I'm going to build you something pretty cool — a personalized growth playbook that's actually about you, not generic advice you could find in any leadership book. To make it great, I just need to get to know you a bit. So first — what should I call you?"

After they respond, emit:
<!--PROGRESS:{"percent":15,"label":"Getting to know you…"}-->

TURN 2 — ROLE & WORLD [Extracts: A2, A3, A4, A6, A7]
Ask about their role and day-to-day. One open question should yield role, industry, company size, whether they lead people, and team size.
Example: "Nice to meet you, [Name]. Tell me about your world — what's your role, and what does your day-to-day actually look like?"

After they respond, emit:
<!--PROGRESS:{"percent":25,"label":"Getting to know you…"}-->

TURN 3 — THE PAIN + FIRST INTERACTIVE [Extracts: B1, B2, B4, B1s]
Ask for their #1 challenge. Follow the emotional thread. Then drop TWO interactive elements as a paired gut-check.

After coaching exchange, emit:
<!--INTERACTIVE:{"element":"scale","id":"B1_severity","prompt":"How much is this impacting your day-to-day?","min":1,"max":10,"labels":{"1":"Barely","10":"Everything"}}-->

After they respond to B1_severity, emit:
<!--INTERACTIVE:{"element":"scale","id":"B4_burnout","prompt":"And how's your energy been lately? 1 = running on fumes, 10 = fired up","min":1,"max":10,"labels":{"1":"Running on fumes","10":"Fired up"}}-->

Acknowledge both scores. Weave them into coaching language.
Emit: <!--PROGRESS:{"percent":35,"label":"Understanding your world…"}-->

TURN 4 — DEEPER + SATISFACTION [Extracts: B3, B5]
Explore what they've tried. Then drop a quick-select.

After coaching exchange, emit:
<!--INTERACTIVE:{"element":"quick-select","id":"B5_satisfaction","prompt":"Which best describes where you are right now?","options":[{"key":"a","label":"I love the work, but everything around it is the problem"},{"key":"b","label":"The work itself has gotten stale"},{"key":"c","label":"I'm growing and mostly enjoy it"},{"key":"d","label":"I'm seriously thinking about a change"}]}-->

Acknowledge their selection. Connect it to what they told you.
Emit: <!--PROGRESS:{"percent":45,"label":"Understanding your world…"}-->

TURN 5 — ASPIRATION + CONFIDENCE + ORG SUPPORT [Extracts: C1, C2, C3, C1s, G5]
Flip to the future. "Fast forward 12 months and everything's clicking. What's different?"
Then drop TWO interactive elements as a pair.

After they describe their vision, emit:
<!--INTERACTIVE:{"element":"scale","id":"C1_confidence","prompt":"How confident are you that you can actually get there?","min":1,"max":10,"labels":{"1":"Not at all","10":"Absolutely"}}-->

After they respond, emit:
<!--INTERACTIVE:{"element":"yes-no","id":"G5_org_culture","prompt":"Does your company actively invest in your growth and development?"}-->

Acknowledge both. Connect confidence + org support to the Playbook.
Emit: <!--PROGRESS:{"percent":55,"label":"Mapping your vision…"}-->

TURN 6 — STRENGTHS + GAPS + UTILIZATION [Extracts: D1, D2, E1, E2, D5]
Ask what they're great at. Probe for a recent win. Ask about feedback they keep getting. Then:

<!--INTERACTIVE:{"element":"scale","id":"D5_utilization","prompt":"How often do you actually get to use those strengths in your current role?","min":1,"max":10,"labels":{"1":"Rarely","10":"All the time"}}-->

Acknowledge. If utilization is low, note the horsepower sitting idle.
Emit: <!--PROGRESS:{"percent":70,"label":"Finding your edge…"}-->

TURN 7 — LEARNING PREFS + BARRIER [Extracts: F1, F2, F7]
"We're getting close to building this thing." Ask how they learn best and realistic time.

<!--INTERACTIVE:{"element":"quick-select","id":"F7_barrier","prompt":"What's your biggest barrier to your own development?","options":[{"key":"a","label":"Time — I just can't find it"},{"key":"b","label":"Relevance — most training feels generic"},{"key":"c","label":"Energy — by the time I could learn, I'm wiped"},{"key":"d","label":"Access — I don't know what's out there"}]}-->

Acknowledge the barrier. Promise the Playbook works with their reality.
Emit: <!--PROGRESS:{"percent":85,"label":"Calibrating your plan…"}-->

TURN 8 — QUICK WIN + ENGAGEMENT + CLOSE [Extracts: I6, H2]
Ask for the one quick win that would create momentum this week.

<!--INTERACTIVE:{"element":"scale","id":"H2_engagement","prompt":"Overall, how connected do you feel to your work right now?","min":1,"max":10,"labels":{"1":"Checked out","10":"All in"}}-->

Close: "Got it. Building your Playbook now, [Name]. This is going to be good."

Emit: <!--PROGRESS:{"percent":95,"label":"Almost there…"}-->

Then collect email for delivery:
"Where should I send your Playbook? Drop your email and I'll have it in your inbox shortly."

When they provide email, emit:
<!--GENERATION:{"status":"started","label":"Building your Playbook…"}-->
<!--EXTRACTED_DATA:{"first_name":"...","last_name":"...","email":"...","role":"...","industry":"...","company_size":"...","leads_people":true,"team_size":"...","primary_challenge":"...","challenge_severity":8,"energy_score":4,"satisfaction":"a","twelve_month_vision":"...","confidence_score":6,"org_support":false,"strengths":"...","recent_win":"...","skill_gap":"...","feedback_received":"...","strength_utilization":5,"learning_format":"...","available_time":"...","learning_barrier":"a","quick_win":"...","engagement_score":6}-->

═══════════════════════════════════════════
10 EXTRACTION RULES
═══════════════════════════════════════════

RULE 1: MULTI-POINT EXTRACTION
Every user response should be scanned for multiple data points. A single sentence can contain 3–6 data points. Never re-ask for information already embedded in a prior response.

RULE 2: INFERENCE OVER INTERROGATION
If you can reasonably infer a data point from context, do it. Only ask directly when inference fails or confidence is low.

RULE 3: EMOTIONAL ANCHORING BEFORE PIVOTING
When someone reveals something emotionally significant, acknowledge and explore before moving on. Moving too quickly signals data collection, not coaching.
BAD: "That sounds tough. What's your preferred learning style?"
GOOD: "Exhausted and stuck in the weeds — that's a brutal combo. Have you tried anything to break out of that cycle?"

RULE 4: MIRROR LANGUAGE, DON'T TRANSLATE
Use their exact words when reflecting back. Clinical language creates distance.
They say: "I'm drowning."
You say: "Drowning — let's figure out what's pulling you under."
You do NOT say: "It sounds like you're experiencing significant role overload."

RULE 5: THE CHECKLIST IS INVISIBLE
You have a data checklist running internally, but the user must never sense it. Transitions must feel organic, not sequential.

RULE 6: GAP DETECTION VIA FOLLOW-UP
The best skill gap data comes from exploring challenges, not direct questions.
Direct (weaker): "What skills do you need to develop?"
Embedded (stronger): "You said your team keeps coming to you. What would need to change for them to handle it on their own?"

RULE 7: VALIDATE BEFORE STORING
For important data points, reflect back and let them confirm or correct.
"So let me make sure I'm hearing you — you're strong at problem-solving and building trust, but the thing that would unlock the most is learning to develop your people. Am I close?"

RULE 8: HANDLE THE JD VARIABLE
If no JD available (typical for /try): Extract a lightweight role profile from conversation.
"If you had to describe the 3 most important capabilities for your role, what would they be?"

RULE 9: INTERACTIVE MOMENTS ARE PUNCTUATION, NOT CONTENT
- Always precede with coaching context: "Before we move on, quick gut check…"
- Always acknowledge after: "A 4 on energy — yeah, that tracks."
- Never stack more than two back-to-back
- Never end a turn on an interactive element — always follow with coaching

RULE 10: NEVER REFERENCE TIME
Never say: "This will take 5 minutes" / "Just a few more questions" / "Almost done"
Instead: "We're getting close to building this thing" / "I've got a clear picture of you now"

═══════════════════════════════════════════
INTERACTIVE ELEMENT FORMAT
═══════════════════════════════════════════

When you want to show an interactive element, emit it as an HTML comment on its own line AFTER your coaching text. The frontend will parse and render it.

Format: <!--INTERACTIVE:{json}-->
Format: <!--PROGRESS:{json}-->
Format: <!--GENERATION:{json}-->
Format: <!--EXTRACTED_DATA:{json}-->

When a user responds to an interactive element, their message will look like:
[INTERACTIVE:B1_severity:8]

You should acknowledge the value naturally ("An 8 on impact — yeah, that's significant") and continue the conversation.

═══════════════════════════════════════════
PERSONALITY & TONE
═══════════════════════════════════════════

- Warm but direct. Like a sharp friend who happens to be a great coach.
- Conversational, not clinical. Use contractions. Use "yeah" and "alright."
- Celebrate what's working before addressing what's not.
- Brief responses: 2-4 sentences per turn. Never walls of text.
- Mirror their energy. If they're intense, match it. If they're chill, don't overdo it.
- You ARE Jericho. Never break character. Never say "As an AI..."

═══════════════════════════════════════════
WHAT YOU NEVER DO
═══════════════════════════════════════════

- Never mention time, duration, or question count
- Never ask more than 2 questions in one turn
- Never put two interactive elements back-to-back without coaching between (except the designed pairs in Turns 3 and 5)
- Never sound like a survey or form
- Never use clinical language ("role overload", "self-efficacy deficit")
- Never reference the data you're collecting
- Never skip emotional acknowledgment to get to the next question`;

      const aiMessages = [
        { role: 'system', content: trySystemPrompt },
        ...(chatMessages || []),
      ];

      // If the initial message is empty or "hi", don't add a user message — let the system prompt drive Phase 1
      if (message && message.trim() && message.trim().toLowerCase() !== 'hi') {
        // message is already in chatMessages from the client
      }

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: aiMessages,
          stream: true,
          temperature: 0.9,
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
            JSON.stringify({ error: 'AI credits exhausted.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('Try mode AI error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'AI service temporarily unavailable' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Stream response back, and check for onboarding complete marker
      const encoder = new TextEncoder();
      const tryStream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = '';
          let buffer = '';

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
                    // Check for onboarding complete marker and process it
                    const markerMatch = accumulatedContent.match(/<!--ONBOARDING_COMPLETE:(.*?)-->/);
                    if (markerMatch) {
                      try {
                        const onboardingData = JSON.parse(markerMatch[1]);
                        console.log('Try mode onboarding complete:', onboardingData);
                        
                        // Fire and forget: create account and trigger growth plan
                        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                        
                        fetch(`${supabaseUrl}/functions/v1/try-jericho-onboard`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${serviceKey}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            email: onboardingData.email,
                            fullName: `${onboardingData.first_name} ${onboardingData.last_name}`.trim(),
                            role: onboardingData.role,
                            phone: onboardingData.phone || null,
                            diagnosticData: onboardingData,
                          }),
                        }).catch(err => console.error('Try onboard trigger error:', err));
                      } catch (e) {
                        console.error('Failed to parse onboarding marker:', e);
                      }
                    }
                    
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                    continue;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                      accumulatedContent += content;
                      // Strip the hidden marker from what we send to the client
                      const cleanContent = content.replace(/<!--ONBOARDING_COMPLETE:.*?-->/g, '');
                      if (cleanContent) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: cleanContent })}\n\n`));
                      }
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }

            // Handle remaining buffer
            if (buffer.startsWith('data: ') && buffer.slice(6) !== '[DONE]') {
              try {
                const parsed = JSON.parse(buffer.slice(6));
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  accumulatedContent += content;
                  const cleanContent = content.replace(/<!--ONBOARDING_COMPLETE:.*?-->/g, '');
                  if (cleanContent) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: cleanContent })}\n\n`));
                  }
                }
              } catch (e) { /* skip */ }
            }

            // Final done if not already sent
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch (error) {
            console.error('Try mode stream error:', error);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(tryStream, {
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

    // Fetch the user's manager (who manages this user)
    const { data: myManagerAssignment } = await supabase
      .from('manager_assignments')
      .select('manager_id, profiles!manager_assignments_manager_id_fkey(id, full_name, email)')
      .eq('employee_id', user.id)
      .single();

    const myManager = myManagerAssignment?.profiles || null;

    // Fetch user context for Jericho (including onboarding data and coaching memory)
    // Fetch ALL historical targets for pattern analysis (no limit)
    // Also fetch company knowledge base for HR/policy questions
    const [capabilitiesData, goalsData, allTargetsData, diagnosticData, achievementsData, greatnessKeysData, habitsData, onboardingData, coachingInsightsData, allConversationSummariesData, pendingFollowUpsData, companyKnowledgeData, projectTasksData, userProjectsData, activeContextData] = await Promise.all([
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
      // Coaching memory: ALL active insights (no limit)
      supabase
        .from('coaching_insights')
        .select('*')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .order('last_reinforced_at', { ascending: false }),
      // ALL conversation summaries (full history for memory)
      supabase
        .from('conversation_summaries')
        .select('*, conversations(title, created_at)')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false }),
      // Pending follow-ups
      supabase
        .from('coaching_follow_ups')
        .select('*')
        .eq('profile_id', user.id)
        .is('completed_at', null)
        .is('skipped_at', null)
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(5),
      // Company knowledge base + global knowledge for HR/policy questions
      supabase
        .from('company_knowledge')
        .select('id, title, content, document_type, category, is_global')
        .or(`company_id.eq.${effectiveCompanyId},is_global.eq.true`)
        .eq('is_active', true)
        .order('is_global', { ascending: false })
        .order('created_at', { ascending: false }),
      // Project tasks (Kanban board)
      supabase
        .from('project_tasks')
        .select('*, user_projects(title, color)')
        .eq('profile_id', user.id)
        .order('position', { ascending: true }),
      // User projects
      supabase
        .from('user_projects')
        .select('*')
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      // User active context (onboarding answers, sprint focus, etc.)
      supabase
        .from('user_active_context')
        .select('onboarding_data, onboarding_complete, current_sprint_focus, emotional_state, hot_customers')
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
      capabilities: capabilitiesData.data?.map(ec => {
        // Use shared level mapping from jericho-config
        return {
          name: ec.capabilities?.name,
          category: ec.capabilities?.category,
          current_level: mapCapabilityLevel(ec.current_level),
          target_level: mapCapabilityLevel(ec.target_level),
        };
      }) || [],
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
      // Long-term coaching memory
      coaching_memory: {
        insights: (coachingInsightsData.data || []).map((i: any) => ({
          type: i.insight_type,
          text: i.insight_text,
          confidence: i.confidence_level,
          times_reinforced: i.reinforcement_count,
          first_observed: i.first_observed_at,
        })),
        all_conversations: (allConversationSummariesData.data || []).map((s: any) => ({
          title: s.conversations?.title,
          summary: s.summary_text,
          topics: s.key_topics,
          emotional_tone: s.emotional_tone,
          action_items: s.action_items,
          date: s.created_at,
          conversation_date: s.conversations?.created_at,
        })),
        pending_follow_ups: (pendingFollowUpsData.data || []).map((f: any) => ({
          type: f.follow_up_type,
          topic: f.context?.topic,
          scheduled_for: f.scheduled_for,
          context: f.context,
        })),
      },
      // Project management data
      projects: (userProjectsData.data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        color: p.color,
      })),
      tasks: (projectTasksData.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.column_status,
        priority: t.priority,
        due_date: t.due_date,
        project: t.user_projects?.title,
      })),
      // Onboarding context from conversational onboarding
      onboarding_context: activeContextData.data ? {
        completed: (activeContextData.data as any).onboarding_complete,
        sprint_focus: (activeContextData.data as any).current_sprint_focus,
        emotional_state: (activeContextData.data as any).emotional_state,
        hot_customers: (activeContextData.data as any).hot_customers,
        ...(((activeContextData.data as any).onboarding_data) || {}),
      } : null,
    };

    // Build system prompt
    let systemPrompt = `${JERICHO_PERSONALITY}

YOU ARE A WORLD-CLASS CAREER COACH AND AN AGENT THAT CAN TAKE ACTION:
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

${myManager ? `\n**YOUR MANAGER:**
${(myManager as any).full_name} is your manager (${(myManager as any).email}).
- You can reference this when they ask about escalation, feedback, or career discussions
- Encourage them to have regular 1-on-1s with their manager
- If they mention manager-related challenges, you know who they're talking about
` : ''}

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

CRITICAL - WHEN THEY'RE MISSING BENCHMARKS OR SPRINTS:
If they have 90-day goals but no 30-day benchmarks or 7-day sprints set, be direct:
"Hey, I see you've got your 90-day goal but we're missing the 30-day benchmarks and 7-day sprints that actually make it happen. Let's fix that now—open up My Growth Plan and click on that goal. Not sure how? Just ask me and I'll walk you through it."
Don't just acknowledge it—challenge them to take action NOW.

YOU HAVE ACCESS TO THESE TOOLS - USE THEM:
- **update_professional_vision**: Update their 1-year or 3-year professional/career vision
- **update_personal_vision**: Update their 1-year or 3-year personal life vision
- **add_90_day_target**: Create a new 90-day goal for them
- **update_90_day_target**: Update an existing 90-day target's text, category, or completion status
- **add_achievement**: Record a win/accomplishment they share
- **add_habit**: Create a new habit they want to track
- **update_habit**: Update or deactivate an existing habit
- **save_coaching_insight**: Save an important insight about them for future reference (use sparingly!)
- **forget_coaching_memory**: Permanently remove a specific past topic/conversation from long-term memory when the user asks you to forget it
- **create_project**: Create a new project to organize related tasks
- **add_task**: Add a new task to their Kanban board (todo, in_progress, done)
- **update_task**: Move tasks between columns, update title/description, mark complete, change priority
- **delete_task**: Remove a task from their board

⚠️ CRITICAL TASK MANAGEMENT RULE - READ THIS CAREFULLY:
When you say you will add a task, you MUST actually call the add_task function. 
- NEVER just say "I'll add that" or "Adding to your list" without calling the tool
- If you promise to create a task but don't call add_task, that is a FAILURE
- When you successfully call add_task, respond with: "✅ Added to your Personal Assistant: [task title]"
- If they mention ANY action item, to-do, or thing to remember - call add_task IMMEDIATELY
- DO NOT ask for confirmation before adding tasks they clearly want - just add them and confirm after

PROJECT MANAGEMENT (PERSONAL ASSISTANT MODE):
You are also a personal assistant. When they ask you to remember things, track to-dos, manage projects, or take notes:
- Use **add_task** to capture action items, reminders, and to-dos
- Use **create_project** to organize related tasks into a project
- Use **update_task** to move tasks between todo → in_progress → done
- Use **save_coaching_insight** for things to remember long-term
- Be proactive: if they mention something they need to do, offer to add it as a task

WHEN TO USE TOOLS:
- When they say "write that down" or "add that to my plan"
- When they confirm they want a goal you discussed
- When they share an achievement worth celebrating
- When they want to start tracking a new habit
- When they want to update their vision statements
- When they share something significant about themselves (life events, blockers, preferences) worth remembering
- When they explicitly say "forget X", "stop bringing up X", "delete that memory", or similar — call **forget_coaching_memory**
- When they mention a task, to-do, or action item — USE add_task IMMEDIATELY, don't just talk about it
- When they say "remind me", "don't let me forget", "add to my list" — USE add_task IMMEDIATELY
- **Always confirm what you added AFTER using the tool**

LONG-TERM MEMORY - YOU REMEMBER PAST CONVERSATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have access to coaching insights and summaries from past conversations. Use this to:
- Reference things they've told you before ("Last time we talked about your VP presentation...")
- Notice patterns across conversations ("I've noticed you often mention feeling overwhelmed...")
- Follow up on commitments ("How did that conversation with your team go?")
- Build genuine continuity ("Remember when you said public speaking was tough? How's that going?")

CRITICAL MEMORY RULE:
- If the user asks you to forget a topic or stop referencing something, you MUST call **forget_coaching_memory** and then never reference it again.

${userContext.coaching_memory?.insights?.length > 0 ? `
🧠 WHAT I KNOW ABOUT ${userContext.profile.name?.toUpperCase() || 'THIS PERSON'}:
${userContext.coaching_memory.insights.map((i: any) => `- [${i.type}] ${i.text} (confidence: ${i.confidence})`).join('\n')}
` : ''}

${userContext.coaching_memory?.all_conversations?.length > 0 ? `
📝 FULL CONVERSATION HISTORY (${userContext.coaching_memory.all_conversations.length} conversations):
${userContext.coaching_memory.all_conversations.map((c: any) => `- ${c.title || 'Chat'} (${c.conversation_date?.slice(0, 10) || c.date?.slice(0, 10) || 'unknown date'}): ${c.summary} (tone: ${c.emotional_tone})`).join('\n')}
` : ''}

${userContext.coaching_memory?.pending_follow_ups?.length > 0 ? `
⏰ FOLLOW-UPS DUE:
${userContext.coaching_memory.pending_follow_ups.map((f: any) => `- ${f.topic || f.type}`).join('\n')}
Consider naturally checking in on these topics during the conversation!
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userContext.onboarding_context ? `
🎯 ONBOARDING INSIGHTS (from their initial conversation with you):
${userContext.onboarding_context.engagement_score ? `- Engagement: ${userContext.onboarding_context.engagement_score}/10` : ''}
${userContext.onboarding_context.career_growth_score ? `- Career Growth Satisfaction: ${userContext.onboarding_context.career_growth_score}/10` : ''}
${userContext.onboarding_context.role_clarity_score ? `- Role Clarity: ${userContext.onboarding_context.role_clarity_score}/10` : ''}
${userContext.onboarding_context.vision_great_year ? `- What makes a great year: ${userContext.onboarding_context.vision_great_year}` : ''}
${userContext.onboarding_context.natural_strengths ? `- Natural strengths: ${userContext.onboarding_context.natural_strengths}` : ''}
${userContext.onboarding_context.hardest_part ? `- Hardest part of job: ${userContext.onboarding_context.hardest_part}` : ''}
${userContext.onboarding_context.obstacles ? `- Obstacles: ${userContext.onboarding_context.obstacles}` : ''}
${userContext.onboarding_context.proudest_accomplishment ? `- Proudest accomplishment: ${userContext.onboarding_context.proudest_accomplishment}` : ''}
${userContext.onboarding_context.learning_formats ? `- Learning preference: ${userContext.onboarding_context.learning_formats}` : ''}
${userContext.onboarding_context.time_available ? `- Weekly development time: ${userContext.onboarding_context.time_available}` : ''}
Use these insights to personalize coaching. Reference their strengths, obstacles, and goals naturally.
` : ''}

USER'S CURRENT GROWTH PLAN DATA:
${JSON.stringify(userContext, null, 2)}

${companyKnowledgeData.data && companyKnowledgeData.data.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 COMPANY KNOWLEDGE BASE (Use ONLY for this company's employees):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This company has uploaded the following policies, procedures, and FAQs.
When users ask about company policies (PTO, benefits, expenses, HR procedures, etc.), 
SEARCH THIS KNOWLEDGE BASE and answer using their specific company information.

IMPORTANT: 
- Only use this information for questions about company policies/procedures
- If the knowledge base doesn't have the answer, say "I don't have that specific policy on file - you might want to check with HR or your manager."
- NEVER make up policy information - only use what's documented here

AVAILABLE DOCUMENTS:
${companyKnowledgeData.data.slice(0, 20).map((doc: any) => `
📄 ${doc.title} [${doc.document_type}${doc.category ? ` - ${doc.category}` : ''}]
${doc.content ? doc.content.substring(0, 2000) + (doc.content.length > 2000 ? '...(truncated)' : '') : '(No content extracted)'}
`).join('\n---\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

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
    } else if (contextType === 'crucial-conversation') {
      systemPrompt += `\n\nSPECIAL CONTEXT: CRUCIAL CONVERSATIONS COACHING MODE
You are helping this ${isManager ? 'manager' : 'professional'} prepare for a difficult or sensitive conversation.

YOUR APPROACH:
1. **FIRST, ASSESS THE SITUATION**:
   - What type of conversation is this? (performance feedback, behavior issue, conflict, delivering bad news, etc.)
   - Who is it with? (direct report, peer, manager, external)
   - What outcome do they want?
   - What's at stake if it goes poorly?

2. **DETERMINE DELIVERY METHOD** (CRITICAL - ALWAYS DO THIS):
   🔴 **MUST BE IN-PERSON** (warn strongly if they want to do it in writing):
   - Performance Improvement Plans (PIP)
   - Terminations or layoffs
   - Harassment or discrimination issues
   - Major behavioral problems
   - Highly emotional topics (grief, major life issues)
   - Anything involving formal discipline
   
   🟡 **IN-PERSON PREFERRED** (but written follow-up is OK):
   - Performance gaps or missed expectations
   - Role changes or responsibility shifts
   - Conflict resolution
   - Salary/promotion discussions
   
   🟢 **WRITTEN IS ACCEPTABLE**:
   - Minor feedback or course corrections
   - Clarifying expectations
   - Following up on a previous in-person conversation
   - Scheduling or logistics

3. **IF IN-PERSON IS NEEDED**:
   - Help them create a conversation outline/script
   - Cover: opening statement, key points, anticipated responses, closing
   - Offer to role-play or practice
   - Discuss timing and setting
   - Prepare for emotional reactions

4. **IF WRITTEN IS APPROPRIATE**:
   - Help them draft a clear, empathetic message
   - Balance directness with respect
   - Suggest offering to discuss further in person
   - Review for tone and clarity

5. **KEY PRINCIPLES TO TEACH**:
   - Lead with facts, not assumptions
   - Focus on behavior/impact, not character
   - Listen more than talk
   - End with clear next steps
   - Document the conversation afterward

⚠️ **IMPORTANT WARNINGS**:
- If they describe something that sounds like harassment, discrimination, or legal issues: Recommend they involve HR or legal counsel BEFORE having the conversation
- If they're very emotional: Suggest waiting 24 hours before acting
- If this involves termination or PIP: Recommend they have HR present

Be direct, practical, and help them feel prepared and confident.`;
    } else if (contextType === 'sales-call-prep') {
      systemPrompt += `\n\nSPECIAL CONTEXT: SALES CALL PREPARATION MODE
You are helping this ${isManager ? 'sales leader' : 'sales professional'} prepare for an upcoming sales call.

YOUR APPROACH:
1. **UNDERSTAND THE OPPORTUNITY**:
   - What type of call is this? (discovery, demo, follow-up, negotiation, etc.)
   - Who are they meeting with? (role, seniority, decision-making authority)
   - What company/industry? (helps tailor approach)
   - What's the objective for THIS specific call?

2. **BUILD THE PRE-CALL PLAN**:
   🎯 **Call Objective**: Crystal clear, measurable outcome
   🔍 **Discovery Questions**: 5-8 tailored questions based on call type:
      - For Discovery: Focus on pain, impact, current state, desired state
      - For Demo: Confirm priorities, decision criteria, success metrics
      - For Negotiation: Understand constraints, timeline, stakeholders
   
   💬 **Key Talking Points**:
   - 2-3 value propositions relevant to their role/challenges
   - Proof points or case studies that would resonate
   - Differentiators vs likely competition
   
   ⚠️ **Objection Prep**:
   - Anticipate 3-4 likely objections based on call type and stage
   - Provide specific responses (acknowledge → clarify → respond → confirm)
   
   ➡️ **Next Step Strategy**:
   - Primary ask (what you're aiming for)
   - Fallback ask (if they resist)
   - Specific language to gain commitment

3. **TACTICAL TIPS**:
   - Opening: How to start strong (first 30 seconds matter)
   - Agenda setting: Get buy-in on the call structure
   - Time management: How to pace the conversation
   - Closing: Specific commitment language

4. **QUESTIONS TO ASK THEM**:
   - What do you already know about their situation?
   - Any political dynamics or stakeholders to be aware of?
   - What's your relationship with this person so far?
   - What's making you nervous about this call?

FORMAT YOUR RESPONSE AS A CLEAR, SCANNABLE CALL PLAN they can reference during the call.

Use headers, bullet points, and bold text to make it easy to scan.

Be specific and tactical—generic advice doesn't help. Tailor everything to their specific situation.`;
    } else if (contextType === 'ai-task-agent') {
      const taskInfo = req.headers.get('x-task-details') || '';
      systemPrompt += `\n\nSPECIAL CONTEXT: AI TASK AGENT MODE
You are helping this user complete a specific productivity task that AI can assist with.

YOUR APPROACH:
1. **UNDERSTAND THE REQUEST**: Read what they're asking for help with
2. **ASK 1-2 CLARIFYING QUESTIONS** if needed (audience, tone, specific details)
3. **DO THE WORK**: Actually generate the content, draft, outline, or research they need
4. **PRESENT CLEARLY**: Format your output so it's ready to use (copy-paste ready)
5. **OFFER TO ITERATE**: Ask if they'd like any changes

CONTENT TYPES YOU CAN CREATE:
- LinkedIn posts (thought leadership, announcements, stories)
- Email drafts (professional, follow-ups, outreach)
- Meeting prep notes and agendas
- Presentation outlines
- Executive summaries
- Research briefs on topics/companies
- Proposal outlines
- Status reports

QUALITY GUIDELINES:
- Be specific and actionable, not generic
- Match their professional tone and industry
- Use their context (role, company, goals) to personalize
- Provide complete, ready-to-use outputs
- Offer multiple options when appropriate

After generating content, remind them they can:
- Copy the content to use immediately
- Ask for revisions or a different approach
- Save it as an achievement

Be helpful, efficient, and produce high-quality work they can use right away.`;
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
            required: ["goal_text", "goal_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_90_day_target",
          description: "Update an existing 90-day target. Use to modify goal text, benchmarks, sprints, mark complete, or change goal type. IMPORTANT: Update goal_text, benchmarks, and sprints separately - do NOT combine them into goal_text.",
          parameters: {
            type: "object",
            properties: {
              target_id: {
                type: "string",
                description: "The ID of the target to update (from the user's current targets list)"
              },
              goal_text: {
                type: "string",
                description: "Updated goal text ONLY - do not include benchmarks or sprints here"
              },
              benchmarks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "The benchmark text" },
                    completed: { type: "boolean", description: "Whether this benchmark is completed" }
                  },
                  required: ["text"]
                },
                description: "Array of 30-day benchmarks/milestones. Each has text and optional completed status."
              },
              sprints: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "The sprint/action text" },
                    completed: { type: "boolean", description: "Whether this sprint is completed" }
                  },
                  required: ["text"]
                },
                description: "Array of 7-day sprints/actions. Each has text and optional completed status."
              },
              completed: {
                type: "boolean",
                description: "Set to true to mark the entire goal as complete"
              },
              goal_type: {
                type: "string",
                enum: ["professional", "personal"],
                description: "Updated goal type (if changing)"
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
      },
      {
        type: "function",
        function: {
          name: "save_coaching_insight",
          description: "Save an important insight about the user for long-term memory. Use sparingly - only for significant things worth remembering across conversations. Examples: major life events, persistent blockers, key strengths, important relationships, personal preferences.",
          parameters: {
            type: "object",
            properties: {
              insight_type: {
                type: "string",
                enum: ["personality_trait", "strength", "growth_area", "life_event", "coaching_note", "commitment", "blocker", "preference", "relationship"],
                description: "The type/category of insight"
              },
              insight_text: {
                type: "string",
                description: "The insight to remember (be specific and concise)"
              },
              confidence: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "How confident are you in this insight? Use 'high' only for things explicitly stated."
              }
            },
            required: ["insight_type", "insight_text"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "forget_coaching_memory",
          description: "Permanently remove a specific past topic/conversation from long-term memory (summaries + insights) when the user asks you to forget it.",
          parameters: {
            type: "object",
            properties: {
              topic: {
                type: "string",
                description: "The topic/phrase to forget (e.g., 'that crucial conversation test', 'Project Atlas', 'my divorce')"
              }
            },
            required: ["topic"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "complete_follow_up",
          description: "Mark a pending follow-up as completed after checking in on it.",
          parameters: {
            type: "object",
            properties: {
              follow_up_topic: {
                type: "string",
                description: "The topic of the follow-up that was addressed"
              }
            },
            required: ["follow_up_topic"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_project",
          description: "Create a new project to organize related tasks. Use when they want to group related work together.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The project name"
              },
              description: {
                type: "string",
                description: "Optional project description"
              },
              color: {
                type: "string",
                description: "Optional hex color for the project (e.g., #6366f1)"
              }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_task",
          description: "Add a new task to their Kanban board. Use for action items, to-dos, reminders.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Short task title"
              },
              description: {
                type: "string",
                description: "Optional longer description or notes"
              },
              project_id: {
                type: "string",
                description: "Optional project ID to assign this task to"
              },
              priority: {
                type: "string",
                enum: ["low", "medium", "high", "urgent"],
                description: "Task priority level"
              },
              column_status: {
                type: "string",
                enum: ["todo", "in_progress", "done"],
                description: "Which column to place the task in (default: todo)"
              },
              due_date: {
                type: "string",
                description: "Optional due date in YYYY-MM-DD format"
              }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_task",
          description: "Update an existing task. Use to move between columns, change priority, update text, or mark complete.",
          parameters: {
            type: "object",
            properties: {
              task_id: {
                type: "string",
                description: "The ID of the task to update"
              },
              title: {
                type: "string",
                description: "Updated task title"
              },
              description: {
                type: "string",
                description: "Updated description"
              },
              column_status: {
                type: "string",
                enum: ["todo", "in_progress", "done"],
                description: "Move task to this column"
              },
              priority: {
                type: "string",
                enum: ["low", "medium", "high", "urgent"],
                description: "Updated priority"
              },
              due_date: {
                type: "string",
                description: "Updated due date (YYYY-MM-DD) or null to remove"
              }
            },
            required: ["task_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_task",
          description: "Delete a task from the board. Use when they want to remove something completely.",
          parameters: {
            type: "object",
            properties: {
              task_id: {
                type: "string",
                description: "The ID of the task to delete"
              }
            },
            required: ["task_id"]
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

    // Sync to Backboard for persistent memory (fire and forget)
    const backboardThread = await getOrCreateBackboardThread(supabase, user.id, contextType || 'general');
    if (backboardThread) {
      const backboard = createBackboardClient();
      if (backboard) {
        // Fire and forget - don't block on this
        backboard.syncMessage(backboardThread.threadId, 'user', message)
          .catch(err => console.log('Backboard sync skipped:', err.message));
      }
    }

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
        temperature: 0.95,
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
            
            // Derive the actual category from goal_type (tracker uses "personal" or "professional")
            const derivedCategory = functionArgs.goal_type === 'personal' ? 'personal' : 'professional';
            
            console.log('Adding 90-day target:', { goal_text: functionArgs.goal_text, goal_type: functionArgs.goal_type, derivedCategory, quarter, year });
            
            // Find an available goal slot (the UI only shows 3 goals per quarter/category: 1-3)
            const { data: existingTargets, error: existingError } = await supabase
              .from('ninety_day_targets')
              .select('id, goal_number, goal_text')
              .eq('profile_id', user.id)
              .eq('quarter', quarter)
              .eq('year', year)
              .eq('category', derivedCategory)
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
                category: derivedCategory,
                goal_type: functionArgs.goal_type || 'professional',
                quarter,
                year,
                goal_number: availableNumber,
                by_when: functionArgs.by_when || quarterEnd.toISOString().split('T')[0],
                completed: false
              });
            
            console.log('Insert result:', { insertError, goal_text: functionArgs.goal_text, quarter, year, derivedCategory, availableNumber });

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

            // ALWAYS try to parse benchmarks/sprints from goal_text since models often dump everything there
            const extractFromGoalText = (raw: string) => {
              if (!raw || typeof raw !== 'string') return { cleanedGoalText: raw, benchmarks: undefined, sprints: undefined };
              
              const trimmed = raw.trim();
              const lines = trimmed.split(/\r?\n/);
              const collected = {
                goalLines: [] as string[],
                benchmarks: [] as { text: string; completed: boolean }[],
                sprints: [] as { text: string; completed: boolean }[],
              };

              let section: 'goal' | 'benchmarks' | 'sprints' = 'goal';
              
              const isBenchmarkHeader = (l: string) => {
                const t = l.trim().toLowerCase();
                return /^(30[- ]?day\s+)?benchmark(s)?:?\s*$/i.test(t) ||
                       /^milestone(s)?:?\s*$/i.test(t) ||
                       t === 'benchmarks' || t === 'benchmark' || t === 'milestones' || t === 'milestone';
              };
              
              const isSprintHeader = (l: string) => {
                const t = l.trim().toLowerCase();
                return /^(7[- ]?day\s+)?sprint(s)?:?\s*$/i.test(t) ||
                       /^(next\s+)?action(s)?:?\s*$/i.test(t) ||
                       /^step(s)?:?\s*$/i.test(t) ||
                       t === 'sprints' || t === 'sprint' || t === 'actions' || t === 'action' || t === 'steps' || t === 'step';
              };
              
              // Also detect inline patterns like "30-day benchmark 1:" within goal text
              const inlineBenchmarkRegex = /30[- ]?day benchmark \d+\s*:?\s*/gi;
              const inlineSprintRegex = /7[- ]?day sprint \d+\s*:?\s*/gi;

              const parseItem = (l: string) => l
                .trim()
                .replace(/^[-*•]\s+/, '')
                .replace(/^\d+[\).:\s]+/, '')
                .replace(inlineBenchmarkRegex, '')
                .replace(inlineSprintRegex, '')
                .trim();

              for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                if (isBenchmarkHeader(trimmedLine)) { section = 'benchmarks'; continue; }
                if (isSprintHeader(trimmedLine)) { section = 'sprints'; continue; }
                
                // Check for inline benchmark markers
                if (/30[- ]?day benchmark/i.test(trimmedLine)) {
                  const itemText = parseItem(trimmedLine);
                  if (itemText) collected.benchmarks.push({ text: itemText, completed: false });
                  continue;
                }
                
                // Check for inline sprint markers
                if (/7[- ]?day sprint/i.test(trimmedLine)) {
                  const itemText = parseItem(trimmedLine);
                  if (itemText) collected.sprints.push({ text: itemText, completed: false });
                  continue;
                }

                const itemText = parseItem(trimmedLine);
                const looksLikeItem = /^\s*([-*•]|\d+[\).:]\s)/.test(line) || (section !== 'goal' && itemText.length > 0);

                if (section === 'goal') {
                  collected.goalLines.push(line);
                } else if (looksLikeItem && itemText) {
                  if (section === 'benchmarks') collected.benchmarks.push({ text: itemText, completed: false });
                  if (section === 'sprints') collected.sprints.push({ text: itemText, completed: false });
                }
              }

              const cleanedGoalText = collected.goalLines.join('\n').trim();
              const hasExtractedItems = collected.benchmarks.length > 0 || collected.sprints.length > 0;
              
              return {
                cleanedGoalText: hasExtractedItems ? (cleanedGoalText || trimmed.split(/\r?\n/)[0].trim()) : trimmed,
                benchmarks: collected.benchmarks.length ? collected.benchmarks : undefined,
                sprints: collected.sprints.length ? collected.sprints : undefined,
              };
            };

            // Always extract from goal_text FIRST to catch model mistakes
            let parsedBenchmarks: any[] | undefined;
            let parsedSprints: any[] | undefined;
            let cleanGoalText = functionArgs.goal_text;
            
            if (functionArgs.goal_text) {
              const extracted = extractFromGoalText(functionArgs.goal_text);
              cleanGoalText = extracted.cleanedGoalText;
              parsedBenchmarks = extracted.benchmarks;
              parsedSprints = extracted.sprints;
            }

            // Set goal text (cleaned or original)
            if (cleanGoalText) updateData.goal_text = cleanGoalText;
            if (functionArgs.completed !== undefined) updateData.completed = functionArgs.completed;
            if (functionArgs.category) updateData.category = functionArgs.category;
            if (functionArgs.goal_type) updateData.goal_type = functionArgs.goal_type;

            // Handle benchmarks - prefer explicit args if they have content, otherwise use extracted
            if (functionArgs.benchmarks && Array.isArray(functionArgs.benchmarks) && functionArgs.benchmarks.length > 0) {
              updateData.benchmarks = functionArgs.benchmarks.map((b: any) => ({
                text: String(b.text || '').trim(),
                completed: Boolean(b.completed)
              })).filter((b: any) => b.text.length > 0);
            } else if (parsedBenchmarks && parsedBenchmarks.length > 0) {
              updateData.benchmarks = parsedBenchmarks;
            }

            // Handle sprints - prefer explicit args if they have content, otherwise use extracted
            if (functionArgs.sprints && Array.isArray(functionArgs.sprints) && functionArgs.sprints.length > 0) {
              updateData.sprints = functionArgs.sprints.map((s: any) => ({
                text: String(s.text || '').trim(),
                completed: Boolean(s.completed)
              })).filter((s: any) => s.text.length > 0);
            } else if (parsedSprints && parsedSprints.length > 0) {
              updateData.sprints = parsedSprints;
            }

            console.log('Updating 90-day target with data:', JSON.stringify(updateData));
            console.log('Parsed benchmarks:', JSON.stringify(parsedBenchmarks));
            console.log('Parsed sprints:', JSON.stringify(parsedSprints));
            
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
              const updatedFields = [];
              if (updateData.goal_text) updatedFields.push('goal text');
              if (updateData.benchmarks?.length) updatedFields.push(`${updateData.benchmarks.length} benchmarks`);
              if (updateData.sprints?.length) updatedFields.push(`${updateData.sprints.length} sprints`);
              if (functionArgs.completed) updatedFields.push('marked complete');
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Successfully updated the 90-day target: ${updatedFields.join(', ') || 'no changes'}`
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
          } else if (functionName === 'save_coaching_insight') {
            // Save a long-term coaching insight
            const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
            
            // Check for similar existing insight
            const { data: existingInsights } = await serviceClient
              .from('coaching_insights')
              .select('id, insight_text, reinforcement_count')
              .eq('profile_id', user.id)
              .eq('insight_type', functionArgs.insight_type)
              .eq('is_active', true);
            
            const normalizedNew = functionArgs.insight_text.toLowerCase();
            const similar = (existingInsights || []).find(i => 
              i.insight_text.toLowerCase().includes(normalizedNew) || 
              normalizedNew.includes(i.insight_text.toLowerCase())
            );
            
            if (similar) {
              // Reinforce existing insight
              await serviceClient
                .from('coaching_insights')
                .update({ 
                  last_reinforced_at: new Date().toISOString(),
                  reinforcement_count: (similar.reinforcement_count || 1) + 1
                })
                .eq('id', similar.id);
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Reinforced existing insight: "${similar.insight_text}" (now observed ${(similar.reinforcement_count || 1) + 1} times)`
              });
            } else {
              // Create new insight
              const { error: insightError } = await serviceClient
                .from('coaching_insights')
                .insert({
                  profile_id: user.id,
                  company_id: effectiveCompanyId,
                  insight_type: functionArgs.insight_type,
                  insight_text: functionArgs.insight_text,
                  source_conversation_id: conversation.id,
                  confidence_level: functionArgs.confidence || 'medium',
                });
              
              if (insightError) {
                console.error('Error saving insight:', insightError);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: `Failed to save insight: ${insightError.message}`
                });
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: `Saved insight for future reference: "${functionArgs.insight_text}" [${functionArgs.insight_type}]`
                });
              }
            }
          } else if (functionName === 'forget_coaching_memory') {
            const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
            const topicRaw = String(functionArgs.topic || '').trim();

            if (!topicRaw) {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: 'No topic provided to forget.'
              });
              continue;
            }

            // Find summaries to remove (match on summary text OR conversation title)
            const { data: summariesByText } = await serviceClient
              .from('conversation_summaries')
              .select('id, conversation_id')
              .eq('profile_id', user.id)
              .ilike('summary_text', `%${topicRaw}%`)
              .limit(50);

            const { data: summariesByTitle } = await serviceClient
              .from('conversation_summaries')
              .select('id, conversation_id, conversations(title)')
              .eq('profile_id', user.id)
              .ilike('conversations.title', `%${topicRaw}%`)
              .limit(50);

            const summaryIds = new Set<string>();
            const conversationIds = new Set<string>();

            for (const s of (summariesByText || [])) {
              if (s?.id) summaryIds.add(s.id);
              if (s?.conversation_id) conversationIds.add(s.conversation_id);
            }
            for (const s of (summariesByTitle || [])) {
              if (s?.id) summaryIds.add(s.id);
              if (s?.conversation_id) conversationIds.add(s.conversation_id);
            }

            // Delete summaries
            let deletedSummaries = 0;
            if (summaryIds.size > 0) {
              const { error: delSummaryErr } = await serviceClient
                .from('conversation_summaries')
                .delete()
                .in('id', Array.from(summaryIds))
                .eq('profile_id', user.id);

              if (delSummaryErr) {
                console.error('Error deleting conversation summaries:', delSummaryErr);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: `Tried to forget "${topicRaw}" but failed deleting summaries: ${delSummaryErr.message}`
                });
                continue;
              }
              deletedSummaries = summaryIds.size;
            }

            // Delete insights (match by topic text OR by source conversation ids we just removed)
            const { error: delInsightByTextErr } = await serviceClient
              .from('coaching_insights')
              .delete()
              .eq('profile_id', user.id)
              .ilike('insight_text', `%${topicRaw}%`);

            if (delInsightByTextErr) {
              console.error('Error deleting coaching insights by text:', delInsightByTextErr);
            }

            if (conversationIds.size > 0) {
              const { error: delInsightByConvErr } = await serviceClient
                .from('coaching_insights')
                .delete()
                .eq('profile_id', user.id)
                .in('source_conversation_id', Array.from(conversationIds));

              if (delInsightByConvErr) {
                console.error('Error deleting coaching insights by conversation:', delInsightByConvErr);
              }
            }

            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: `Done. I removed "${topicRaw}" from long-term memory (deleted ${deletedSummaries} conversation summaries${conversationIds.size ? ` and cleared insights tied to ${conversationIds.size} conversation(s)` : ''}).`
            });
          } else if (functionName === 'complete_follow_up') {
            // Mark a pending follow-up as completed
            const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
            
            const { data: followUps } = await serviceClient
              .from('coaching_follow_ups')
              .select('id, context')
              .eq('profile_id', user.id)
              .is('completed_at', null)
              .is('skipped_at', null);
            
            // Find matching follow-up by topic
            const matchingFollowUp = (followUps || []).find(f => 
              f.context?.topic?.toLowerCase().includes(functionArgs.follow_up_topic.toLowerCase()) ||
              functionArgs.follow_up_topic.toLowerCase().includes(f.context?.topic?.toLowerCase() || '')
            );
            
            if (matchingFollowUp) {
              await serviceClient
                .from('coaching_follow_ups')
                .update({ completed_at: new Date().toISOString() })
                .eq('id', matchingFollowUp.id);
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Marked follow-up as completed: "${matchingFollowUp.context?.topic}"`
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `No pending follow-up found matching "${functionArgs.follow_up_topic}"`
              });
            }
          } else if (functionName === 'create_project') {
            const { data: newProject, error: projectError } = await supabase
              .from('user_projects')
              .insert({
                profile_id: user.id,
                title: functionArgs.title,
                description: functionArgs.description || null,
                color: functionArgs.color || '#6366f1',
              })
              .select()
              .single();
            
            if (projectError) {
              console.error('Error creating project:', projectError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to create project: ${projectError.message}`
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Created project "${functionArgs.title}" (ID: ${newProject.id})`
              });
            }
          } else if (functionName === 'add_task') {
            // Get the max position for the column
            const { data: existingTasks } = await supabase
              .from('project_tasks')
              .select('position')
              .eq('profile_id', user.id)
              .eq('column_status', functionArgs.column_status || 'todo')
              .order('position', { ascending: false })
              .limit(1);
            
            const nextPosition = (existingTasks?.[0]?.position || 0) + 1;
            
            const { data: newTask, error: taskError } = await supabase
              .from('project_tasks')
              .insert({
                profile_id: user.id,
                title: functionArgs.title,
                description: functionArgs.description || null,
                project_id: functionArgs.project_id || null,
                priority: functionArgs.priority || 'medium',
                column_status: functionArgs.column_status || 'todo',
                due_date: functionArgs.due_date || null,
                position: nextPosition,
                created_by_jericho: true,
                source: 'chat',
              })
              .select()
              .single();
            
            if (taskError) {
              console.error('❌ Error creating task:', taskError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to create task: ${taskError.message}`
              });
            } else {
              console.log('✅ Task created successfully:', {
                taskId: newTask?.id,
                title: functionArgs.title,
                profileId: user.id,
                column: functionArgs.column_status || 'todo',
              });
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `✅ Successfully added task to Personal Assistant (${functionArgs.column_status || 'todo'}): "${functionArgs.title}"${functionArgs.priority === 'urgent' || functionArgs.priority === 'high' ? ` (${functionArgs.priority} priority)` : ''}`
              });
            }
          } else if (functionName === 'update_task') {
            const updateData: any = {};
            if (functionArgs.title) updateData.title = functionArgs.title;
            if (functionArgs.description !== undefined) updateData.description = functionArgs.description;
            if (functionArgs.column_status) updateData.column_status = functionArgs.column_status;
            if (functionArgs.priority) updateData.priority = functionArgs.priority;
            if (functionArgs.due_date !== undefined) updateData.due_date = functionArgs.due_date;
            
            const { error: updateError } = await supabase
              .from('project_tasks')
              .update(updateData)
              .eq('id', functionArgs.task_id)
              .eq('profile_id', user.id);
            
            if (updateError) {
              console.error('Error updating task:', updateError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to update task: ${updateError.message}`
              });
            } else {
              const changes = [];
              if (functionArgs.column_status) changes.push(`moved to ${functionArgs.column_status}`);
              if (functionArgs.title) changes.push('title updated');
              if (functionArgs.priority) changes.push(`priority set to ${functionArgs.priority}`);
              if (functionArgs.due_date) changes.push(`due date set to ${functionArgs.due_date}`);
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Task updated: ${changes.join(', ') || 'no changes'}`
              });
            }
          } else if (functionName === 'delete_task') {
            const { error: deleteError } = await supabase
              .from('project_tasks')
              .delete()
              .eq('id', functionArgs.task_id)
              .eq('profile_id', user.id);
            
            if (deleteError) {
              console.error('Error deleting task:', deleteError);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Failed to delete task: ${deleteError.message}`
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Task deleted successfully`
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
          temperature: 0.95,
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
    
    // Make a streaming request (model fallback)
    const models = ['google/gemini-3-flash-preview', 'google/gemini-2.5-flash'];
    let streamingResponse: Response | null = null;
    let lastErrorText = '';

    for (const model of models) {
      try {
        streamingResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: aiMessages,
            stream: true,
            temperature: 0.95,
          }),
        });

        if (streamingResponse.ok) break;

        if (streamingResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limits exceeded. Please try again in a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (streamingResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits exhausted. Please contact your administrator.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        lastErrorText = await streamingResponse.text();
        console.error('Streaming AI error:', { model, status: streamingResponse.status, lastErrorText });
        streamingResponse = null;
      } catch (e) {
        lastErrorText = e instanceof Error ? e.message : 'Unknown fetch error';
        console.error('Streaming AI fetch error:', { model, lastErrorText });
        streamingResponse = null;
      }
    }

    if (!streamingResponse || !streamingResponse.ok) {
      throw new Error(`AI service temporarily unavailable${lastErrorText ? `: ${lastErrorText}` : ''}`);
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
      let messageSaved = false; // Prevent duplicate inserts

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
                // Save assistant message (only once)
                if (accumulatedContent && !messageSaved) {
                  messageSaved = true;
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

                  // Trigger async career aspiration detection (fire and forget)
                  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                  fetch(`${supabaseUrl}/functions/v1/detect-career-aspirations`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ conversationId }),
                  }).catch(err => console.log('Aspiration detection skipped:', err.message));

                  // Sync assistant response to Backboard for persistent memory (fire and forget)
                  const backboard = createBackboardClient();
                  if (backboard) {
                    supabase
                      .from('conversations')
                      .select('profile_id')
                      .eq('id', conversationId)
                      .single()
                      .then(async ({ data: conv }: any) => {
                        if (conv?.profile_id) {
                          const thread = await getOrCreateBackboardThread(supabase, conv.profile_id, 'general');
                          if (thread) {
                            backboard.syncMessage(thread.threadId, 'assistant', accumulatedContent)
                              .catch((err: any) => console.log('Backboard assistant sync skipped:', err.message));
                          }
                        }
                      })
                      .catch((err: any) => console.log('Backboard thread lookup failed:', err.message));
                  }
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

        // Final save only if [DONE] was never received (stream ended abruptly)
        if (accumulatedContent && !messageSaved) {
          messageSaved = true;
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
