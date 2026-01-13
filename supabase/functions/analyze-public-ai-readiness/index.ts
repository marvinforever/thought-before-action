import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobDescription {
  title: string;
  description: string;
}

interface AIAugmentableTask {
  taskName: string;
  currentTimeSpent: string;
  aiSolution: string;
  toolsRecommended: string[];
  estimatedTimeSaved: string;
  implementationComplexity: 'low' | 'medium' | 'high';
  agentOpportunity: boolean;
}

interface RoleAnalysis {
  jobTitle: string;
  aiAugmentableTasks: AIAugmentableTask[];
  totalEstimatedWeeklyHoursSaved: number;
  aiReadinessScore: number;
  quickWins: string[];
  agentOpportunities: string[];
  existingAIAcknowledgment?: string;
}

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function analyzeJobDescription(
  jd: JobDescription,
  currentTools: string[],
  currentWorkflows: string
): Promise<RoleAnalysis> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const existingAIContext = currentTools.length > 0 || currentWorkflows
    ? `
IMPORTANT CONTEXT - Current AI Usage:
- Tools already being used: ${currentTools.length > 0 ? currentTools.join(', ') : 'None specified'}
- Current AI workflows: ${currentWorkflows || 'None described'}

When analyzing, acknowledge what they're already doing well and focus on ADDITIONAL opportunities beyond their current usage. Calculate time savings as ADDITIONAL hours that could be saved on top of current AI usage.
`
    : '';

  const systemPrompt = `You are an AI efficiency analyst specializing in workforce automation and AI augmentation. Analyze job descriptions to identify tasks that can be automated or enhanced with AI.
${existingAIContext}
Return your analysis as valid JSON matching this structure:
{
  "jobTitle": "string",
  "aiAugmentableTasks": [
    {
      "taskName": "string",
      "currentTimeSpent": "string (e.g., '3 hours/week')",
      "aiSolution": "string describing how AI can help",
      "toolsRecommended": ["tool1", "tool2"],
      "estimatedTimeSaved": "string (e.g., '2 hours/week')",
      "implementationComplexity": "low" | "medium" | "high",
      "agentOpportunity": boolean (true if this could be fully automated by an AI agent)
    }
  ],
  "totalEstimatedWeeklyHoursSaved": number,
  "aiReadinessScore": number (0-100),
  "quickWins": ["string array of easy wins"],
  "agentOpportunities": ["string array of tasks that could be fully automated by custom AI agents"],
  "existingAIAcknowledgment": "string acknowledging current AI usage if any"
}

Focus on practical, immediately actionable recommendations. Be specific about tools and time savings. Identify tasks that could be handled by custom AI agents (not just tools).`;

  const userPrompt = `Analyze this job role for AI automation opportunities:

Job Title: ${jd.title}

Job Description:
${jd.description}

Provide a comprehensive analysis of how AI can augment this role, with specific tasks, tools, and time savings.`;

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("No content in AI response");

    // Parse JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Clean up common issues
    jsonStr = jsonStr.trim();
    if (jsonStr.startsWith('json')) {
      jsonStr = jsonStr.substring(4).trim();
    }

    const analysis = JSON.parse(jsonStr) as RoleAnalysis;
    return analysis;
  } catch (error) {
    console.error("Error analyzing JD:", jd.title, error);
    // Return a default analysis on error
    return {
      jobTitle: jd.title,
      aiAugmentableTasks: [],
      totalEstimatedWeeklyHoursSaved: 0,
      aiReadinessScore: 50,
      quickWins: ["Unable to analyze - please try again"],
      agentOpportunities: [],
    };
  }
}

function generateExecutiveSummary(analyses: RoleAnalysis[], currentTools: string[]) {
  const totalHoursSaved = analyses.reduce((sum, a) => sum + (a.totalEstimatedWeeklyHoursSaved || 0), 0);
  const avgReadiness = analyses.length > 0
    ? Math.round(analyses.reduce((sum, a) => sum + (a.aiReadinessScore || 0), 0) / analyses.length)
    : 0;

  const allQuickWins = analyses.flatMap(a => a.quickWins || []).slice(0, 5);
  const allAgentOpportunities = analyses.flatMap(a => a.agentOpportunities || []).slice(0, 5);
  const allTasks = analyses.flatMap(a => a.aiAugmentableTasks || []);
  
  // Calculate dollar value (assuming $50/hr average)
  const weeklyValue = totalHoursSaved * 50;
  const yearlyValue = weeklyValue * 52;

  return {
    rolesAnalyzed: analyses.length,
    totalWeeklyHoursSaved: totalHoursSaved,
    totalYearlyHoursSaved: totalHoursSaved * 52,
    estimatedWeeklyDollarValue: weeklyValue,
    estimatedYearlyDollarValue: yearlyValue,
    averageReadinessScore: avgReadiness,
    topQuickWins: allQuickWins,
    topAgentOpportunities: allAgentOpportunities,
    totalTasksIdentified: allTasks.length,
    highImpactTasks: allTasks.filter(t => t.implementationComplexity === 'low').length,
    currentToolsUsed: currentTools,
    headline: totalHoursSaved > 10
      ? `Your team could save ${totalHoursSaved.toFixed(0)}+ hours per week with AI`
      : totalHoursSaved > 5
      ? `Unlock ${totalHoursSaved.toFixed(0)} hours of productivity per week`
      : `Discover AI opportunities for your team`,
    subheadline: yearlyValue > 50000
      ? `That's over $${(yearlyValue / 1000).toFixed(0)}K in annual productivity gains`
      : `Start with quick wins that take minutes to implement`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      name, 
      firstName,
      lastName,
      companyName, 
      jobTitle,
      phone,
      jobDescriptions, 
      currentAITools, 
      currentAIWorkflows,
      utmSource,
      utmMedium,
      utmCampaign,
      referralCode 
    } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobDescriptions || !Array.isArray(jobDescriptions) || jobDescriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one job description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (jobDescriptions.length > 5) {
      return new Response(
        JSON.stringify({ error: 'Maximum 5 job descriptions allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create initial assessment record
    const { data: assessment, error: insertError } = await supabase
      .from('ai_readiness_assessments')
      .insert({
        email,
        name,
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        job_title: jobTitle,
        phone,
        job_descriptions: jobDescriptions,
        current_ai_tools: currentAITools || [],
        current_ai_workflows: currentAIWorkflows || '',
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referral_code: referralCode,
        status: 'analyzing',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating assessment:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create assessment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze each job description
    const analyses: RoleAnalysis[] = [];
    for (const jd of jobDescriptions as JobDescription[]) {
      if (jd.title && jd.description) {
        const analysis = await analyzeJobDescription(jd, currentAITools || [], currentAIWorkflows || '');
        analyses.push(analysis);
      }
    }

    // Generate executive summary
    const executiveSummary = generateExecutiveSummary(analyses, currentAITools || []);
    const totalHoursSaved = analyses.reduce((sum, a) => sum + (a.totalEstimatedWeeklyHoursSaved || 0), 0);
    const avgReadiness = analyses.length > 0
      ? Math.round(analyses.reduce((sum, a) => sum + (a.aiReadinessScore || 0), 0) / analyses.length)
      : 0;

    // Update assessment with results
    const { error: updateError } = await supabase
      .from('ai_readiness_assessments')
      .update({
        analysis_results: analyses,
        executive_summary: executiveSummary,
        total_hours_saved: totalHoursSaved,
        ai_readiness_score: avgReadiness,
        status: 'complete',
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', assessment.id);

    if (updateError) {
      console.error('Error updating assessment:', updateError);
    }

    // Also insert into demo_requests for CRM tracking
    await supabase
      .from('demo_requests')
      .insert({
        email,
        name: name || 'AI Readiness Lead',
        company: companyName,
        phone,
        source: 'ai-readiness-tool',
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referral_code: referralCode,
        notes: `AI Readiness Score: ${avgReadiness}%, Hours Saved: ${totalHoursSaved}/week`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        shareToken: assessment.share_token,
        results: {
          analyses,
          executiveSummary,
          totalHoursSaved,
          aiReadinessScore: avgReadiness,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-public-ai-readiness:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
