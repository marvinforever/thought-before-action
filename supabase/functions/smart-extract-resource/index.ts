import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractRequest {
  urls: string[];
  companyId: string;
}

interface ResourceMetadata {
  url: string;
  title: string;
  description: string;
  content_type: 'video' | 'book' | 'article' | 'podcast' | 'course';
  thumbnail_url?: string;
  author?: string;
  duration_minutes?: number;
  is_valid: boolean;
  is_duplicate: boolean;
  existing_resource_id?: string;
  error?: string;
  suggested_capability_ids: string[];
}

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Extract YouTube playlist ID from URL
function extractYouTubePlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&\n?#]+)/);
  return match ? match[1] : null;
}

// Fetch all videos from a YouTube playlist using YouTube Data API v3
async function getYouTubePlaylistVideos(playlistId: string): Promise<Array<{
  videoId: string;
  title: string;
  description: string;
  thumbnail_url: string;
  author: string;
}>> {
  const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
  
  if (!YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY not configured');
    return [];
  }
  
  const videos: Array<{
    videoId: string;
    title: string;
    description: string;
    thumbnail_url: string;
    author: string;
  }> = [];
  
  let nextPageToken: string | null = null;
  let pageCount = 0;
  const maxPages = 10; // Max 500 videos (50 per page)
  
  try {
    do {
      const apiUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      apiUrl.searchParams.set('part', 'snippet');
      apiUrl.searchParams.set('playlistId', playlistId);
      apiUrl.searchParams.set('maxResults', '50');
      apiUrl.searchParams.set('key', YOUTUBE_API_KEY);
      if (nextPageToken) {
        apiUrl.searchParams.set('pageToken', nextPageToken);
      }
      
      const response = await fetch(apiUrl.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('YouTube API error:', response.status, errorText);
        break;
      }
      
      const data = await response.json();
      
      for (const item of data.items || []) {
        const snippet = item.snippet;
        if (snippet?.resourceId?.videoId) {
          videos.push({
            videoId: snippet.resourceId.videoId,
            title: snippet.title || 'Untitled Video',
            description: snippet.description || '',
            thumbnail_url: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
            author: snippet.videoOwnerChannelTitle || snippet.channelTitle || 'Unknown'
          });
        }
      }
      
      nextPageToken = data.nextPageToken || null;
      pageCount++;
      
    } while (nextPageToken && pageCount < maxPages);
    
    console.log(`Extracted ${videos.length} videos from playlist ${playlistId}`);
    return videos;
    
  } catch (error) {
    console.error('Error fetching playlist videos:', error);
    return [];
  }
}

// Get video metadata using YouTube oEmbed API
async function getYouTubeVideoMetadata(videoId: string): Promise<Partial<ResourceMetadata>> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch video metadata');
    }
    
    const data = await response.json();
    
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: data.title || 'Untitled Video',
      description: `Video by ${data.author_name || 'Unknown'}`,
      content_type: 'video',
      thumbnail_url: data.thumbnail_url,
      author: data.author_name,
      is_valid: true
    };
  } catch (error) {
    console.error('YouTube metadata extraction error:', error);
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: 'YouTube Video',
      description: '',
      content_type: 'video',
      is_valid: true
    };
  }
}

// Fetch and extract content from generic URLs
async function fetchPageContent(url: string): Promise<{ title: string; description: string; content: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JerichoBot/1.0)'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || '';
    
    // Extract description
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    const description = ogDescMatch?.[1] || descMatch?.[1] || '';
    
    // Extract some body text for context
    const bodyContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000);
    
    return { title, description, content: bodyContent };
  } catch (error) {
    console.error('Failed to fetch page content:', error);
    return null;
  }
}

// Detect content type from URL
function detectContentType(url: string): ResourceMetadata['content_type'] {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || urlLower.includes('vimeo.com')) {
    return 'video';
  }
  if (urlLower.includes('amazon.com') || urlLower.includes('/book/') || urlLower.includes('goodreads.com')) {
    return 'book';
  }
  if (urlLower.includes('coursera.org') || urlLower.includes('udemy.com') || urlLower.includes('linkedin.com/learning')) {
    return 'course';
  }
  if (urlLower.includes('spotify.com') || urlLower.includes('podcast') || urlLower.includes('apple.com/podcast')) {
    return 'podcast';
  }
  return 'article';
}

// Use AI to enhance metadata and suggest capabilities
async function enhanceWithAI(
  basicMetadata: Partial<ResourceMetadata>,
  pageContent: string | null,
  capabilities: Array<{ id: string; name: string; description: string | null }>
): Promise<{ enhanced: Partial<ResourceMetadata>; suggestedCapabilityIds: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY, skipping AI enhancement');
    return { enhanced: basicMetadata, suggestedCapabilityIds: [] };
  }

  const capabilityList = capabilities.map(c => `- ${c.id}: ${c.name}${c.description ? ` (${c.description})` : ''}`).join('\n');
  
  const prompt = `Analyze this learning resource and suggest the most relevant capabilities.

Resource:
- URL: ${basicMetadata.url}
- Title: ${basicMetadata.title || 'Unknown'}
- Description: ${basicMetadata.description || 'None'}
- Content Type: ${basicMetadata.content_type}
${pageContent ? `- Page Content Preview: ${pageContent.substring(0, 1000)}` : ''}

Available Capabilities:
${capabilityList}

Return a JSON object with:
1. "title": An improved, cleaner title (if the current one is poor)
2. "description": A better description (1-2 sentences max, professional tone)
3. "author": Extract author name if visible
4. "content_type": Verify or correct the content type (video, book, article, podcast, course)
5. "suggested_capability_ids": Array of 1-5 capability IDs that are most relevant to this resource's content

Focus on accuracy - only suggest capabilities that are clearly relevant based on the title and content.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a learning resource analyzer. Return only valid JSON, no markdown.' },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_resource',
              description: 'Analyze and enhance learning resource metadata',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Improved title' },
                  description: { type: 'string', description: 'Better description' },
                  author: { type: 'string', description: 'Author name if found' },
                  content_type: { type: 'string', enum: ['video', 'book', 'article', 'podcast', 'course'] },
                  suggested_capability_ids: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Array of capability IDs'
                  }
                },
                required: ['title', 'description', 'content_type', 'suggested_capability_ids']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_resource' } }
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return { enhanced: basicMetadata, suggestedCapabilityIds: [] };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      
      // Validate capability IDs
      const validCapIds = capabilities.map(c => c.id);
      const suggestedIds = (result.suggested_capability_ids || [])
        .filter((id: string) => validCapIds.includes(id))
        .slice(0, 5);
      
      return {
        enhanced: {
          ...basicMetadata,
          title: result.title || basicMetadata.title,
          description: result.description || basicMetadata.description,
          author: result.author || basicMetadata.author,
          content_type: result.content_type || basicMetadata.content_type,
        },
        suggestedCapabilityIds: suggestedIds
      };
    }
  } catch (error) {
    console.error('AI enhancement error:', error);
  }

  return { enhanced: basicMetadata, suggestedCapabilityIds: [] };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, companyId } = await req.json() as ExtractRequest;
    
    if (!urls || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch capabilities for AI matching
    const { data: capabilities } = await supabase
      .from('capabilities')
      .select('id, name, description')
      .order('name');

    // Check for existing URLs (duplicate detection)
    const { data: existingResources } = await supabase
      .from('resources')
      .select('id, url')
      .eq('company_id', companyId)
      .in('url', urls);

    const existingUrlMap = new Map(
      (existingResources || []).map(r => [r.url, r.id])
    );

    console.log(`Processing ${urls.length} URLs, ${existingUrlMap.size} duplicates found`);

    // Expand playlist URLs into individual video URLs
    const expandedUrls: string[] = [];
    const playlistInfo: { playlistId: string; videoCount: number } | null = null;
    
    for (const url of urls) {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) continue;
      
      // Check if this is a playlist URL
      const playlistId = extractYouTubePlaylistId(trimmedUrl);
      if (playlistId) {
        console.log(`Detected playlist: ${playlistId}, fetching videos...`);
        const playlistVideos = await getYouTubePlaylistVideos(playlistId);
        
        if (playlistVideos.length > 0) {
          // Add each video URL to the expanded list
          for (const video of playlistVideos) {
            expandedUrls.push(`https://www.youtube.com/watch?v=${video.videoId}`);
          }
          console.log(`Expanded playlist to ${playlistVideos.length} videos`);
        } else {
          // If playlist extraction failed, try to process as regular URL
          expandedUrls.push(trimmedUrl);
        }
      } else {
        expandedUrls.push(trimmedUrl);
      }
    }

    // Re-check for duplicates with expanded URLs
    const { data: expandedExistingResources } = await supabase
      .from('resources')
      .select('id, url')
      .eq('company_id', companyId)
      .in('url', expandedUrls);

    const expandedExistingUrlMap = new Map(
      (expandedExistingResources || []).map(r => [r.url, r.id])
    );

    const results: ResourceMetadata[] = [];

    for (const trimmedUrl of expandedUrls) {
      if (!trimmedUrl) continue;

      // Check for duplicate
      const existingId = expandedExistingUrlMap.get(trimmedUrl);
      if (existingId) {
        results.push({
          url: trimmedUrl,
          title: 'Already imported',
          description: 'This resource already exists in your library',
          content_type: 'article',
          is_valid: true,
          is_duplicate: true,
          existing_resource_id: existingId,
          suggested_capability_ids: []
        });
        continue;
      }

      // Get basic metadata
      let basicMetadata: Partial<ResourceMetadata> = {
        url: trimmedUrl,
        content_type: detectContentType(trimmedUrl),
        is_valid: true,
        is_duplicate: false
      };

      // YouTube-specific extraction
      const videoId = extractYouTubeVideoId(trimmedUrl);
      if (videoId) {
        const ytMetadata = await getYouTubeVideoMetadata(videoId);
        basicMetadata = { ...basicMetadata, ...ytMetadata };
      } else {
        // Fetch page content for non-YouTube URLs
        const pageData = await fetchPageContent(trimmedUrl);
        if (pageData) {
          basicMetadata.title = pageData.title || 'Untitled Resource';
          basicMetadata.description = pageData.description || '';
        } else {
          basicMetadata.title = 'Resource';
          basicMetadata.description = '';
          basicMetadata.is_valid = false;
          basicMetadata.error = 'Could not access URL';
        }
      }

      // AI enhancement
      let pageContent = null;
      if (!videoId) {
        const pageData = await fetchPageContent(trimmedUrl);
        pageContent = pageData?.content || null;
      }

      const { enhanced, suggestedCapabilityIds } = await enhanceWithAI(
        basicMetadata,
        pageContent,
        capabilities || []
      );

      results.push({
        ...enhanced,
        url: trimmedUrl,
        is_valid: basicMetadata.is_valid ?? true,
        is_duplicate: false,
        suggested_capability_ids: suggestedCapabilityIds
      } as ResourceMetadata);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        resources: results,
        capabilities: capabilities || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in smart-extract-resource:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract resource metadata';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
