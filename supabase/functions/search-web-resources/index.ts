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
  pricing_type?: 'free' | 'paid' | 'subscription' | 'freemium' | 'unknown';
  pricing_label?: string;
}

// Pricing classification by domain
const domainPricing: { [key: string]: { type: 'free' | 'paid' | 'subscription' | 'freemium', label: string } } = {
  'youtube.com': { type: 'free', label: 'Free' },
  'youtu.be': { type: 'free', label: 'Free' },
  'spotify.com': { type: 'free', label: 'Free' },
  'apple.com': { type: 'free', label: 'Free' },
  'podcasts.google.com': { type: 'free', label: 'Free' },
  'listennotes.com': { type: 'free', label: 'Free' },
  'overcast.fm': { type: 'free', label: 'Free' },
  'pocketcasts.com': { type: 'free', label: 'Free' },
  'anchor.fm': { type: 'free', label: 'Free' },
  'medium.com': { type: 'freemium', label: 'Some Paywalled' },
  'hbr.org': { type: 'freemium', label: 'Some Paywalled' },
  'forbes.com': { type: 'free', label: 'Free' },
  'inc.com': { type: 'free', label: 'Free' },
  'entrepreneur.com': { type: 'free', label: 'Free' },
  'fastcompany.com': { type: 'free', label: 'Free' },
  'businessinsider.com': { type: 'freemium', label: 'Some Paywalled' },
  'mckinsey.com': { type: 'free', label: 'Free' },
  'coursera.org': { type: 'freemium', label: 'Audit Free' },
  'edx.org': { type: 'freemium', label: 'Audit Free' },
  'udemy.com': { type: 'paid', label: 'Paid Course' },
  'linkedin.com': { type: 'subscription', label: 'Subscription' },
  'skillshare.com': { type: 'subscription', label: 'Subscription' },
  'pluralsight.com': { type: 'subscription', label: 'Subscription' },
  'masterclass.com': { type: 'subscription', label: 'Subscription' },
};

// Get pricing info from URL
function getPricingInfo(url: string): { type: 'free' | 'paid' | 'subscription' | 'freemium' | 'unknown', label: string } {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [domain, pricing] of Object.entries(domainPricing)) {
      if (hostname.includes(domain)) return pricing;
    }
  } catch {}
  return { type: 'unknown', label: 'Unknown' };
}

// Platform-specific domain filters
const platformDomains: { [key: string]: string[] } = {
  youtube: ['youtube.com', 'youtu.be'],
  podcasts: ['spotify.com', 'apple.com', 'podcasts.google.com', 'overcast.fm', 'pocketcasts.com', 'stitcher.com', 'podbean.com', 'buzzsprout.com', 'anchor.fm', 'listennotes.com', 'podcast'],
  articles: ['medium.com', 'hbr.org', 'forbes.com', 'inc.com', 'entrepreneur.com', 'fastcompany.com', 'businessinsider.com', 'mckinsey.com', 'blog'],
  courses: ['coursera.org', 'udemy.com', 'linkedin.com/learning', 'skillshare.com', 'edx.org', 'pluralsight.com', 'masterclass.com'],
};

// Platform-specific content type labels
const platformContentTypes: { [key: string]: string } = {
  youtube: 'video',
  podcasts: 'podcast',
  articles: 'article',
  courses: 'course',
};

// Platform-specific search queries
function buildPlatformQuery(capabilityName: string, platform: string): string {
  switch (platform) {
    case 'youtube':
      return `"${capabilityName}" tutorial OR training OR guide video site:youtube.com`;
    case 'podcasts':
      return `"${capabilityName}" podcast episode site:spotify.com OR site:apple.com/podcast OR site:listennotes.com`;
    case 'articles':
      return `"${capabilityName}" article OR guide OR insights site:hbr.org OR site:medium.com OR site:forbes.com OR site:mckinsey.com`;
    case 'courses':
      return `"${capabilityName}" online course site:coursera.org OR site:udemy.com OR site:linkedin.com/learning OR site:edx.org`;
    default:
      return `"${capabilityName}" learning resources`;
  }
}

// Platform-specific system prompts
function buildSystemPrompt(platform: string, domains: string[]): string {
  const contentType = platformContentTypes[platform] || 'resource';
  const domainList = domains.join(', ');
  
  return `You are a learning resource curator specializing in ${contentType}s. Search the web and return REAL, SPECIFIC ${contentType} resources with valid URLs.

CRITICAL RULES:
1. You must ONLY return ${contentType} content
2. Every URL MUST be from one of these domains: ${domainList}
3. Do NOT include any other content types - ONLY ${contentType}s
4. If you cannot find ${contentType}s, return an empty resources array

For each resource found, return it in this exact JSON format:
{
  "resources": [
    {
      "title": "Exact title of the ${contentType}",
      "url": "Full URL starting with https://",
      "description": "Brief 1-2 sentence description",
      "content_type": "${contentType}",
      "source": "Platform name"
    }
  ]
}

Return 5-8 high-quality ${contentType}s maximum. URLs must be complete and working.`;
}

// Check if URL matches platform domains
function urlMatchesPlatform(url: string, platform: string): boolean {
  const domains = platformDomains[platform] || [];
  try {
    const urlObj = new URL(url);
    return domains.some(domain => 
      urlObj.hostname.includes(domain) || url.toLowerCase().includes(domain)
    );
  } catch {
    return false;
  }
}

// Get content type from URL
function getContentTypeFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'video';
  if (lowerUrl.includes('spotify.com') || lowerUrl.includes('apple.com/podcast') || lowerUrl.includes('podcast')) return 'podcast';
  if (lowerUrl.includes('coursera') || lowerUrl.includes('udemy') || lowerUrl.includes('linkedin.com/learning') || lowerUrl.includes('edx.org') || lowerUrl.includes('skillshare')) return 'course';
  return 'article';
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

    const selectedPlatforms = platforms.length > 0 ? platforms : ['youtube', 'podcasts', 'articles', 'courses'];
    
    console.log('Searching for resources:', { capabilityName, platforms: selectedPlatforms });

    // Search each platform separately for better filtering
    const allResources: SearchResult[] = [];
    
    for (const platform of selectedPlatforms) {
      const query = buildPlatformQuery(capabilityName, platform);
      const domains = platformDomains[platform] || [];
      const systemPrompt = buildSystemPrompt(platform, domains);
      
      console.log(`Searching ${platform}:`, query);

      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ],
            temperature: 0.1,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          console.error(`Perplexity API error for ${platform}:`, response.status);
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        
        console.log(`${platform} response:`, content.substring(0, 300));

        // Parse the JSON response
        let resources: SearchResult[] = [];
        try {
          const jsonMatch = content.match(/\{[\s\S]*"resources"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            resources = parsed.resources || [];
          }
        } catch (parseError) {
          console.error(`Failed to parse ${platform} response:`, parseError);
        }

        // Post-filter to ensure URLs match the platform
        const filteredResources = resources.filter(r => {
          const matches = urlMatchesPlatform(r.url, platform);
          if (!matches) {
            console.log(`Filtered out non-matching URL: ${r.url}`);
          }
          return matches;
        });

        // Ensure correct content type and add pricing info
        const typedResources = filteredResources.map(r => {
          const pricing = getPricingInfo(r.url);
          return {
            ...r,
            content_type: platformContentTypes[platform] || getContentTypeFromUrl(r.url),
            pricing_type: pricing.type,
            pricing_label: pricing.label,
          };
        });

        allResources.push(...typedResources);
        
        console.log(`${platform}: Found ${resources.length}, filtered to ${typedResources.length}`);
        
      } catch (platformError) {
        console.error(`Error searching ${platform}:`, platformError);
      }
    }

    // Remove duplicates by URL
    const uniqueResources = allResources.filter((resource, index, self) =>
      index === self.findIndex(r => r.url === resource.url)
    );

    console.log(`Total unique resources found: ${uniqueResources.length}`);

    return new Response(
      JSON.stringify({ 
        resources: uniqueResources,
        capability: capabilityName,
        totalFound: uniqueResources.length,
        validCount: uniqueResources.length,
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
