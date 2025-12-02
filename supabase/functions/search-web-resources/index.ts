import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  capabilityName: string;
  platforms: string[];
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
  content_type: string;
  source: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capabilityName, platforms } = await req.json() as SearchRequest;
    
    if (!capabilityName) {
      return new Response(
        JSON.stringify({ error: 'Capability name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Perplexity API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build platform-specific search queries
    const platformQueries: { [key: string]: string } = {
      youtube: `best ${capabilityName} training videos YouTube 2024 2025`,
      podcasts: `${capabilityName} podcast episodes professional development`,
      articles: `${capabilityName} articles guides blog posts professional skills`,
      courses: `${capabilityName} online course coursera udemy linkedin learning`,
    };

    const selectedPlatforms = platforms.length > 0 ? platforms : ['youtube', 'podcasts', 'articles', 'courses'];
    const searchQueries = selectedPlatforms.map(p => platformQueries[p] || `${capabilityName} learning resources`);
    const combinedQuery = `Find the best learning resources for "${capabilityName}" including: ${searchQueries.join('. ')}. Return specific URLs with titles and descriptions.`;

    console.log('Searching for resources:', { capabilityName, platforms: selectedPlatforms });

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: `You are a learning resource curator. Search the web and return REAL, SPECIFIC learning resources with valid URLs. 
            
For each resource found, return it in this exact JSON format:
{
  "resources": [
    {
      "title": "Exact title of the resource",
      "url": "Full URL starting with https://",
      "description": "Brief 1-2 sentence description of what it covers",
      "content_type": "video|podcast|article|course|book",
      "source": "Platform name (YouTube, Spotify, Coursera, etc.)"
    }
  ]
}

IMPORTANT:
- Only return REAL resources with VALID URLs that actually exist
- Include a mix of content types when available
- Prioritize high-quality, reputable sources
- Return 8-12 resources maximum
- URLs must be complete and working`
          },
          {
            role: 'user',
            content: combinedQuery
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        return_images: false,
        return_related_questions: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to search for resources', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('Perplexity response:', content.substring(0, 500));

    // Parse the JSON response
    let resources: SearchResult[] = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*"resources"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        resources = parsed.resources || [];
      } else {
        // Try to parse the whole content as JSON
        const parsed = JSON.parse(content);
        resources = parsed.resources || [];
      }
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      // Try to extract resources from text
      const urlPattern = /https?:\/\/[^\s\)\"]+/g;
      const urls = content.match(urlPattern) || [];
      resources = urls.slice(0, 10).map((url: string) => ({
        title: url.includes('youtube') ? 'YouTube Video' : 
               url.includes('spotify') ? 'Podcast Episode' :
               url.includes('coursera') || url.includes('udemy') ? 'Online Course' : 'Learning Resource',
        url: url,
        description: `Resource about ${capabilityName}`,
        content_type: url.includes('youtube') ? 'video' : 
                      url.includes('spotify') || url.includes('podcast') ? 'podcast' :
                      url.includes('coursera') || url.includes('udemy') ? 'course' : 'article',
        source: new URL(url).hostname.replace('www.', ''),
      }));
    }

    // Validate URLs
    const validatedResources = await Promise.all(
      resources.map(async (resource: SearchResult) => {
        try {
          const urlCheck = await fetch(resource.url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });
          return {
            ...resource,
            isValid: urlCheck.ok,
          };
        } catch {
          return {
            ...resource,
            isValid: false,
          };
        }
      })
    );

    const validResources = validatedResources.filter(r => r.isValid);

    console.log(`Found ${resources.length} resources, ${validResources.length} validated`);

    return new Response(
      JSON.stringify({ 
        resources: validResources,
        capability: capabilityName,
        totalFound: resources.length,
        validCount: validResources.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-web-resources:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
