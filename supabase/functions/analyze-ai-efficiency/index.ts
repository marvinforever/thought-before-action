import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for realistic calculations
const HOURLY_RATE = 75; // $75/hour value
const MAX_WEEKLY_WORK_HOURS = 60; // Max hours someone works per week (absolute ceiling)
const MAX_CURRENT_TASK_HOURS = 40; // Max total task hours we analyze per person (realistic work)
const MAX_AI_SAVINGS_PERCENT = 0.35; // Max 35% of work week can be saved via AI
const MAX_SINGLE_TASK_HOURS = 8; // No single task can exceed 8 hrs/week
const MAX_AI_SAVINGS_HOURS = 14; // Absolute max hours saved per employee per week

interface WorkflowStep {
  step: number;
  action: string;
  tool: string;
  time_minutes: number;
  prompt_template?: string;
}

interface StarterPrompt {
  use_case: string;
  prompt: string;
  expected_output: string;
}

interface AIAugmentableTask {
  task: string;
  instances_per_week: number;
  minutes_per_instance: number;
  current_time_hours: number;
  ai_automation_percent: number;
  ai_solution: string;
  recommended_tool: string;
  estimated_time_after: number;
  hours_saved: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'full_automation' | 'augmentation' | 'human_inherent';
  workflow_steps: WorkflowStep[];
  starter_prompts: StarterPrompt[];
  quick_start_guide: string;
}

interface EmployeeAnalysis {
  profile_id: string;
  job_title: string;
  department: string;
  ai_augmentable_tasks: AIAugmentableTask[];
  total_weekly_hours_saved: number;
  ai_readiness_score: number;
  recommended_tools: string[];
  priority_tasks: AIAugmentableTask[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { profileId, jobDescriptionId, companyId, employeeIds } = await req.json();

    if (!profileId && !companyId) {
      throw new Error('Either profileId or companyId is required');
    }

    // If analyzing a single employee
    if (profileId) {
      const analysis = await analyzeEmployee(supabase, profileId, jobDescriptionId);
      
      if (!analysis) {
        throw new Error('No job description found for this employee');
      }
      
      await saveEmployeeRecommendation(supabase, {
        profile_id: profileId,
        job_description_id: analysis.jobDescriptionId,
        recommendations: analysis.ai_augmentable_tasks,
        priority_tasks: analysis.priority_tasks,
        recommended_tools: analysis.recommended_tools,
        estimated_weekly_hours_saved: analysis.total_weekly_hours_saved,
        ai_readiness_score: analysis.ai_readiness_score,
        workflow_data: analysis.priority_tasks.map(t => ({
          task: t.task,
          workflow_steps: t.workflow_steps,
          quick_start_guide: t.quick_start_guide,
        })),
        prompt_library: analysis.priority_tasks.flatMap((t: AIAugmentableTask) => 
          t.starter_prompts.map((p: StarterPrompt) => ({
            task: t.task,
            tool: t.recommended_tool,
            ...p,
          }))
        ),
        generated_at: new Date().toISOString(),
        mentioned_in_podcast: false,
      });

      return new Response(JSON.stringify({ success: true, analysis }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If analyzing entire company (or selected employees)
    let employeesQuery = supabase
      .from('profiles')
      .select('id, full_name, role, job_title')
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      employeesQuery = employeesQuery.in('id', employeeIds);
    }
    
    const { data: employees, error: employeesError } = await employeesQuery;

    if (employeesError) {
      console.error('Error loading employees:', employeesError);
      throw new Error('Unable to load employees for analysis');
    }

    if (!employees || employees.length === 0) {
      throw new Error('No employees found. Please select employees to analyze.');
    }
    
    const { data: jobDescriptions } = await supabase
      .from('job_descriptions')
      .select('profile_id')
      .in('profile_id', employees.map(e => e.id))
      .eq('is_current', true);
    
    if (!jobDescriptions || jobDescriptions.length === 0) {
      throw new Error('No job descriptions found for selected employees. Add job descriptions first.');
    }

    const analyses: EmployeeAnalysis[] = [];
    
    for (const employee of employees) {
      try {
        const analysis = await analyzeEmployee(supabase, employee.id);
        if (analysis) {
          analyses.push({
            profile_id: employee.id,
            job_title: analysis.jobTitle || employee.job_title || employee.role || 'Unknown',
            department: 'General',
            ...analysis,
          });

          await saveEmployeeRecommendation(supabase, {
            profile_id: employee.id,
            job_description_id: analysis.jobDescriptionId,
            recommendations: analysis.ai_augmentable_tasks,
            priority_tasks: analysis.priority_tasks,
            recommended_tools: analysis.recommended_tools,
            estimated_weekly_hours_saved: analysis.total_weekly_hours_saved,
            ai_readiness_score: analysis.ai_readiness_score,
            workflow_data: analysis.priority_tasks.map(t => ({
              task: t.task,
              workflow_steps: t.workflow_steps,
              quick_start_guide: t.quick_start_guide,
            })),
            prompt_library: analysis.priority_tasks.flatMap((t: AIAugmentableTask) => 
              t.starter_prompts.map((p: StarterPrompt) => ({
                task: t.task,
                tool: t.recommended_tool,
                ...p,
              }))
            ),
            generated_at: new Date().toISOString(),
            mentioned_in_podcast: false,
          });
        }
      } catch (e) {
        console.error(`Error analyzing employee ${employee.id}:`, e);
      }
    }

    // Aggregate for company report
    const aggregation = aggregateAnalyses(analyses);

    // Store company report
    const { data: report } = await supabase
      .from('ai_efficiency_reports')
      .insert({
        company_id: companyId,
        executive_summary: aggregation.executiveSummary,
        role_analysis: aggregation.roleAnalysis,
        department_analysis: aggregation.departmentAnalysis,
        total_estimated_hours_saved: aggregation.totalHoursSaved,
        total_employees_analyzed: analyses.length,
        efficiency_score: aggregation.overallScore,
        quick_wins: aggregation.quickWins,
        implementation_roadmap: aggregation.roadmap,
      })
      .select()
      .single();

    return new Response(JSON.stringify({ 
      success: true, 
      report,
      employeesAnalyzed: analyses.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in analyze-ai-efficiency:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function saveEmployeeRecommendation(supabase: any, payload: {
  profile_id: string;
  job_description_id?: string;
  recommendations: any;
  priority_tasks: any;
  recommended_tools: any;
  estimated_weekly_hours_saved: number;
  ai_readiness_score: number;
  workflow_data?: any;
  prompt_library?: any;
  generated_at: string;
  mentioned_in_podcast?: boolean;
}) {
  const { data: existing, error: existingError } = await supabase
    .from('employee_ai_recommendations')
    .select('id')
    .eq('profile_id', payload.profile_id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('Error checking existing recommendations:', existingError);
  }

  const upsertData = {
    job_description_id: payload.job_description_id,
    recommendations: payload.recommendations,
    priority_tasks: payload.priority_tasks,
    recommended_tools: payload.recommended_tools,
    estimated_weekly_hours_saved: payload.estimated_weekly_hours_saved,
    ai_readiness_score: payload.ai_readiness_score,
    workflow_data: payload.workflow_data || [],
    prompt_library: payload.prompt_library || [],
    generated_at: payload.generated_at,
    mentioned_in_podcast: payload.mentioned_in_podcast ?? false,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('employee_ai_recommendations')
      .update(upsertData)
      .eq('id', existing.id);

    if (updateError) {
      console.error('Error updating recommendation:', updateError);
      throw updateError;
    }
    return;
  }

  const { error: insertError } = await supabase
    .from('employee_ai_recommendations')
    .insert({
      profile_id: payload.profile_id,
      ...upsertData,
    });

  if (insertError) {
    console.error('Error inserting recommendation:', insertError);
    throw insertError;
  }
}

async function analyzeEmployee(supabase: any, profileId: string, jobDescriptionId?: string) {
  // Fetch job description, capabilities, and conversation insights in parallel
  const [jobDescResult, capabilitiesResult, insightsResult, conversationsResult] = await Promise.all([
    // Job description
    jobDescriptionId 
      ? supabase.from('job_descriptions').select('*').eq('id', jobDescriptionId).single()
      : supabase.from('job_descriptions').select('*').eq('profile_id', profileId).eq('is_current', true).order('created_at', { ascending: false }).limit(1).single(),
    
    // Employee capabilities with details
    supabase
      .from('employee_capabilities')
      .select('*, capabilities(name, description, category)')
      .eq('profile_id', profileId)
      .order('priority', { ascending: true })
      .limit(10),
    
    // Coaching insights from Jericho conversations
    supabase
      .from('coaching_insights')
      .select('insight_type, insight_text, confidence_level')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .order('last_reinforced_at', { ascending: false })
      .limit(10),
    
    // Recent conversation summaries to understand how they work
    supabase
      .from('conversation_summaries')
      .select('summary_text, key_topics, action_items')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const jobDescription = jobDescResult.data;
  const capabilities = capabilitiesResult.data || [];
  const coachingInsights = insightsResult.data || [];
  const conversationSummaries = conversationsResult.data || [];

  if (!jobDescription) {
    return null;
  }
  
  // Build context from capabilities
  const capabilityContext = capabilities.length > 0 
    ? `\n\nEMPLOYEE CAPABILITIES (areas they focus on):\n${capabilities.map((c: any) => 
        `- ${c.capabilities?.name || 'Unknown'} (${c.current_level || 'developing'} → ${c.target_level || 'proficient'}): ${c.capabilities?.description || ''}`
      ).join('\n')}`
    : '';
  
  // Build context from coaching insights (behavioral patterns from Jericho)
  const insightContext = coachingInsights.length > 0
    ? `\n\nBEHAVIORAL INSIGHTS FROM COACHING (how they actually work):\n${coachingInsights.map((i: any) => 
        `- [${i.insight_type}] ${i.insight_text}`
      ).join('\n')}`
    : '';
  
  // Build context from conversation summaries
  const conversationContext = conversationSummaries.length > 0
    ? `\n\nRECENT CONVERSATION THEMES (what they discuss with AI coach):\n${conversationSummaries.map((s: any) => 
        `- Topics: ${(s.key_topics || []).join(', ')}`
      ).join('\n')}`
    : '';

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const aiGatewayUrl = Deno.env.get('AI_GATEWAY_URL') || 'https://ai.gateway.lovable.dev/v1/chat/completions';

  const systemPrompt = `You are an AI efficiency analyst specializing in realistic, actionable AI adoption strategies. Your job is to analyze job descriptions, employee capabilities, and behavioral insights to identify specific tasks that can be augmented or automated with AI tools.

CRITICAL CONSTRAINTS - YOU MUST FOLLOW THESE:
1. Maximum work week: ${MAX_WEEKLY_WORK_HOURS} hours (absolute ceiling)
2. Maximum total task hours to analyze: ${MAX_CURRENT_TASK_HOURS} hours per person
3. Maximum AI savings per person: ${MAX_AI_SAVINGS_HOURS} hours/week (absolute cap)
4. No single task can claim more than ${MAX_SINGLE_TASK_HOURS} hours/week
5. Be CONSERVATIVE: most tasks save 20-50% of time, NOT 80%
6. Tasks must be SPECIFIC and MEASURABLE

For each task, you MUST provide:
- instances_per_week: How many times this task occurs weekly (1-20)
- minutes_per_instance: Time per occurrence (5-120 minutes max)
- ai_automation_percent: What % AI can realistically handle (15-50% for most tasks)
- workflow_steps: 3-5 concrete steps to implement with AI
- starter_prompts: 1-2 ready-to-use prompts they can copy/paste

CATEGORIZE each task as:
1. "full_automation" - AI handles entirely (data entry, scheduling, basic research) - RARE, max 2 tasks
2. "augmentation" - AI speeds this up (report writing, analysis, drafting) - MOST COMMON
3. "human_inherent" - Requires human judgment (negotiations, mentoring, strategy) - NO TIME SAVINGS

RECOMMENDED TOOLS (be specific):
- ChatGPT/Claude: Writing, summarizing, brainstorming, analysis
- Microsoft Copilot: Email drafting, meeting summaries, Office docs
- Perplexity: Research, fact-checking, competitive analysis
- GitHub Copilot: Code development only
- Zapier/Make: Workflow automation for repetitive tasks
- Notion AI: Documentation and project notes

AI READINESS SCORE (0-100%):
This represents how ready this employee is to benefit from AI tools:
- 0-25%: Low readiness (few AI opportunities, mostly human-inherent work)
- 26-50%: Moderate readiness (some augmentation potential)
- 51-75%: Good readiness (significant automation possible)
- 76-100%: High readiness (many tasks can be heavily augmented with AI)

Consider their capabilities and behavioral insights when scoring - employees already using AI or showing interest score higher.

IMPORTANT: Return ONLY valid JSON. No markdown. No extra text.`;

  const userPrompt = `Analyze this employee and identify 4-8 AI-augmentable tasks with REALISTIC time savings.

Job Title: ${jobDescription.title || 'Not specified'}
Description: ${jobDescription.description}
${capabilityContext}
${insightContext}
${conversationContext}

Return a JSON object with this exact structure:
{
  "ai_augmentable_tasks": [
    {
      "task": "specific, measurable task from job description",
      "instances_per_week": 5,
      "minutes_per_instance": 45,
      "current_time_hours": 3.75,
      "ai_automation_percent": 35,
      "ai_solution": "one sentence on how AI helps",
      "recommended_tool": "specific AI tool name",
      "estimated_time_after": 2.44,
      "hours_saved": 1.31,
      "difficulty": "easy",
      "category": "augmentation",
      "workflow_steps": [
        {
          "step": 1,
          "action": "Gather key data points from project tracker",
          "tool": "None",
          "time_minutes": 5
        },
        {
          "step": 2,
          "action": "Open ChatGPT and paste the summarization prompt",
          "tool": "ChatGPT",
          "time_minutes": 2,
          "prompt_template": "Summarize these updates..."
        },
        {
          "step": 3,
          "action": "Review AI output and make edits",
          "tool": "None",
          "time_minutes": 10
        }
      ],
      "starter_prompts": [
        {
          "use_case": "Weekly status report",
          "prompt": "Summarize these project updates into a professional status report for leadership. Include: progress %, blockers, next steps. Tone: executive-friendly, concise.\\n\\nUpdates:\\n[paste here]",
          "expected_output": "A 2-3 paragraph executive summary with clear formatting"
        }
      ],
      "quick_start_guide": "Try this today: Before your next status report, paste your raw notes into ChatGPT with the prompt above. Review the output and you'll cut report writing time in half."
    }
  ],
  "total_weekly_hours_saved": 6,
  "ai_readiness_score": 55,
  "recommended_tools": ["ChatGPT/Claude", "Microsoft Copilot"],
  "key_insight": "The biggest opportunity is automating weekly status reports and meeting prep."
}

MATH CHECK REQUIREMENTS:
- current_time_hours = (instances_per_week × minutes_per_instance) / 60
- hours_saved = current_time_hours × (ai_automation_percent / 100)
- estimated_time_after = current_time_hours - hours_saved
- Sum of all current_time_hours MUST NOT exceed ${MAX_CURRENT_TASK_HOURS} hours
- total_weekly_hours_saved MUST equal sum of all hours_saved
- total_weekly_hours_saved MUST NOT exceed ${MAX_AI_SAVINGS_HOURS} hours

PROMPT QUALITY REQUIREMENTS (CRITICAL):
Each starter_prompt MUST be:
1. COMPLETE and READY TO USE - the employee should be able to copy, paste, and get results immediately
2. SPECIFIC to the task - not generic AI prompts
3. Include clear [PLACEHOLDERS] showing where to insert their specific data
4. Use proper formatting with line breaks and structure
5. Include context about desired output format, tone, and length
6. Have 2-3 prompts per task (one basic, one advanced, one for edge cases)

PROMPT EXAMPLES BY CATEGORY:
- Email drafting: "Write a professional email to [RECIPIENT ROLE] about [TOPIC]. Key points: [LIST 3-5 BULLETS]. Tone: [formal/friendly/urgent]. Keep under 150 words."
- Report writing: "Analyze this data and create a [TYPE] report:\\n\\n[PASTE DATA]\\n\\nInclude: executive summary, key findings, recommendations. Format as bullet points with headers."
- Research: "Research [TOPIC] and provide: 1) Current trends, 2) Key statistics, 3) Competitor analysis, 4) Actionable recommendations. Cite sources."
- Meeting prep: "Create an agenda for a [DURATION] meeting about [TOPIC] with [ATTENDEES]. Include: objectives, discussion points, time allocations, action items template."

AI READINESS SCORE GUIDANCE (0-100%):
- Consider the employee's capabilities and growth areas
- Factor in any behavioral insights from coaching conversations
- Higher scores for roles with many repetitive, data-heavy tasks
- Lower scores for roles requiring human judgment (leadership, strategy, negotiations)

Focus on ACTIONABLE tasks with SPECIFIC workflows and READY-TO-USE prompts that employees can copy and paste TODAY.`;

  const response = await fetch(aiGatewayUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const aiResult = await response.json();
  const content = aiResult.choices?.[0]?.message?.content;

  if (!content || typeof content !== 'string') {
    throw new Error('No content from AI');
  }

  const sanitizeJson = (raw: string) => {
    let s = raw.trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      s = s.slice(firstBrace, lastBrace + 1);
    }
    return s;
  };

  let analysis: any;
  try {
    analysis = JSON.parse(sanitizeJson(content));
  } catch (e) {
    console.error('AI returned non-JSON content (raw):', content);
    console.error('AI returned non-JSON content (sanitized):', sanitizeJson(content));
    throw new Error('AI returned invalid JSON');
  }

  // Validate and cap hours to realistic limits
  let tasks = (analysis.ai_augmentable_tasks || []).map((t: AIAugmentableTask) => {
    // Recalculate to ensure math is correct
    const calculatedCurrentHours = (t.instances_per_week * t.minutes_per_instance) / 60;
    const cappedCurrentHours = Math.min(calculatedCurrentHours, MAX_SINGLE_TASK_HOURS);
    const automationPercent = Math.min(t.ai_automation_percent, 50) / 100; // Cap at 50%
    const calculatedHoursSaved = cappedCurrentHours * automationPercent;
    
    return {
      ...t,
      current_time_hours: Math.round(cappedCurrentHours * 100) / 100,
      hours_saved: Math.round(calculatedHoursSaved * 100) / 100,
      estimated_time_after: Math.round((cappedCurrentHours - calculatedHoursSaved) * 100) / 100,
      ai_automation_percent: Math.min(t.ai_automation_percent, 50),
      workflow_steps: t.workflow_steps || [],
      starter_prompts: t.starter_prompts || [],
      quick_start_guide: t.quick_start_guide || '',
    };
  });

  // First, cap total current_time_hours to MAX_CURRENT_TASK_HOURS (realistic work analyzed)
  let totalCurrentHours = tasks.reduce((sum: number, t: AIAugmentableTask) => sum + t.current_time_hours, 0);
  if (totalCurrentHours > MAX_CURRENT_TASK_HOURS) {
    const scaleFactor = MAX_CURRENT_TASK_HOURS / totalCurrentHours;
    tasks = tasks.map((t: AIAugmentableTask) => {
      const newCurrentHours = Math.round(t.current_time_hours * scaleFactor * 100) / 100;
      const newHoursSaved = Math.round(t.hours_saved * scaleFactor * 100) / 100;
      return {
        ...t,
        current_time_hours: newCurrentHours,
        hours_saved: newHoursSaved,
        estimated_time_after: Math.round((newCurrentHours - newHoursSaved) * 100) / 100,
      };
    });
    totalCurrentHours = MAX_CURRENT_TASK_HOURS;
  }

  // Then, cap total hours_saved to MAX_AI_SAVINGS_HOURS (absolute max per person)
  let totalHoursSaved = tasks.reduce((sum: number, t: AIAugmentableTask) => sum + t.hours_saved, 0);
  
  if (totalHoursSaved > MAX_AI_SAVINGS_HOURS) {
    const scaleFactor = MAX_AI_SAVINGS_HOURS / totalHoursSaved;
    tasks = tasks.map((t: AIAugmentableTask) => ({
      ...t,
      hours_saved: Math.round(t.hours_saved * scaleFactor * 100) / 100,
      estimated_time_after: Math.round((t.current_time_hours - (t.hours_saved * scaleFactor)) * 100) / 100,
    }));
    totalHoursSaved = MAX_AI_SAVINGS_HOURS;
  }
  
  // Sort by impact (highest hours saved, easiest difficulty first)
  const priorityTasks = [...tasks]
    .filter((t: AIAugmentableTask) => t.category !== 'human_inherent')
    .sort((a: AIAugmentableTask, b: AIAugmentableTask) => {
      const difficultyScore = { easy: 3, medium: 2, hard: 1 };
      return (b.hours_saved * difficultyScore[b.difficulty]) - (a.hours_saved * difficultyScore[a.difficulty]);
    });

  return {
    jobDescriptionId: jobDescription.id,
    jobTitle: jobDescription.title,
    ai_augmentable_tasks: tasks,
    total_weekly_hours_saved: Math.round(totalHoursSaved * 100) / 100,
    ai_readiness_score: Math.min(analysis.ai_readiness_score || 0, 100),
    recommended_tools: analysis.recommended_tools || [],
    priority_tasks: priorityTasks,
    key_insight: analysis.key_insight,
  };
}

function aggregateAnalyses(analyses: EmployeeAnalysis[]) {
  const totalHoursSaved = analyses.reduce((sum, a) => sum + a.total_weekly_hours_saved, 0);
  const avgScore = analyses.length > 0 
    ? analyses.reduce((sum, a) => sum + a.ai_readiness_score, 0) / analyses.length 
    : 0;

  // Group by role
  const byRole = new Map<string, EmployeeAnalysis[]>();
  analyses.forEach(a => {
    const role = a.job_title || 'Other';
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(a);
  });

  const roleAnalysis = Array.from(byRole.entries()).map(([role, emps]) => ({
    role,
    employee_count: emps.length,
    total_hours_saved: emps.reduce((s, e) => s + e.total_weekly_hours_saved, 0),
    avg_readiness_score: emps.reduce((s, e) => s + e.ai_readiness_score, 0) / emps.length,
    top_tools: [...new Set(emps.flatMap(e => e.recommended_tools))].slice(0, 5),
  })).sort((a, b) => b.total_hours_saved - a.total_hours_saved);

  // Group by department
  const byDept = new Map<string, EmployeeAnalysis[]>();
  analyses.forEach(a => {
    const dept = a.department || 'General';
    if (!byDept.has(dept)) byDept.set(dept, []);
    byDept.get(dept)!.push(a);
  });

  const departmentAnalysis = Array.from(byDept.entries()).map(([dept, emps]) => ({
    department: dept,
    employee_count: emps.length,
    total_hours_saved: emps.reduce((s, e) => s + e.total_weekly_hours_saved, 0),
    avg_readiness_score: emps.reduce((s, e) => s + e.ai_readiness_score, 0) / emps.length,
  })).sort((a, b) => b.total_hours_saved - a.total_hours_saved);

  // Find quick wins with workflow data
  const allTasks = analyses.flatMap(a => a.priority_tasks || []);
  const taskGroups = new Map<string, { 
    count: number; 
    totalHours: number; 
    tool: string; 
    difficulty: string;
    workflow_steps: WorkflowStep[];
    starter_prompts: StarterPrompt[];
    quick_start_guide: string;
  }>();
  
  allTasks.forEach(t => {
    const key = t.task.toLowerCase().substring(0, 60);
    const existing = taskGroups.get(key) || { 
      count: 0, 
      totalHours: 0, 
      tool: t.recommended_tool, 
      difficulty: t.difficulty,
      workflow_steps: t.workflow_steps || [],
      starter_prompts: t.starter_prompts || [],
      quick_start_guide: t.quick_start_guide || '',
    };
    existing.count++;
    existing.totalHours += t.hours_saved;
    if (!existing.workflow_steps.length && t.workflow_steps?.length) {
      existing.workflow_steps = t.workflow_steps;
    }
    if (!existing.starter_prompts.length && t.starter_prompts?.length) {
      existing.starter_prompts = t.starter_prompts;
    }
    if (!existing.quick_start_guide && t.quick_start_guide) {
      existing.quick_start_guide = t.quick_start_guide;
    }
    taskGroups.set(key, existing);
  });

  const quickWins = Array.from(taskGroups.entries())
    .filter(([_, v]) => v.difficulty === 'easy' || v.count >= 2)
    .sort((a, b) => b[1].totalHours - a[1].totalHours)
    .slice(0, 8)
    .map(([task, data]) => ({
      task,
      affected_employees: data.count,
      total_weekly_hours_saved: Math.round(data.totalHours * 100) / 100,
      recommended_tool: data.tool,
      difficulty: data.difficulty,
      workflow_steps: data.workflow_steps,
      starter_prompts: data.starter_prompts,
      quick_start_guide: data.quick_start_guide,
    }));

  // Implementation roadmap
  const roadmap = [
    {
      phase: 1,
      title: 'Quick Wins (Week 1-2)',
      focus: 'Deploy easy automations with immediate ROI',
      estimated_hours_saved: quickWins.filter(q => q.difficulty === 'easy').reduce((s, q) => s + q.total_weekly_hours_saved, 0),
      weekly_value: quickWins.filter(q => q.difficulty === 'easy').reduce((s, q) => s + q.total_weekly_hours_saved, 0) * HOURLY_RATE,
      actions: quickWins.filter(q => q.difficulty === 'easy').slice(0, 3).map(q => q.task),
    },
    {
      phase: 2,
      title: 'Tool Rollout (Week 3-4)',
      focus: 'Train team on recommended AI tools',
      tools: [...new Set(analyses.flatMap(a => a.recommended_tools))].slice(0, 5),
      estimated_hours_saved: totalHoursSaved * 0.4,
      weekly_value: totalHoursSaved * 0.4 * HOURLY_RATE,
    },
    {
      phase: 3,
      title: 'Process Integration (Month 2)',
      focus: 'Embed AI into daily workflows with medium-difficulty tasks',
      estimated_hours_saved: totalHoursSaved * 0.7,
      weekly_value: totalHoursSaved * 0.7 * HOURLY_RATE,
    },
    {
      phase: 4,
      title: 'Full Adoption (Month 3+)',
      focus: 'Advanced automation and continuous optimization',
      estimated_hours_saved: totalHoursSaved,
      weekly_value: totalHoursSaved * HOURLY_RATE,
      annual_value: totalHoursSaved * HOURLY_RATE * 52,
    },
  ];

  // Executive summary with $75/hour calculations
  const weeklyValue = totalHoursSaved * HOURLY_RATE;
  const annualValue = weeklyValue * 52;
  const avgPerEmployee = analyses.length > 0 ? totalHoursSaved / analyses.length : 0;

  const executiveSummary = {
    headline: `Your team could save ${Math.round(totalHoursSaved)} hours per week`,
    subheadline: `That's $${weeklyValue.toLocaleString()}/week or $${Math.round(annualValue / 1000)}K annually`,
    employees_analyzed: analyses.length,
    total_hours_saved: Math.round(totalHoursSaved * 10) / 10,
    avg_hours_saved_per_employee: Math.round(avgPerEmployee * 10) / 10,
    weekly_value: weeklyValue,
    annual_value: annualValue,
    hourly_rate: HOURLY_RATE,
    ai_readiness_score: Math.round(avgScore),
    top_opportunity_role: roleAnalysis[0]?.role || 'N/A',
    top_opportunity_department: departmentAnalysis[0]?.department || 'N/A',
    quick_win_count: quickWins.length,
    quick_win_hours: quickWins.reduce((s, q) => s + q.total_weekly_hours_saved, 0),
  };

  return {
    executiveSummary,
    roleAnalysis,
    departmentAnalysis,
    totalHoursSaved: Math.round(totalHoursSaved * 10) / 10,
    overallScore: avgScore,
    quickWins,
    roadmap,
  };
}
