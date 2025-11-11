import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { transcript, employeeName } = await req.json();
    
    if (!transcript) {
      throw new Error("No transcript provided");
    }

    console.log("Parsing meeting notes from transcript...");

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const systemPrompt = `You are an assistant that helps managers organize their 1-on-1 meeting notes. 
Parse the conversation transcript and extract structured information into these categories:
- General Notes: Overall conversation summary and key discussion points
- Wins & Accomplishments: Positive achievements, completed work, successes
- Concerns & Challenges: Problems, blockers, difficulties, areas needing attention
- Action Items: Specific tasks or follow-ups (as a JSON array of strings)

Return ONLY a valid JSON object with these exact keys: notes, wins, concerns, actionItems.
Make the content professional and concise. If a section has no relevant content, use an empty string (or empty array for actionItems).`;

    const userPrompt = `Parse this 1-on-1 conversation with ${employeeName}:\n\n${transcript}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const parsedNotes = JSON.parse(result.choices[0].message.content);

    console.log("Meeting notes parsed successfully");

    return new Response(
      JSON.stringify(parsedNotes),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error parsing meeting notes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
