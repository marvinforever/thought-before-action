import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fetch YouTube transcript using youtubetranscript.com API
async function getYouTubeTranscript(videoId: string): Promise<{ transcript: string; title: string; author: string } | null> {
  try {
    // First get video metadata via oEmbed
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const metaResponse = await fetch(oembedUrl);
    let title = "YouTube Video";
    let author = "";
    
    if (metaResponse.ok) {
      const meta = await metaResponse.json();
      title = meta.title || title;
      author = meta.author_name || "";
    }

    // Try to get transcript using youtubetranscript.com (free, no API key)
    const transcriptResponse = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`);
    
    if (transcriptResponse.ok) {
      const html = await transcriptResponse.text();
      
      // Parse the XML transcript from the response
      const textMatches = html.match(/<text[^>]*>([^<]*)<\/text>/g);
      if (textMatches && textMatches.length > 0) {
        const transcript = textMatches
          .map(match => {
            const textContent = match.replace(/<[^>]+>/g, '');
            return decodeHTMLEntities(textContent);
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (transcript.length > 50) {
          return { transcript, title, author };
        }
      }
    }

    // Fallback: Try alternative transcript API
    const altResponse = await fetch(`https://yt.lemnoslife.com/videos?part=snippet&id=${videoId}`);
    if (altResponse.ok) {
      const altData = await altResponse.json();
      if (altData.items?.[0]?.snippet?.description) {
        // At minimum return the description if we can't get transcript
        console.log("Could not get full transcript, returning video description");
      }
    }

    // If no transcript found, return null with metadata
    return { 
      transcript: `[Transcript unavailable - Please paste the transcript manually or try a different video]\n\nVideo Title: ${title}\nAuthor: ${author}`, 
      title, 
      author 
    };
    
  } catch (error) {
    console.error("YouTube transcript error:", error);
    return null;
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

// Detect if URL is a podcast/audio and get metadata
async function getPodcastInfo(url: string): Promise<{ title: string; author: string; platform: string } | null> {
  try {
    // Detect podcast platforms
    const platforms = [
      { pattern: /spotify\.com\/episode/, name: 'Spotify' },
      { pattern: /podcasts\.apple\.com/, name: 'Apple Podcasts' },
      { pattern: /anchor\.fm/, name: 'Anchor' },
      { pattern: /buzzsprout\.com/, name: 'Buzzsprout' },
      { pattern: /libsyn\.com/, name: 'Libsyn' },
      { pattern: /soundcloud\.com/, name: 'SoundCloud' },
      { pattern: /podbean\.com/, name: 'Podbean' },
    ];

    for (const { pattern, name } of platforms) {
      if (pattern.test(url)) {
        return { title: "Podcast Episode", author: "", platform: name };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Podcast detection error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Processing URL:", url);

    // Check if YouTube
    const youtubeId = extractYouTubeVideoId(url);
    if (youtubeId) {
      console.log("Detected YouTube video:", youtubeId);
      const result = await getYouTubeTranscript(youtubeId);
      
      if (result) {
        return new Response(
          JSON.stringify({
            success: true,
            type: 'youtube',
            transcript: result.transcript,
            metadata: {
              title: result.title,
              author: result.author,
              source_name: 'YouTube',
              source_url: url,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if podcast
    const podcastInfo = await getPodcastInfo(url);
    if (podcastInfo) {
      console.log("Detected podcast:", podcastInfo.platform);
      
      // For podcasts, we can't auto-transcribe without audio download
      // Return a message indicating manual transcript needed
      return new Response(
        JSON.stringify({
          success: true,
          type: 'podcast',
          transcript: `[Podcast from ${podcastInfo.platform}]\n\nAutomatic transcription for podcasts is not yet available. Please:\n1. Use a transcription service (like Otter.ai, Rev, or Descript)\n2. Copy the transcript here\n\nOr if you have the audio file, we can transcribe it for you.`,
          metadata: {
            title: podcastInfo.title,
            author: podcastInfo.author,
            source_name: podcastInfo.platform,
            source_url: url,
          },
          requiresManualTranscript: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generic URL - try to fetch page content
    console.log("Attempting generic URL fetch");
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MomentumAcademy/1.0)',
        },
      });
      
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : 'Unknown';
        
        // Extract meta description or og:description
        const descMatch = html.match(/<meta[^>]*(?:name="description"|property="og:description")[^>]*content="([^"]+)"/i) ||
                          html.match(/<meta[^>]*content="([^"]+)"[^>]*(?:name="description"|property="og:description")/i);
        const description = descMatch ? decodeHTMLEntities(descMatch[1]) : '';
        
        // Extract author if available
        const authorMatch = html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i);
        const author = authorMatch ? decodeHTMLEntities(authorMatch[1]) : '';
        
        return new Response(
          JSON.stringify({
            success: true,
            type: 'webpage',
            transcript: `[Web page content]\n\nTitle: ${title}\n\n${description}\n\n[For full article content, please paste the text manually or provide a transcript]`,
            metadata: {
              title,
              author,
              source_name: new URL(url).hostname.replace('www.', ''),
              source_url: url,
            },
            requiresManualTranscript: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (fetchError) {
      console.error("Page fetch error:", fetchError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Could not extract content from this URL. Please paste the transcript manually.",
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("Extract content error:", error);
    const message = error instanceof Error ? error.message : "Failed to extract content";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
