import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackPattern {
  pattern_type: string;
  pattern_description: string;
  frequency: number;
  example_feedback: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all feedback from the last 30 days that hasn't been processed
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: feedback, error: feedbackError } = await supabase
      .from('sales_coach_feedback')
      .select('*, profiles(full_name)')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (feedbackError) throw feedbackError;

    if (!feedback || feedback.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No feedback to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${feedback.length} feedback items`);

    // Group feedback by company
    const feedbackByCompany = feedback.reduce((acc: Record<string, any[]>, item: any) => {
      const companyId = item.company_id;
      if (!acc[companyId]) acc[companyId] = [];
      acc[companyId].push(item);
      return acc;
    }, {});

    // Process each company's feedback
    for (const [companyId, companyFeedback] of Object.entries(feedbackByCompany)) {
      const positiveFeedback = (companyFeedback as any[]).filter(f => f.rating === 'up');
      const negativeFeedback = (companyFeedback as any[]).filter(f => f.rating === 'down');

      // Only analyze if there's meaningful feedback
      if ((companyFeedback as any[]).length < 3) continue;

      // Build analysis prompt
      const feedbackSummary = (companyFeedback as any[]).map(f => ({
        rating: f.rating,
        text: f.feedback_text,
        type: f.recommendation_type,
        context: f.context_snapshot?.message_preview?.slice(0, 200),
      }));

      const prompt = `Analyze this sales coaching feedback and identify patterns:

FEEDBACK (${feedbackSummary.length} items):
${JSON.stringify(feedbackSummary, null, 2)}

POSITIVE COUNT: ${positiveFeedback.length}
NEGATIVE COUNT: ${negativeFeedback.length}

Identify:
1. What types of responses do users LIKE? (positive patterns)
2. What types of responses do users DISLIKE? (negative patterns)
3. What specific improvements are users requesting?
4. Any data accuracy issues mentioned?
5. Feature requests or capability gaps?

Respond with JSON:
{
  "patterns": [
    {
      "pattern_type": "positive" | "negative" | "improvement_request" | "data_issue" | "feature_request",
      "pattern_key": "snake_case_key_for_this_pattern",
      "description": "What users like/dislike",
      "frequency": "how often this appears (low/medium/high)",
      "actionable_insight": "How Jericho should adapt",
      "example_quotes": ["direct quotes from feedback"]
    }
  ],
  "recommended_prompt_adjustments": [
    "Specific instruction to add to Jericho's system prompt"
  ]
}`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a data analyst specializing in sales coaching feedback analysis. Extract actionable patterns from user feedback.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        console.error('AI error:', await response.text());
        continue;
      }

      const aiData = await response.json();
      const analysisText = aiData.choices?.[0]?.message?.content || '{}';
      
      let analysis;
      try {
        analysis = JSON.parse(analysisText);
      } catch (e) {
        console.error('Failed to parse analysis:', analysisText);
        continue;
      }

      console.log(`Analysis for company ${companyId}:`, analysis);

      // Upsert learning patterns
      if (analysis.patterns) {
        for (const pattern of analysis.patterns) {
          const { error: upsertError } = await supabase
            .from('sales_coach_learning')
            .upsert({
              company_id: companyId,
              pattern_key: pattern.pattern_key || pattern.pattern_type,
              pattern_type: pattern.pattern_type,
              pattern_description: pattern.description,
              actionable_insight: pattern.actionable_insight,
              frequency: pattern.frequency,
              example_quotes: pattern.example_quotes || [],
              feedback_count: (companyFeedback as any[]).length,
              last_analyzed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,pattern_key',
            });

          if (upsertError) {
            console.error('Error upserting pattern:', upsertError);
          }
        }
      }

      // Store recommended prompt adjustments
      if (analysis.recommended_prompt_adjustments?.length > 0) {
        const { error: adjustError } = await supabase
          .from('sales_coach_learning')
          .upsert({
            company_id: companyId,
            pattern_key: 'prompt_adjustments',
            pattern_type: 'system_config',
            pattern_description: 'AI-recommended prompt adjustments',
            actionable_insight: analysis.recommended_prompt_adjustments.join('\n'),
            frequency: 'ongoing',
            feedback_count: (companyFeedback as any[]).length,
            last_analyzed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'company_id,pattern_key',
          });

        if (adjustError) {
          console.error('Error storing adjustments:', adjustError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        companiesProcessed: Object.keys(feedbackByCompany).length,
        totalFeedback: feedback.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in aggregate-sales-learnings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
