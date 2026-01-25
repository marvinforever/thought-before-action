import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, type RoutingContext } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CAREER ASPIRATION DETECTION
 * 
 * Analyzes conversation messages for career-related signals and stores
 * detected aspirations for later use in career pathing and manager insights.
 * 
 * Called automatically after Jericho conversations or manually for batch analysis.
 */

// Keywords that indicate career-related discussion
const CAREER_KEYWORDS = [
  'future', 'promotion', 'grow into', 'career goal', 'career path',
  'interested in', 'want to become', 'leadership', 'leadership path',
  'next role', 'advance', 'management', 'management track',
  'long term', 'long-term', 'aspire', 'aspiration', 'dream job',
  'eventually', 'someday', 'goal is to', 'working toward',
  'senior', 'principal', 'director', 'vp', 'head of', 'lead',
  'transition', 'pivot', 'switch to', 'move into', 'get into',
  'skill', 'skills', 'learn', 'develop', 'improve at',
  'responsibility', 'responsibilities', 'own', 'ownership',
  'team', 'manage', 'mentor', 'coach', 'lead a team',
];

function containsCareerKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return CAREER_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

interface AspirationDetection {
  detected: boolean;
  aspirations: Array<{
    text: string;
    type: 'role' | 'skill' | 'responsibility' | 'industry' | 'general';
    targetRole: string | null;
    confidence: number;
    sentiment: 'eager' | 'curious' | 'uncertain' | 'frustrated';
    keywords: string[];
  }>;
}

async function detectAspirations(
  messages: string[],
  context: { userName: string; currentRole: string },
  routingContext: RoutingContext
): Promise<AspirationDetection> {
  const combinedText = messages.join('\n\n');
  
  // Quick check - if no career keywords, skip AI analysis
  if (!containsCareerKeywords(combinedText)) {
    return { detected: false, aspirations: [] };
  }

  const prompt = `Analyze these conversation messages for career aspirations and interests.

USER: ${context.userName}
CURRENT ROLE: ${context.currentRole}

MESSAGES:
${combinedText}

TASK:
Identify any expressed career aspirations, interests, or goals. Look for:
1. Explicit statements about future roles they want
2. Skills they want to develop
3. Responsibilities they want to take on
4. Industries or domains they're interested in
5. General career direction statements

For each aspiration found, determine:
- TYPE: role (specific job), skill (capability to develop), responsibility (type of work), industry (sector interest), general (broad direction)
- TARGET ROLE: If a specific role is mentioned, extract it
- CONFIDENCE: How explicitly stated (0.0-1.0)
- SENTIMENT: eager (excited about it), curious (exploring), uncertain (unsure), frustrated (feeling stuck)
- KEYWORDS: Career terms used

If no career aspirations are detected, return empty array.

Output as JSON:
{
  "detected": boolean,
  "aspirations": [
    {
      "text": "The exact quote or paraphrase expressing the aspiration",
      "type": "role|skill|responsibility|industry|general",
      "targetRole": "Specific role name or null",
      "confidence": 0.0-1.0,
      "sentiment": "eager|curious|uncertain|frustrated",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}`;

  const result = await callAI(routingContext, [{ role: 'user', content: prompt }], {
    maxTokens: 1500,
    temperature: 0.3,
  });

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse aspiration detection JSON:', e);
  }

  return { detected: false, aspirations: [] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId, profileId, messages: rawMessages } = await req.json();

    console.log("Detecting career aspirations for:", profileId || conversationId);

    let messages: string[] = [];
    let userId = profileId;
    let companyId: string | null = null;
    let sourceConversationId = conversationId;

    // If conversation ID provided, fetch messages
    if (conversationId) {
      const { data: conversationMessages } = await supabase
        .from("conversation_messages")
        .select("content, role")
        .eq("conversation_id", conversationId)
        .eq("role", "user") // Only analyze user messages
        .order("created_at", { ascending: true });

      messages = (conversationMessages || []).map(m => m.content);

      // Get conversation details
      const { data: conversation } = await supabase
        .from("conversations")
        .select("profile_id, company_id")
        .eq("id", conversationId)
        .single();

      if (conversation) {
        userId = conversation.profile_id;
        companyId = conversation.company_id;
      }
    } else if (rawMessages) {
      // Direct messages provided
      messages = Array.isArray(rawMessages) ? rawMessages : [rawMessages];
    }

    if (!messages.length) {
      return new Response(
        JSON.stringify({ detected: false, message: "No messages to analyze" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, company_id")
      .eq("id", userId)
      .single();

    if (!profile) {
      throw new Error("Profile not found");
    }

    companyId = companyId || profile.company_id;

    // Set up routing context - using flash for quick detection
    const routingContext: RoutingContext = {
      taskType: 'intent-detection', // Use fast model for detection
      companyId: companyId || undefined,
      profileId: userId,
      functionName: 'detect-career-aspirations',
    };

    // Detect aspirations
    const detection = await detectAspirations(
      messages,
      { userName: profile.full_name, currentRole: profile.role || 'Unknown' },
      routingContext
    );

    if (!detection.detected || detection.aspirations.length === 0) {
      console.log("No career aspirations detected");
      return new Response(
        JSON.stringify({ detected: false, aspirationsStored: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Detected ${detection.aspirations.length} career aspirations`);

    // Store detected aspirations
    const aspirationsToInsert = detection.aspirations.map(asp => ({
      profile_id: userId,
      company_id: companyId,
      aspiration_text: asp.text,
      aspiration_type: asp.type,
      target_role: asp.targetRole,
      confidence_score: asp.confidence,
      keywords: asp.keywords,
      sentiment: asp.sentiment,
      source_type: 'chat',
      source_conversation_id: sourceConversationId || null,
    }));

    const { error: insertError } = await supabase
      .from("career_aspirations")
      .insert(aspirationsToInsert);

    if (insertError) {
      console.error("Failed to store aspirations:", insertError);
      throw insertError;
    }

    console.log(`Stored ${aspirationsToInsert.length} aspirations successfully`);

    return new Response(
      JSON.stringify({
        detected: true,
        aspirationsStored: aspirationsToInsert.length,
        aspirations: detection.aspirations,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error detecting aspirations:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
