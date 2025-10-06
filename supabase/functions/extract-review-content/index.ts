import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, employeeName } = await req.json();
    
    if (!transcription) {
      throw new Error("No transcription provided");
    }

    console.log("Extracting review content from transcription...");

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const prompt = `You are analyzing a transcription of a performance review meeting between a manager and ${employeeName || "an employee"}. 

Extract and structure the following information from the transcription. Be specific and use exact quotes where appropriate.

TRANSCRIPTION:
${transcription}

Extract the following in structured JSON format:
- manager_notes: Overall assessment and key discussion points from the manager
- strengths: Specific strengths mentioned (as a formatted text with bullet points)
- areas_for_improvement: Areas for development mentioned (as a formatted text with bullet points)
- overall_rating: Infer an overall performance rating from 1-10 based on the tone and content (1=needs significant improvement, 5=meets expectations, 10=exceptional)
- goals_discussed: Any goals or action items mentioned

Format your response as valid JSON with these exact keys. Be thorough but concise.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a performance review analyst. Extract structured data from meeting transcriptions and return valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedContent = JSON.parse(aiData.choices[0].message.content);

    console.log("Content extraction completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        data: extractedContent
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error extracting review content:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
