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
    const { conversationId, profileId, companyId } = await req.json();
    
    if (!conversationId || !profileId) {
      return new Response(
        JSON.stringify({ error: 'conversationId and profileId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Summarizing sales session:', conversationId);

    // Get conversation messages
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError || !messages || messages.length < 2) {
      return new Response(
        JSON.stringify({ success: true, message: 'Not enough messages to summarize' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get any deals discussed
    const { data: recentDeals } = await supabase
      .from('sales_deals')
      .select('deal_name, stage, sales_companies(name)')
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false })
      .limit(5);

    // Get any customer insights extracted during this session
    const { data: sessionInsights } = await supabase
      .from('customer_insights')
      .select('*')
      .eq('source_conversation_id', conversationId);

    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const dealContext = recentDeals?.map(d => `${d.deal_name} (${d.stage})`).join(', ') || 'None mentioned';
    const insightContext = sessionInsights?.map(i => `${i.insight_type}: ${i.insight_text}`).join('\n') || 'None extracted';

    const prompt = `Summarize this sales coaching session and create actionable follow-ups.

CONVERSATION:
${transcript}

DEALS DISCUSSED: ${dealContext}
INSIGHTS EXTRACTED: ${insightContext}

Create a summary that helps the sales rep remember:
1. What customers/deals were discussed
2. Key decisions made or advice given
3. Action items the rep committed to
4. Topics to follow up on

Respond with JSON:
{
  "summary": "2-3 sentence summary of the session",
  "customers_discussed": ["Customer Name 1", "Customer Name 2"],
  "key_topics": ["topic1", "topic2"],
  "action_items": [
    {
      "task": "What they need to do",
      "customer": "Which customer (if applicable)",
      "due_context": "When or why (e.g., 'before meeting tomorrow')"
    }
  ],
  "follow_up_needed": true/false,
  "follow_up_topic": "What to follow up on (if needed)",
  "follow_up_days": 3,
  "session_rating": "productive" | "exploratory" | "data_lookup" | "problem_solving"
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
          { role: 'system', content: 'You are a sales coaching analyst. Summarize sales coaching sessions and extract actionable follow-ups.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error('AI error:', await response.text());
      throw new Error('AI summarization failed');
    }

    const aiData = await response.json();
    const summaryText = aiData.choices?.[0]?.message?.content || '{}';
    
    let summary;
    try {
      summary = JSON.parse(summaryText);
    } catch (e) {
      console.error('Failed to parse summary:', summaryText);
      throw new Error('Failed to parse summary');
    }

    console.log('Session summary:', summary);

    // Check if summary already exists
    const { data: existingSummary } = await supabase
      .from('conversation_summaries')
      .select('id')
      .eq('conversation_id', conversationId)
      .single();

    if (existingSummary) {
      // Update existing
      await supabase
        .from('conversation_summaries')
        .update({
          summary_text: summary.summary,
          key_topics: summary.key_topics || [],
          action_items: summary.action_items || [],
          follow_up_needed: summary.follow_up_needed || false,
          follow_up_topic: summary.follow_up_topic,
        })
        .eq('id', existingSummary.id);
    } else {
      // Create new summary
      const followUpDate = summary.follow_up_needed && summary.follow_up_days
        ? new Date(Date.now() + summary.follow_up_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await supabase
        .from('conversation_summaries')
        .insert({
          conversation_id: conversationId,
          profile_id: profileId,
          summary_text: summary.summary,
          key_topics: summary.key_topics || [],
          action_items: summary.action_items || [],
          emotional_tone: summary.session_rating || 'neutral',
          follow_up_needed: summary.follow_up_needed || false,
          follow_up_topic: summary.follow_up_topic,
          follow_up_scheduled_for: followUpDate,
        });
    }

    // Create follow-up if needed
    if (summary.follow_up_needed && summary.follow_up_topic) {
      const followUpDate = new Date(Date.now() + (summary.follow_up_days || 3) * 24 * 60 * 60 * 1000).toISOString();
      
      await supabase
        .from('coaching_follow_ups')
        .insert({
          profile_id: profileId,
          conversation_id: conversationId,
          follow_up_type: 'sales_check_in',
          scheduled_for: followUpDate,
          context: {
            topic: summary.follow_up_topic,
            customers: summary.customers_discussed,
            action_items: summary.action_items,
          },
          channel: 'chat',
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: summary.summary,
        actionItems: summary.action_items?.length || 0,
        followUpScheduled: summary.follow_up_needed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in summarize-sales-session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
