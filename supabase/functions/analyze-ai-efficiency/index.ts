import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIAugmentableTask {
  task: string;
  current_time_hours: number;
  ai_solution: string;
  recommended_tool: string;
  estimated_time_after: number;
  hours_saved: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'full_automation' | 'augmentation' | 'human_inherent';
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
      
      // Store the recommendation (table does not have a UNIQUE constraint on profile_id,
      // so we cannot use upsert(onConflict: 'profile_id') reliably).
      await saveEmployeeRecommendation(supabase, {
        profile_id: profileId,
        job_description_id: analysis.jobDescriptionId,
        recommendations: analysis.ai_augmentable_tasks,
        priority_tasks: analysis.priority_tasks,
        recommended_tools: analysis.recommended_tools,
        estimated_weekly_hours_saved: analysis.total_weekly_hours_saved,
        ai_readiness_score: analysis.ai_readiness_score,
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
    
    // If specific employee IDs provided, filter to those
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
    
    // Check if any employees have job descriptions
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

          // Store individual recommendation
          await saveEmployeeRecommendation(supabase, {
            profile_id: employee.id,
            job_description_id: analysis.jobDescriptionId,
            recommendations: analysis.ai_augmentable_tasks,
            priority_tasks: analysis.priority_tasks,
            recommended_tools: analysis.recommended_tools,
            estimated_weekly_hours_saved: analysis.total_weekly_hours_saved,
            ai_readiness_score: analysis.ai_readiness_score,
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
  generated_at: string;
  mentioned_in_podcast?: boolean;
}) {
  // Update latest existing recommendation for this profile, or insert a new one.
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

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('employee_ai_recommendations')
      .update({
        job_description_id: payload.job_description_id,
        recommendations: payload.recommendations,
        priority_tasks: payload.priority_tasks,
        recommended_tools: payload.recommended_tools,
        estimated_weekly_hours_saved: payload.estimated_weekly_hours_saved,
        ai_readiness_score: payload.ai_readiness_score,
        generated_at: payload.generated_at,
        mentioned_in_podcast: payload.mentioned_in_podcast ?? false,
        updated_at: new Date().toISOString(),
      })
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
      job_description_id: payload.job_description_id,
      recommendations: payload.recommendations,
      priority_tasks: payload.priority_tasks,
      recommended_tools: payload.recommended_tools,
      estimated_weekly_hours_saved: payload.estimated_weekly_hours_saved,
      ai_readiness_score: payload.ai_readiness_score,
      generated_at: payload.generated_at,
      mentioned_in_podcast: payload.mentioned_in_podcast ?? false,
    });

  if (insertError) {
    console.error('Error inserting recommendation:', insertError);
    throw insertError;
  }
}

async function analyzeEmployee(supabase: any, profileId: string, jobDescriptionId?: string) {
  // Get job description
  let jobDescription;
  if (jobDescriptionId) {
    const { data } = await supabase
      .from('job_descriptions')
      .select('*')
      .eq('id', jobDescriptionId)
      .single();
    jobDescription = data;
  } else {
    const { data } = await supabase
      .from('job_descriptions')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    jobDescription = data;
  }

  if (!jobDescription) {
    return null;
  }

  // Use AI to analyze the job description
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const aiGatewayUrl = Deno.env.get('AI_GATEWAY_URL') || 'https://ai.gateway.lovable.dev/v1/chat/completions';

  const systemPrompt = `You are an AI efficiency analyst. Your job is to analyze job descriptions and identify tasks that can be augmented or automated with AI tools.

For each task in the job description, categorize it as:
1. "full_automation" - AI can handle this entirely (e.g., data entry, scheduling, basic research)
2. "augmentation" - AI can speed this up significantly (e.g., report writing, analysis, communication drafting)
3. "human_inherent" - Requires human judgment/relationships (e.g., negotiations, mentoring, creative strategy)

For automation and augmentation tasks, recommend specific tools:
- ChatGPT/Claude: Writing, summarizing, brainstorming, coding assistance
- Microsoft Copilot: Office productivity, email drafting, meeting summaries
- Perplexity: Research, fact-checking, competitive analysis
- Notion AI: Documentation, project management
- Grammarly: Writing refinement
- Zapier/Make: Workflow automation
- GitHub Copilot: Code development

Be conservative with time estimates - assume 20-40% time reduction for augmented tasks.

IMPORTANT: Return ONLY valid JSON. No markdown. No extra text.`;

  const userPrompt = `Analyze this job description and identify AI-augmentable tasks.

Job Title: ${jobDescription.title || 'Not specified'}
Description: ${jobDescription.description}

Return a JSON object with this structure:
{
  "ai_augmentable_tasks": [
    {
      "task": "specific task from job description",
      "current_time_hours": 5,
      "ai_solution": "how AI can help",
      "recommended_tool": "specific AI tool",
      "estimated_time_after": 2,
      "hours_saved": 3,
      "difficulty": "easy" | "medium" | "hard",
      "category": "full_automation" | "augmentation" | "human_inherent"
    }
  ],
  "total_weekly_hours_saved": 15,
  "ai_readiness_score": 65,
  "recommended_tools": ["ChatGPT/Claude", "Perplexity"],
  "key_insight": "one sentence about the biggest opportunity"
}

IMPORTANT SCORING GUIDELINES:
- ai_readiness_score MUST be a number from 0 to 100 (percentage scale)
  - 0-30: Low readiness (few AI-automatable tasks, mostly human-inherent work)
  - 31-50: Moderate readiness (some augmentation opportunities)
  - 51-70: Good readiness (significant automation potential)
  - 71-100: High readiness (many tasks can be automated or heavily augmented)
- Base the score on what percentage of the role's tasks can benefit from AI
- Consider both the quantity and quality of AI opportunities

Focus on practical, immediately actionable recommendations. Be specific about which AI tools to use.`;

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

  // Some models occasionally wrap JSON in markdown fences (```json ... ```)
  // or add minor leading/trailing text. We sanitize before parsing.
  const sanitizeJson = (raw: string) => {
    let s = raw.trim();
    // Strip markdown code fences if present
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    // If still not pure JSON, attempt to extract the outermost JSON object
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
  
  // Get all priority tasks sorted by impact (highest hours saved, easiest difficulty first)
  const priorityTasks = [...(analysis.ai_augmentable_tasks || [])]
    .filter((t: AIAugmentableTask) => t.category !== 'human_inherent')
    .sort((a: AIAugmentableTask, b: AIAugmentableTask) => {
      const difficultyScore = { easy: 3, medium: 2, hard: 1 };
      return (b.hours_saved * difficultyScore[b.difficulty]) - (a.hours_saved * difficultyScore[a.difficulty]);
    });

  return {
    jobDescriptionId: jobDescription.id,
    jobTitle: jobDescription.title,
    ai_augmentable_tasks: analysis.ai_augmentable_tasks || [],
    total_weekly_hours_saved: analysis.total_weekly_hours_saved || 0,
    ai_readiness_score: analysis.ai_readiness_score || 0,
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

  // Find quick wins (easy tasks with high impact across multiple employees)
  const allTasks = analyses.flatMap(a => a.ai_augmentable_tasks);
  const taskFrequency = new Map<string, { count: number; totalHours: number; tool: string; difficulty: string }>();
  
  allTasks.forEach(t => {
    const key = t.task.toLowerCase().substring(0, 50);
    const existing = taskFrequency.get(key) || { count: 0, totalHours: 0, tool: t.recommended_tool, difficulty: t.difficulty };
    existing.count++;
    existing.totalHours += t.hours_saved;
    taskFrequency.set(key, existing);
  });

  const quickWins = Array.from(taskFrequency.entries())
    .filter(([_, v]) => v.difficulty === 'easy' && v.count >= 2)
    .sort((a, b) => b[1].totalHours - a[1].totalHours)
    .slice(0, 5)
    .map(([task, data]) => ({
      task,
      affected_employees: data.count,
      total_weekly_hours_saved: data.totalHours,
      recommended_tool: data.tool,
    }));

  // Implementation roadmap
  const roadmap = [
    {
      phase: 1,
      title: 'Quick Wins (Week 1-2)',
      focus: 'Easy automation tasks with immediate impact',
      estimated_hours_saved: quickWins.reduce((s, q) => s + q.total_weekly_hours_saved, 0),
    },
    {
      phase: 2,
      title: 'Tool Adoption (Week 3-4)',
      focus: 'Roll out recommended AI tools with training',
      tools: [...new Set(analyses.flatMap(a => a.recommended_tools))].slice(0, 5),
    },
    {
      phase: 3,
      title: 'Process Integration (Month 2)',
      focus: 'Embed AI into daily workflows',
      estimated_hours_saved: totalHoursSaved * 0.5,
    },
    {
      phase: 4,
      title: 'Full Adoption (Month 3+)',
      focus: 'Advanced automation and optimization',
      estimated_hours_saved: totalHoursSaved,
    },
  ];

  // Executive summary
  const executiveSummary = {
    headline: `Your organization could save ${Math.round(totalHoursSaved)} hours per week through AI adoption`,
    employees_analyzed: analyses.length,
    avg_hours_saved_per_employee: analyses.length > 0 ? Math.round(totalHoursSaved / analyses.length * 10) / 10 : 0,
    annual_hours_saved: Math.round(totalHoursSaved * 52),
    annual_value_estimate: Math.round(totalHoursSaved * 52 * 50), // $50/hour average
    ai_readiness_score: Math.round(avgScore),
    top_opportunity_role: roleAnalysis[0]?.role || 'N/A',
    top_opportunity_department: departmentAnalysis[0]?.department || 'N/A',
  };

  return {
    executiveSummary,
    roleAnalysis,
    departmentAnalysis,
    totalHoursSaved,
    overallScore: avgScore,
    quickWins,
    roadmap,
  };
}
