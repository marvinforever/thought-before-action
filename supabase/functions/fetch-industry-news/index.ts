import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  relevanceTag: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry, keywords, capabilityFocus } = await req.json();

    if (!industry) {
      throw new Error('industry is required');
    }

    console.log(`Fetching industry news for: ${industry}, keywords: ${keywords}, capability: ${capabilityFocus}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Check cache first
    const { data: cached } = await supabase
      .from('daily_industry_news')
      .select('news_items')
      .eq('industry', industry)
      .eq('news_date', today)
      .single();

    if (cached?.news_items) {
      console.log(`Returning cached news for ${industry}`);
      return new Response(
        JSON.stringify({ success: true, newsItems: cached.news_items, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no Perplexity API key, return empty
    if (!perplexityApiKey) {
      console.log('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: true, newsItems: [], error: 'News service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search query
    const keywordsStr = Array.isArray(keywords) ? keywords.slice(0, 5).join(' ') : '';
    const currentDate = new Date();
    const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Format industry name for search
    const industryName = industry.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    
    const searchQuery = `${industryName} industry news ${keywordsStr} ${monthYear}`;
    console.log(`Perplexity search query: ${searchQuery}`);

    // Call Perplexity API
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a professional industry news analyst. Your job is to find and summarize the most relevant recent news for professionals in the ${industryName} industry. Focus on news that would help someone grow professionally and stay informed about their industry.

Return your response as a JSON array with exactly 3 news items in this format:
[
  {
    "headline": "Short, compelling headline (max 80 chars)",
    "summary": "1-2 sentence summary of the news and its significance (max 150 chars)",
    "source": "Publication or source name"
  }
]

ONLY return the JSON array, no other text.`
          },
          {
            role: 'user',
            content: `Find 3 recent news headlines and brief summaries relevant to the ${industryName} industry. Focus on: ${keywordsStr || 'industry trends, market updates, and professional development'}. Only include news from the past week.`
          }
        ],
        search_recency_filter: 'week',
        max_tokens: 800,
        temperature: 0.2
      })
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('Perplexity API error:', perplexityResponse.status, errorText);
      throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
    }

    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in Perplexity response');
      return new Response(
        JSON.stringify({ success: true, newsItems: [], error: 'No news found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response
    let newsItems: NewsItem[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        newsItems = parsed.slice(0, 3).map((item: any) => ({
          headline: String(item.headline || '').substring(0, 100),
          summary: String(item.summary || '').substring(0, 200),
          source: String(item.source || 'News').substring(0, 50),
          relevanceTag: capabilityFocus ? `Related to: ${capabilityFocus}` : null
        }));
      }
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', parseError);
      console.log('Raw content:', content);
    }

    console.log(`Found ${newsItems.length} news items`);

    // Cache the results
    if (newsItems.length > 0) {
      const { error: cacheError } = await supabase
        .from('daily_industry_news')
        .upsert({
          industry,
          news_date: today,
          news_items: newsItems,
          capability_context: capabilityFocus || null
        }, { onConflict: 'industry,news_date' });

      if (cacheError) {
        console.error('Failed to cache news:', cacheError);
      } else {
        console.log('News cached successfully');
      }
    }

    return new Response(
      JSON.stringify({ success: true, newsItems, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching industry news:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, newsItems: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
