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
    const { content_type, source_content, source_url, source_name, source_author, domain_ids } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let systemPrompt = '';
    let userPrompt = '';

    if (content_type === 'original') {
      // Generate from transcript/internal content
      systemPrompt = `You are a content writer for Momentum Academy, a professional development and leadership training organization. 
Your task is to transform raw content (transcripts, notes, course materials) into polished, engaging articles.

Guidelines:
- Write in a warm, approachable but professional tone
- Use clear headings and subheadings
- Include actionable takeaways
- Keep paragraphs concise
- Target 800-1500 words
- Format in clean markdown`;

      userPrompt = `Transform this content into a Momentum Academy article:

${source_content}

Return JSON with:
{
  "title": "engaging article title",
  "summary": "2-3 sentence summary for preview cards",
  "content": "full article in markdown format",
  "reading_time_minutes": estimated reading time as number
}`;
    } else if (content_type === 'curated') {
      // Summarize external content
      systemPrompt = `You are a content curator for Momentum Academy. Your task is to summarize external articles/content while giving proper attribution to the original source.

Guidelines:
- Create a comprehensive summary (300-500 words)
- Highlight key insights and takeaways
- Maintain the original author's intent
- Add context for how this applies to professional development
- Format in clean markdown`;

      userPrompt = `Summarize this external content for Momentum Academy readers:

Source: ${source_name || 'External Source'}
Author: ${source_author || 'Unknown'}
URL: ${source_url || 'N/A'}

Content:
${source_content}

Return JSON with:
{
  "title": "summary title (can differ from original)",
  "summary": "1-2 sentence preview",
  "content": "full summary in markdown, ending with 'Originally published by [author] at [source]'",
  "reading_time_minutes": estimated reading time as number
}`;
    } else {
      throw new Error('Invalid content_type. Must be "original" or "curated"');
    }

    console.log('Calling Lovable AI to generate article...');

    const tools = [
      {
        type: "function",
        function: {
          name: "create_article",
          description: "Create a structured article with title, summary, and content",
          parameters: {
            type: "object",
            properties: {
              title: { 
                type: "string", 
                description: "Engaging article title" 
              },
              summary: { 
                type: "string", 
                description: "2-3 sentence summary for preview cards" 
              },
              content: { 
                type: "string", 
                description: "Full article content in markdown format" 
              },
              reading_time_minutes: { 
                type: "number", 
                description: "Estimated reading time in minutes" 
              }
            },
            required: ["title", "summary", "content", "reading_time_minutes"],
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
        tool_choice: { type: "function", function: { name: "create_article" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('AI response received:', JSON.stringify(aiData).substring(0, 500));

    // Extract from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_article') {
      console.error('No valid tool call in response:', aiData);
      throw new Error('AI did not return expected tool call');
    }

    const articleData = JSON.parse(toolCall.function.arguments);

    // Generate slug from title
    const slug = articleData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100) + '-' + Date.now().toString(36);

    // Insert article
    const { data: article, error: insertError } = await supabase
      .from('academy_articles')
      .insert({
        title: articleData.title,
        slug,
        summary: articleData.summary,
        content: articleData.content,
        content_type,
        source_url: source_url || null,
        source_name: source_name || null,
        source_author: source_author || null,
        reading_time_minutes: articleData.reading_time_minutes || 5,
        is_published: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to save article: ${insertError.message}`);
    }

    // Link to domains if provided
    if (domain_ids && domain_ids.length > 0) {
      const domainMappings = domain_ids.map((domain_id: string) => ({
        article_id: article.id,
        domain_id,
      }));

      const { error: domainError } = await supabase
        .from('academy_article_domains')
        .insert(domainMappings);

      if (domainError) {
        console.error('Domain mapping error:', domainError);
      }
    }

    console.log('Article created:', article.id);

    return new Response(JSON.stringify({ success: true, article }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
