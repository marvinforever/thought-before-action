import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResourceRequest {
  capability_id: string;
  capability_name: string;
  description: string;
  level?: string;
}

interface ResearchedResource {
  title: string;
  description: string;
  url: string;
  content_type: 'book' | 'video' | 'podcast' | 'course';
  authors?: string; // Mapped from author_or_creator
  capability_name: string;
  estimated_time_minutes?: number; // Mapped from duration_minutes
  url_valid?: boolean;
}

async function validateUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return response.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capability_id, capability_name, description, level } = await req.json() as ResourceRequest;
    
    console.log(`Researching resources for capability: ${capability_name}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are a professional learning resource curator specializing in corporate training and professional development. Your task is to recommend high-quality, real learning resources that exist and can be verified.

CRITICAL REQUIREMENTS:
- Only recommend resources that actually exist with real, working URLs
- Prefer authoritative sources: O'Reilly, Coursera, LinkedIn Learning, reputable publishers
- For books: Include real Amazon URLs or publisher links
- For videos: Include real YouTube URLs from established channels
- For podcasts: Include real episode URLs from Spotify/Apple Podcasts
- For courses: Include real URLs from Coursera, Udemy, LinkedIn Learning, Pluralsight
- All URLs must be complete and functional (https://...)
- Provide accurate authors, creators, and publishers
- Match the capability level appropriately (foundational, advancing, independent, mastery)`;

    const userPrompt = `Research and recommend learning resources for the following capability:

Capability: ${capability_name}
Description: ${description}
${level ? `Target Level: ${level}` : ''}

Find:
- 4-5 highly-rated books with real Amazon or publisher URLs
- 4-5 quality YouTube videos or video courses with real URLs
- 3-4 relevant podcast episodes with real URLs
- 2-3 online courses from platforms like Coursera, Udemy, or LinkedIn Learning with real URLs

For each resource provide:
- Exact title
- Author/creator/channel name
- Brief description of what makes it valuable for this capability
- Real, working URL
- Estimated duration in minutes (for videos/podcasts/courses)
- Appropriate capability level (foundational/advancing/independent/mastery)`;

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
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'recommend_resources',
            description: 'Return structured learning resource recommendations',
            parameters: {
              type: 'object',
              properties: {
                resources: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      author_or_creator: { type: 'string' },
                      description: { type: 'string' },
                      url: { type: 'string' },
                      content_type: { type: 'string', enum: ['book', 'video', 'podcast', 'course'] },
                      duration_minutes: { type: 'number' },
                      capability_level: { type: 'string', enum: ['foundational', 'advancing', 'independent', 'mastery'] }
                    },
                    required: ['title', 'author_or_creator', 'description', 'url', 'content_type']
                  }
                }
              },
              required: ['resources']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'recommend_resources' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI API error', status: aiResponse.status, detail: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const resourcesData = JSON.parse(toolCall.function.arguments);
    // Map AI response fields to database schema
    const resources: ResearchedResource[] = resourcesData.resources.map((r: any) => ({
      title: r.title,
      description: r.description,
      url: r.url,
      content_type: r.content_type,
      authors: r.author_or_creator, // Map to schema field
      estimated_time_minutes: r.duration_minutes, // Map to schema field
      capability_name,
    }));

    console.log(`Found ${resources.length} resources, validating URLs...`);

    // Validate URLs in parallel (limit concurrency)
    const validationPromises = resources.map(async (resource) => {
      const isValid = await validateUrl(resource.url);
      return { ...resource, url_valid: isValid };
    });

    const validatedResources = await Promise.all(validationPromises);
    const validCount = validatedResources.filter(r => r.url_valid).length;
    
    console.log(`URL validation complete: ${validCount}/${validatedResources.length} valid`);

    return new Response(
      JSON.stringify({
        capability_id,
        capability_name,
        resources: validatedResources,
        stats: {
          total: validatedResources.length,
          valid_urls: validCount,
          invalid_urls: validatedResources.length - validCount,
          by_type: {
            book: validatedResources.filter(r => r.content_type === 'book').length,
            video: validatedResources.filter(r => r.content_type === 'video').length,
            podcast: validatedResources.filter(r => r.content_type === 'podcast').length,
            course: validatedResources.filter(r => r.content_type === 'course').length,
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in research-capability-resources:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
