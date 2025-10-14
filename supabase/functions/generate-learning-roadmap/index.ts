import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeId, companyId, triggerSource = 'manual' } = await req.json();
    console.log('Generating learning roadmap for employee:', employeeId, 'Trigger:', triggerSource);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: req.headers.get("Authorization")!,
        },
      },
    });

    // Fetch all relevant data
    console.log('Fetching employee data...');
    
    const [capabilitiesResult, goalsResult, targetsResult, habitsResult, resourcesResult, profileResult, jobDescResult, diagnosticResult] = await Promise.all([
      supabase
        .from('employee_capabilities')
        .select(`
          *,
          capabilities:capability_id (
            name,
            category,
            description
          )
        `)
        .eq('profile_id', employeeId),
      
      supabase
        .from('personal_goals')
        .select('*')
        .eq('profile_id', employeeId),
      
      supabase
        .from('ninety_day_targets')
        .select('*')
        .eq('profile_id', employeeId)
        .order('created_at', { ascending: false }),
      
      supabase
        .from('leading_indicators')
        .select('*')
        .eq('profile_id', employeeId)
        .eq('is_active', true),
      
      supabase
        .from('content_recommendations')
        .select(`
          *,
          resources:resource_id (
            title,
            content_type
          )
        `)
        .eq('profile_id', employeeId)
        .eq('status', 'completed'),
      
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', employeeId)
        .single(),
      
      supabase
        .from('job_descriptions')
        .select('title, description')
        .eq('profile_id', employeeId)
        .eq('is_current', true)
        .single(),
      
      supabase
        .from('diagnostic_responses')
        .select(`
          learning_preference,
          listens_to_podcasts,
          watches_youtube,
          reads_books_articles,
          needed_training,
          learning_motivation,
          burnout_frequency,
          mental_drain_frequency,
          daily_energy_level
        `)
        .eq('profile_id', employeeId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (capabilitiesResult.error) console.error('Capabilities error:', capabilitiesResult.error);
    if (goalsResult.error) console.error('Goals error:', goalsResult.error);
    if (targetsResult.error) console.error('Targets error:', targetsResult.error);

    const capabilities = capabilitiesResult.data || [];
    const goals = goalsResult.data || [];
    const targets = targetsResult.data || [];
    const habits = habitsResult.data || [];
    const completedResources = resourcesResult.data || [];
    const profile = profileResult.data;
    const jobDescription = jobDescResult.data;
    const diagnostic = diagnosticResult.data;

    // Build context for AI
    const capabilitiesContext = capabilities.map(cap => ({
      name: cap.capabilities?.name || 'Unknown',
      category: cap.capabilities?.category || 'Unknown',
      currentLevel: cap.current_level,
      targetLevel: cap.target_level,
      priority: cap.priority,
      reasoning: cap.ai_reasoning
    }));

    const oneYearGoal = goals.find(g => g.goal_type === 'one_year')?.goal_text || 'Not set';
    const threeYearGoal = goals.find(g => g.goal_type === 'three_year')?.goal_text || 'Not set';

    const activeTargets = targets.filter(t => !t.completed);
    const completedTargets = targets.filter(t => t.completed);

    const contextSnapshot = {
      capabilities: capabilitiesContext,
      oneYearGoal,
      threeYearGoal,
      activeTargets: activeTargets.length,
      completedTargets: completedTargets.length,
      activeHabits: habits.length,
      completedResources: completedResources.length,
      role: jobDescription?.title || 'Not specified',
      learningPreference: diagnostic?.learning_preference || 'Not specified',
      contentPreferences: {
        podcasts: diagnostic?.listens_to_podcasts || false,
        youtube: diagnostic?.watches_youtube || false,
        books: diagnostic?.reads_books_articles || false
      },
      burnoutIndicators: {
        burnoutFrequency: diagnostic?.burnout_frequency || 'Not specified',
        mentalDrain: diagnostic?.mental_drain_frequency || 'Not specified',
        energyLevel: diagnostic?.daily_energy_level || 'Not specified'
      }
    };

    console.log('Calling Lovable AI to generate roadmap...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are Jericho, a strategic learning advisor. You analyze employee development data and create personalized Strategic Growth Roadmaps. Always use "Jericho recommends" language, not "AI suggests". Be encouraging, strategic, and coach-like in tone.

CRITICAL: Your narrative must follow this exact three-part structure:
1. CURRENT STATE (2-3 sentences): Where they are now in their development journey
2. DESTINATION (1-2 sentences): Where they're headed based on their goals
3. PATH FORWARD (2-3 sentences): Specific actions and focus areas to bridge the gap

PERSONALIZATION REQUIREMENTS:
- Respect their learning preferences and content type preferences (podcasts, videos, books)
- Consider their energy levels and burnout indicators when suggesting timeline/intensity
- Address any specific training needs they identified in their diagnostic survey
- Adapt resource types to their stated learning style`
          },
          {
            role: 'user',
            content: `Analyze this employee's complete development picture and create a personalized Strategic Learning Roadmap.

Employee Context:
- Name: ${profile?.full_name || 'Unknown'}
- Role: ${jobDescription?.title || 'Not specified'}

Capability Gaps (${capabilities.length} total):
${capabilitiesContext.map(c => `  • ${c.name} (${c.category}): Currently ${c.currentLevel}, Target ${c.targetLevel}, Priority: ${c.priority || 'N/A'}`).join('\n')}

1-Year Vision: ${oneYearGoal}
3-Year Vision: ${threeYearGoal}

90-Day Targets:
Active Goals (${activeTargets.length}):
${activeTargets.slice(0, 5).map(t => `  • ${t.goal_text} (${t.category}, Due: ${t.by_when || 'No date'})`).join('\n')}

Recently Completed (${completedTargets.length}):
${completedTargets.slice(0, 3).map(t => `  • ${t.goal_text}`).join('\n')}

Active Habits: ${habits.length}
Completed Resources: ${completedResources.length}

Learning Profile (from Diagnostic Survey):
- Learning Preference: ${diagnostic?.learning_preference || 'Not specified'}
- Content Type Preferences: ${diagnostic?.listens_to_podcasts ? 'Podcasts' : ''}${diagnostic?.watches_youtube ? ', YouTube videos' : ''}${diagnostic?.reads_books_articles ? ', Books/Articles' : ''}
- Specific Training Needs: ${diagnostic?.needed_training || 'Not specified'}
- Learning Motivation: ${diagnostic?.learning_motivation || 'Not specified'}
- Energy/Burnout Indicators:
  * Burnout Frequency: ${diagnostic?.burnout_frequency || 'Not specified'}
  * Mental Drain: ${diagnostic?.mental_drain_frequency || 'Not specified'}
  * Daily Energy Level: ${diagnostic?.daily_energy_level || 'Not specified'}

Generate a strategic growth roadmap with:
1. NARRATIVE (must have clear structure):
   - CURRENT STATE: 2-3 sentences on where they are now (capabilities, progress, challenges)
   - DESTINATION: 1-2 sentences on where they're going (based on 1-year and 3-year goals)
   - PATH FORWARD: 2-3 sentences on what needs to happen to close the gap (priority focus areas and key milestones)
   
2. Priority Focus Areas (3-5 training topics - NOT specific resources)
   For each area provide:
   - topic: Training topic name (e.g., "Leadership Development", "Sales Methodology")
   - recommendation_type: One of ["free_resources", "external_training", "coaching", "jericho_coaching", "manager_mentorship"]
   - reasoning: How this closes gaps and aligns with their goals (2-3 sentences)
   - investment_level: One of ["free", "low", "medium", "high"]
   - timeline: One of ["immediate", "next_quarter", "6_months"]
   - suggested_resources: Array of 2-3 specific resource types (e.g., ["Executive coaching sessions", "Jericho career coaching chat"])
3. Quick Wins (1-2 things they can start today using free resources)
4. Long-term Investments (1-2 high-value training programs for 6+ months out)

Return ONLY valid JSON in this exact format:
{
  "narrative": "CURRENT STATE: [Where they are now - their current capabilities, recent progress, and development stage]. DESTINATION: [Where they're headed - their 1-year and 3-year vision]. PATH FORWARD: [What needs to happen - priority focus areas, key milestones, and approach to close the gap].",
  "focus_areas": [
    {
      "topic": "Strategic Thinking",
      "recommendation_type": "coaching",
      "reasoning": "Your 1-year goal mentions...",
      "investment_level": "high",
      "timeline": "next_quarter",
      "suggested_resources": ["Executive coaching", "Jericho career coaching"]
    }
  ],
  "quick_wins": [
    {
      "action": "Start tracking daily strategic decisions",
      "reasoning": "Builds awareness of your current thinking patterns"
    }
  ],
  "long_term": [
    {
      "investment": "Enroll in Strategic Leadership Program",
      "reasoning": "Positions you for senior leadership role in your 3-year vision",
      "timeline": "6_months"
    }
  ]
}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content returned from AI');
    }

    console.log('AI response received, parsing...');
    
    // Parse the JSON response
    let roadmapData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : aiContent;
      roadmapData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('AI content:', aiContent);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Check if a roadmap already exists for this user
    const { data: existingRoadmap } = await supabase
      .from('learning_roadmaps')
      .select('id')
      .eq('profile_id', employeeId)
      .single();

    if (existingRoadmap) {
      // Update existing roadmap
      const { error: updateError } = await supabase
        .from('learning_roadmaps')
        .update({
          roadmap_data: roadmapData,
          context_snapshot: contextSnapshot,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existingRoadmap.id);

      if (updateError) {
        console.error('Error updating roadmap:', updateError);
        throw updateError;
      }

      console.log('Roadmap updated successfully');
    } else {
      // Insert new roadmap
      const { error: insertError } = await supabase
        .from('learning_roadmaps')
        .insert({
          profile_id: employeeId,
          company_id: companyId,
          roadmap_data: roadmapData,
          context_snapshot: contextSnapshot,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (insertError) {
        console.error('Error inserting roadmap:', insertError);
        throw insertError;
      }

      console.log('Roadmap created successfully');
    }

    return new Response(
      JSON.stringify({
        success: true,
        roadmap: roadmapData,
        triggerSource,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error('Error in generate-learning-roadmap function:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'An error occurred generating the learning roadmap',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});