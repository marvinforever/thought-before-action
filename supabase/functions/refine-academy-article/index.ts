import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { article_id, feedback, current_content, current_title, current_summary } = await req.json();

    if (!article_id || !feedback) {
      throw new Error('article_id and feedback are required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const systemPrompt = `You are Jericho, an AI editor for Momentum Academy articles. Your task is to refine and improve articles based on user feedback.

Guidelines:
- Carefully follow the user's editing instructions
- Maintain a warm, approachable but professional tone
- Keep the article structure clear with headings and subheadings
- Preserve the core message while making requested improvements
- If asked to shorten, be concise without losing key insights
- If asked to expand, add valuable detail without padding
- Format in clean markdown`;

    const userPrompt = `Here is the current article:

TITLE: ${current_title}

SUMMARY: ${current_summary}

CONTENT:
${current_content}

---

User feedback/editing instructions:
${feedback}

Please revise the article according to this feedback. If the feedback asks for title or summary changes, update those too.`;

    console.log('Calling Lovable AI to refine article...');

    const tools = [
      {
        type: "function",
        function: {
          name: "update_article",
          description: "Return the refined article with updated title, summary, and content",
          parameters: {
            type: "object",
            properties: {
              title: { 
                type: "string", 
                description: "Article title (updated if requested, otherwise keep original)" 
              },
              summary: { 
                type: "string", 
                description: "Article summary (updated if requested, otherwise keep original)" 
              },
              content: { 
                type: "string", 
                description: "Full refined article content in markdown format" 
              },
              reading_time_minutes: { 
                type: "number", 
                description: "Estimated reading time in minutes" 
              },
              changes_made: {
                type: "string",
                description: "Brief description of what changes were made"
              }
            },
            required: ["title", "summary", "content", "reading_time_minutes", "changes_made"],
            additionalProperties: false
          }
        }
      }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools,
        tool_choice: { type: "function", function: { name: "update_article" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('AI response received');

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'update_article') {
      console.error('No valid tool call in response:', aiData);
      throw new Error('AI did not return expected tool call');
    }

    const refinedData = JSON.parse(toolCall.function.arguments);

    // Update the article in the database
    const { data: article, error: updateError } = await supabase
      .from('academy_articles')
      .update({
        title: refinedData.title,
        summary: refinedData.summary,
        content: refinedData.content,
        reading_time_minutes: refinedData.reading_time_minutes || 5,
        updated_at: new Date().toISOString(),
      })
      .eq('id', article_id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error(`Failed to update article: ${updateError.message}`);
    }

    console.log('Article refined:', article.id);

    return new Response(JSON.stringify({ 
      success: true, 
      article,
      changes_made: refinedData.changes_made 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error refining article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
