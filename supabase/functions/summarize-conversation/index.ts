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
    const { conversationId } = await req.json();
    
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Summarizing conversation:', conversationId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get conversation and messages
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*, profiles(full_name)')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if summary already exists
    const { data: existingSummary } = await supabase
      .from('conversation_summaries')
      .select('id')
      .eq('conversation_id', conversationId)
      .single();

    if (existingSummary) {
      console.log('Summary already exists, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'Summary already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length < 2) {
      console.log('Not enough messages to summarize');
      return new Response(
        JSON.stringify({ success: true, message: 'Not enough messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing insights to avoid duplicates
    const { data: existingInsights } = await supabase
      .from('coaching_insights')
      .select('insight_text, insight_type')
      .eq('profile_id', conversation.profile_id)
      .eq('is_active', true);

    const existingInsightTexts = (existingInsights || []).map(i => i.insight_text.toLowerCase());

    // Build conversation transcript
    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

    const systemPrompt = `You are an expert coaching analyst. Analyze this conversation between a user and their AI coach Jericho.

Your task:
1. Create a 2-3 sentence summary of what was discussed
2. Identify key topics (as an array of short labels)
3. Extract any action items or commitments made
4. Assess the user's emotional tone during this conversation
5. Determine if follow-up is needed and what the topic should be
6. Extract any coaching insights worth remembering long-term

INSIGHT TYPES (choose the most appropriate):
- personality_trait: Enduring personality characteristics (e.g., "Tends to be overly self-critical")
- strength: Clear strengths they demonstrate (e.g., "Strong at building relationships")
- growth_area: Areas where they struggle (e.g., "Difficulty with time management")
- life_event: Major life events mentioned (e.g., "Recently had a baby")
- coaching_note: Coaching observations (e.g., "Responds well to direct feedback")
- commitment: Specific commitments made (e.g., "Committed to daily journaling")
- blocker: Things blocking their progress (e.g., "Manager doesn't support growth goals")
- preference: Personal preferences (e.g., "Prefers morning meetings")
- relationship: Important relationships mentioned (e.g., "Close mentor relationship with VP of Engineering")

ALREADY KNOWN INSIGHTS (don't duplicate):
${existingInsightTexts.slice(0, 20).join('\n')}

EMOTIONAL TONES:
- stressed: Showing signs of overwhelm or anxiety
- neutral: Calm, matter-of-fact discussion
- energized: Excited, motivated, positive
- uncertain: Unsure, seeking guidance
- frustrated: Annoyed or blocked
- motivated: Ready to take action
- reflective: Thoughtful, introspective

Respond with valid JSON only:
{
  "summary": "2-3 sentence summary",
  "key_topics": ["topic1", "topic2"],
  "action_items": [{"item": "what they committed to", "due_context": "when/context"}],
  "emotional_tone": "one of the tone options",
  "follow_up_needed": true/false,
  "follow_up_topic": "what to follow up on (if needed)",
  "follow_up_days": 3,
  "new_insights": [
    {
      "type": "insight_type",
      "text": "the insight",
      "confidence": "low/medium/high"
    }
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this conversation:\n\n${transcript}` }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      throw new Error('AI summarization failed');
    }

    const aiData = await response.json();
    const analysisText = aiData.choices?.[0]?.message?.content || '{}';
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse AI response:', analysisText);
      throw new Error('Failed to parse analysis');
    }

    console.log('Analysis result:', analysis);

    // Save conversation summary
    const followUpDate = analysis.follow_up_needed && analysis.follow_up_days
      ? new Date(Date.now() + analysis.follow_up_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: summaryError } = await supabase
      .from('conversation_summaries')
      .insert({
        conversation_id: conversationId,
        profile_id: conversation.profile_id,
        summary_text: analysis.summary || 'Conversation with Jericho',
        key_topics: analysis.key_topics || [],
        action_items: analysis.action_items || [],
        emotional_tone: analysis.emotional_tone || 'neutral',
        follow_up_needed: analysis.follow_up_needed || false,
        follow_up_topic: analysis.follow_up_topic || null,
        follow_up_scheduled_for: followUpDate,
      });

    if (summaryError) {
      console.error('Error saving summary:', summaryError);
    }

    // Save new coaching insights
    if (analysis.new_insights && analysis.new_insights.length > 0) {
      for (const insight of analysis.new_insights) {
        // Check if similar insight already exists
        const normalizedText = insight.text.toLowerCase();
        if (existingInsightTexts.some(t => t.includes(normalizedText) || normalizedText.includes(t))) {
          console.log('Skipping duplicate insight:', insight.text);
          continue;
        }

        const { error: insightError } = await supabase
          .from('coaching_insights')
          .insert({
            profile_id: conversation.profile_id,
            company_id: conversation.company_id,
            insight_type: insight.type,
            insight_text: insight.text,
            source_conversation_id: conversationId,
            confidence_level: insight.confidence || 'medium',
          });

        if (insightError) {
          console.error('Error saving insight:', insightError);
        } else {
          console.log('Saved insight:', insight.text);
        }
      }
    }

    // Create follow-up if needed
    if (analysis.follow_up_needed && analysis.follow_up_topic && followUpDate) {
      const { error: followUpError } = await supabase
        .from('coaching_follow_ups')
        .insert({
          profile_id: conversation.profile_id,
          conversation_id: conversationId,
          follow_up_type: 'general_check_in',
          scheduled_for: followUpDate,
          context: {
            topic: analysis.follow_up_topic,
            from_conversation: conversationId,
            action_items: analysis.action_items,
          },
          channel: 'podcast', // Default to podcast for natural follow-up
        });

      if (followUpError) {
        console.error('Error creating follow-up:', followUpError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: analysis.summary,
        insightsExtracted: analysis.new_insights?.length || 0,
        followUpScheduled: !!followUpDate
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in summarize-conversation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
