import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeId, companyId, triggerSource } = await req.json();

    // Client for reading data (uses user's auth)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Admin client for inserting recommendations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch employee capabilities with gaps
    const { data: capabilities, error: capError } = await supabaseClient
      .from('employee_capabilities')
      .select(`
        id,
        current_level,
        target_level,
        priority,
        capability:capabilities(
          id,
          name,
          category,
          description
        )
      `)
      .eq('profile_id', employeeId)
      .order('priority', { ascending: true });

    if (capError) throw capError;

    // Fetch personal goals
    const { data: goals, error: goalsError } = await supabaseClient
      .from('personal_goals')
      .select('one_year_vision, three_year_vision')
      .eq('profile_id', employeeId)
      .maybeSingle();

    if (goalsError && goalsError.code !== 'PGRST116') throw goalsError;

    // Fetch 90-day targets
    const { data: targets, error: targetsError } = await supabaseClient
      .from('ninety_day_targets')
      .select('goal_text, category')
      .eq('profile_id', employeeId)
      .not('goal_text', 'is', null);

    if (targetsError) throw targetsError;

    // Fetch diagnostic response for learning preferences
    const { data: diagnostic, error: diagnosticError } = await supabaseClient
      .from('diagnostic_responses')
      .select(`
        learning_preference,
        listens_to_podcasts,
        watches_youtube,
        reads_books_articles,
        needed_training,
        learning_motivation
      `)
      .eq('profile_id', employeeId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (diagnosticError && diagnosticError.code !== 'PGRST116') throw diagnosticError;

    // Build context for AI
    const capabilitiesContext = capabilities.map(cap => ({
      name: cap.capability?.name,
      category: cap.capability?.category,
      current: cap.current_level,
      target: cap.target_level,
      gap: `${cap.current_level} → ${cap.target_level}`,
    })) || [];

    const goalsContext = {
      oneYear: goals?.one_year_vision || null,
      threeYear: goals?.three_year_vision || null,
      quarterlyGoals: targets?.map(t => t.goal_text) || [],
    };

    // Fetch existing recommendations to avoid duplicates and expired ones
    const { data: existingRecs } = await supabaseClient
      .from('content_recommendations')
      .select('resource_id, status, expires_at')
      .eq('profile_id', employeeId);

    // Get IDs of completed resources and non-expired active recommendations
    const completedResourceIds = new Set(
      existingRecs?.filter(r => r.status === 'completed').map(r => r.resource_id) || []
    );
    const activeRecommendedIds = new Set(
      existingRecs?.filter(r => 
        r.status !== 'completed' && 
        (!r.expires_at || new Date(r.expires_at) > new Date())
      ).map(r => r.resource_id) || []
    );

    // Fetch available resources with their capabilities via junction table
    const excludeIds = [...completedResourceIds, ...activeRecommendedIds];
    
    let resourceQuery = supabaseClient
      .from('resources')
      .select(`
        id,
        title,
        description,
        capability_level,
        content_type,
        rating,
        resource_capabilities!inner(
          capability:capabilities(
            id,
            name,
            category
          )
        )
      `)
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    // Only add the exclusion filter if there are IDs to exclude
    if (excludeIds.length > 0) {
      resourceQuery = resourceQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }
    
    const { data: resourcesWithCaps, error: resourcesError } = await resourceQuery;

    if (resourcesError) throw resourcesError;

    // Transform to include capability info for AI
    const allResources = resourcesWithCaps?.map(resource => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      capability_level: resource.capability_level,
      content_type: resource.content_type,
      rating: resource.rating,
      capabilities: resource.resource_capabilities.map((rc: any) => ({
        id: rc.capability.id,
        name: rc.capability.name,
        category: rc.capability.category,
      }))
    })) || [];

    if (resourcesError) throw resourcesError;

    // Use AI to analyze and recommend
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You are Jericho, a proactive leadership development coach. Your recommendations prevent problems before they cost companies talent and productivity.
    
    YOUR MISSION: Recommend resources that help employees build a clear 3-year growth path that makes other opportunities look less appealing.
    
    Your task is to recommend 3-5 highly relevant learning resources based on:
    1. Their current and target capabilities (showing the path from where they are to where they want to be)
    2. Their personal goals (1-year vision, 3-year vision, 90-day targets) - THIS IS CRITICAL FOR RETENTION
    3. Their learning preferences and available time (from diagnostic survey)
    4. Available learning resources in our library (articles, videos, podcasts, courses, books, mentorship)
    
    PERSONALIZATION REQUIREMENTS (from Diagnostic Survey):
    - Prioritize content types that match their preferences (podcasts, YouTube, books/articles)
    - Address specific training needs they identified in their diagnostic
    - Consider their learning motivation and style
    
    For each recommendation:
    - Choose resources that DIRECTLY address their capability gaps AND move them toward their 1-year/3-year vision
    - Match the content type to their stated preferences
    - Prioritize resources that build confidence and career clarity (retention factors)
    - Explain WHY THIS MATTERS for their growth journey and career goals
    - Connect the resource explicitly to their retention: "Building this skill makes you more valuable and confident in your role"
    
    DIVERSIFY content types based on their preferences:
    - Quick wins: YouTube videos, podcast episodes (15-30 min) - prioritize if they prefer these
    - Skill building: Online courses, books (1-4 weeks)
    - Deep expertise: Books, mentorship programs (1-3 months) - for deep learning preferences
    
    Return your recommendations as a JSON array with this structure:
    [
      {
        "resource_id": "uuid-of-resource",
        "employee_capability_id": "uuid-or-null",
        "match_score": 95,
        "reasoning": "WHY THIS MATTERS: This resource helps you close the gap toward [their 1-year vision]. It develops [specific capability] from [current level] to [target level], which is essential for [their stated goal]. This [content type] format matches your learning preference. Building this skill makes you more valuable and positions you for [next career step]."
      }
    ]
    
    Keep reasoning specific, vision-focused, and personalized to their learning style. Every recommendation should answer: "How does this move me toward my goals AND fit my learning preferences?"`;

    const userPrompt = `Employee Context:
Capabilities: ${JSON.stringify(capabilitiesContext, null, 2)}

Goals:
- 1-Year Vision: ${goalsContext.oneYear || 'Not set'}
- 3-Year Vision: ${goalsContext.threeYear || 'Not set'}
- 90-Day Goals: ${goalsContext.quarterlyGoals.join(', ') || 'None set'}

Learning Profile (from Diagnostic Survey):
- Learning Preference: ${diagnostic?.learning_preference || 'Not specified'}
- Content Preferences: ${diagnostic?.listens_to_podcasts ? 'Podcasts' : ''}${diagnostic?.watches_youtube ? ', YouTube' : ''}${diagnostic?.reads_books_articles ? ', Books/Articles' : ''}
- Specific Training Needs: ${diagnostic?.needed_training || 'Not specified'}
- Learning Motivation: ${diagnostic?.learning_motivation || 'Not specified'}

Available Resources:
${JSON.stringify(allResources, null, 2)}

Employee Capabilities IDs for reference:
${JSON.stringify(capabilities?.map(c => ({ id: c.id, capability: c.capability.name })), null, 2)}

Provide recommendations now, ensuring they match the employee's learning preferences:`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) throw new Error('No AI response received');

    // Parse AI response
    let recommendations;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      recommendations = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    // Insert recommendations into database with 45-day expiration
    const recommendationsToInsert = recommendations.map((rec: any) => {
      const sentAt = new Date();
      const expiresAt = new Date(sentAt);
      expiresAt.setDate(expiresAt.getDate() + 45); // 45 days expiration

      return {
        profile_id: employeeId,
        resource_id: rec.resource_id,
        employee_capability_id: rec.employee_capability_id || null,
        match_score: rec.match_score,
        ai_reasoning: rec.reasoning,
        status: 'pending',
        sent_at: sentAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      };
    });

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('content_recommendations')
      .insert(recommendationsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting recommendations:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: inserted?.length || 0,
        recommendations: inserted,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in recommend-resources:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
