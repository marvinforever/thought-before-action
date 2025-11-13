import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractRequest {
  url: string;
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
  error?: string;
}

// Validate URL is accessible
async function validateUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      method: 'HEAD', 
      redirect: 'follow',
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
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

// Extract YouTube playlist ID
function extractYouTubePlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&\n?#]+)/);
  return match ? match[1] : null;
}

// Get video metadata using YouTube oEmbed API (no API key needed)
async function getYouTubeVideoMetadata(videoId: string): Promise<ResourceMetadata> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch video metadata');
    }
    
    const data = await response.json();
    
    // oEmbed doesn't provide duration, but we can estimate from title or set to null
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: data.title || 'Untitled Video',
      description: `Video by ${data.author_name || 'Unknown'}`,
      content_type: 'video',
      thumbnail_url: data.thumbnail_url,
      author: data.author_name,
      duration_minutes: null, // oEmbed doesn't provide this
      is_valid: true
    };
  } catch (error) {
    console.error('YouTube metadata extraction error:', error);
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: 'YouTube Video',
      description: 'Unable to extract full metadata',
      content_type: 'video',
      is_valid: true,
      error: 'Limited metadata available'
    };
  }
}

// Get playlist videos (requires YouTube API key for full functionality)
async function getYouTubePlaylistVideos(playlistId: string): Promise<ResourceMetadata[]> {
  // For now, return a single item indicating playlist support is limited
  // In the future, this could use YouTube Data API with an API key
  return [{
    url: `https://www.youtube.com/playlist?list=${playlistId}`,
    title: 'YouTube Playlist',
    description: 'To import individual videos from this playlist, please paste each video URL separately.',
    content_type: 'video',
    is_valid: true,
    error: 'Playlist batch import requires YouTube API key configuration'
  }];
}

// Generic metadata extraction for non-YouTube URLs
async function extractGenericMetadata(url: string): Promise<ResourceMetadata> {
  const isValid = await validateUrl(url);
  
  if (!isValid) {
    return {
      url,
      title: 'Invalid URL',
      description: 'This URL could not be accessed. Please verify the link is correct.',
      content_type: 'article',
      is_valid: false,
      error: 'URL is not accessible'
    };
  }
  
  // Determine content type from URL
  let contentType: ResourceMetadata['content_type'] = 'article';
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('vimeo.com') || urlLower.includes('video')) {
    contentType = 'video';
  } else if (urlLower.includes('amazon.com') || urlLower.includes('/book/')) {
    contentType = 'book';
  } else if (urlLower.includes('coursera.org') || urlLower.includes('udemy.com') || urlLower.includes('linkedin.com/learning')) {
    contentType = 'course';
  } else if (urlLower.includes('spotify.com') || urlLower.includes('podcast')) {
    contentType = 'podcast';
  }
  
  return {
    url,
    title: 'Resource', // User will need to edit this
    description: 'Please add a description for this resource.',
    content_type: contentType,
    is_valid: true
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json() as ExtractRequest;
    
    if (!url || !url.trim()) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Extracting metadata for: ${url}`);
    
    let metadata: ResourceMetadata | ResourceMetadata[];
    
    // Check if it's a YouTube URL
    const videoId = extractYouTubeVideoId(url);
    const playlistId = extractYouTubePlaylistId(url);
    
    if (videoId) {
      // Single YouTube video
      metadata = await getYouTubeVideoMetadata(videoId);
    } else if (playlistId) {
      // YouTube playlist
      metadata = await getYouTubePlaylistVideos(playlistId);
    } else {
      // Generic URL
      metadata = await extractGenericMetadata(url);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        resources: Array.isArray(metadata) ? metadata : [metadata]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to extract resource metadata' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
